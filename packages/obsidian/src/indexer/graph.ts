import { extractFrontmatter } from "@ironvault/parsing-markdown";
import {
  baseNameOf,
  childOfPath,
  parentFolderOf,
} from "@ironvault/utils/paths";
import {
  batch,
  computed,
  effect,
  Signal,
  signal,
  untracked,
} from "@preact/signals-core";
import {
  campaignFileSchemaWithPlayset,
  CampaignInput,
  PlaysetConfigSchema,
  playsetSpecToPlaysetConfig,
} from "campaigns/entity";
import { Determination, IPlaysetConfig } from "campaigns/playsets/config";
import { characterLens, ValidatedCharacter } from "characters/lens";
import { DataIndexDb, ReadonlyDataIndexDb } from "datastore/db";
import { enableMapSet, produce } from "immer";
import isEqual from "lodash.isequal";
import { rootLogger } from "logger";
import { Ruleset } from "rules/ruleset";
import {
  Either,
  flatMap,
  Left,
  makeEitherPartialEquality,
  Right,
} from "utils/either";
import { zodResultToEither } from "utils/zodutils";
import { PLUGIN_KIND_FIELD } from "../constants";
import {
  DataswornEntries,
  DataswornTypes,
} from "../datastore/loader/datasworn-indexer";

const logger = rootLogger.getLogger("datastore.loader.graph");
logger.setDefaultLevel("debug");

enableMapSet();

export type FileKind = {
  campaign: Either<Error, CampaignInput>;
  character: Either<Error, ValidatedCharacter>;
};

function isValidFileKind(
  kind: unknown,
): kind is keyof FileKind & keyof typeof nodeTypes {
  return typeof kind === "string" && kind in nodeTypes;
}

export type File = {
  path: string;
  filerev: string;
  content: string;
  deleted?: boolean;
};

export type PlaysetValue = {
  entries: Map<string, DataswornEntries>;
  revision: number;
};

export type AllowableTypes = FileKind & {
  "@file": File;
  playset: Either<Error, PlaysetValue>;
  // "campaign":
};

const frontmatter = memoizeWeak((file: Signal<File>) =>
  onlyChanges(
    computed(() => extractFrontmatter(file.value.content)),
    isEqual,
  ),
);

const ironVaultKind = memoizeWeak((file: Signal<File>) =>
  onlyChanges(
    computed(() => {
      const fm: Record<string, unknown> =
        frontmatter(file).value.unwrapOr({}) ?? {};
      return fm[PLUGIN_KIND_FIELD] as string | undefined;
    }),
    isEqual,
  ),
);

const eitherIsEqual = makeEitherPartialEquality(isEqual);

export const playsetConfigFor = memoizeWeak(
  (
    campaign: Signal<AllowableTypes["campaign"]>,
  ): Signal<Either<Error, PlaysetConfigSchema>> =>
    onlyChanges(
      computed(() => campaign.value.map((_) => _.ironvault.playset)),
      eitherIsEqual,
    ),
);

export const playsetNodeForCampaign = memoizeGraph((graph) =>
  memoizeWeak((campaign: Signal<AllowableTypes["campaign"]>) =>
    onlyChanges(
      computed((): AllowableTypes["playset"] =>
        flatMap(
          playsetConfigFor(campaign).value,
          (playset) =>
            graph.getOrCreateAtom<AllowableTypes["playset"]>(
              `playset/${JSON.stringify(playset)}`,
              Left.create(
                new Error(`playset not yet loaded: ${JSON.stringify(playset)}`),
              ),
              eitherIsEqual,
            ).value,
        ),
      ),
      isEqual,
    ),
  ),
);

const allPlaysetSpecs = memoizeGraph((graph: GraphContext<AllowableTypes>) =>
  onlyChanges(
    computed(() => {
      const allCampaigns = graph.getAllNodes("campaign").value;
      const playsetSpecs = new Map<string, PlaysetConfigSchema>();
      for (const campaignPath of allCampaigns) {
        const campaign = graph.getNode("campaign", campaignPath);
        if (!campaign) {
          logger.warn(
            "[graph] Campaign `%s` not found. This shouldn't happen.",
            campaignPath,
          );
          continue;
        }
        const playsetSpec = playsetConfigFor(campaign).value;
        if (playsetSpec.isLeft()) {
          logger.error("Error getting playset spec", playsetSpec.error);
          continue;
        }

        playsetSpecs.set(
          `playset/${JSON.stringify(playsetSpec.value)}`,
          playsetSpec.value,
        );

        // TODO: might want something on the playset type that ties it back to the
        // data rev it was built against, so we can see if we are waiting on updates...
        graph.getOrCreateAtom<AllowableTypes["playset"]>(
          `playset/${JSON.stringify(playsetSpec.value)}`,
          Right.create({ entries: new Map(), revision: 0 }),
          eitherIsEqual,
        );
      }
      return playsetSpecs;
    }),
    isEqual,
  ),
);

export function registerData(
  graph: Graph,
  db: DataIndexDb<DataswornTypes>,
): Signal<Data> {
  const data = graph.getOrCreateAtom<Data>(
    "data",
    {
      db,
      revision: 0,
    },
    (a, b) => a.revision !== b.revision,
  );
  db.onupdate = () => {
    const newRevision = data.value.revision + 1;
    data.value = { ...data.value, revision: newRevision };
  };
  return data;
}

export function registerPlaysetHasher(graph: Graph, data: Signal<Data>) {
  return effect(() => {
    const { db, revision } = data.value;

    // TODO: need to also get unused playset atoms and remove them

    const playsets: [string, IPlaysetConfig, PlaysetValue][] = [
      ...allPlaysetSpecs(graph).value.entries(),
    ].flatMap(([key, spec]) => {
      const playsetConfig = playsetSpecToPlaysetConfig(spec);
      if (playsetConfig.isLeft()) {
        logger.error("Error getting playset spec", spec, playsetConfig.error);
        return [];
      }
      return [[key, playsetConfig.value, { entries: new Map(), revision }]];
    });

    logger.debug("[playset-hasher] playsets: %o", playsets);

    if (playsets.length === 0) {
      return;
    }

    let canceled = false;
    (async () => {
      for await (const entry of db.iteratePriorityEntries()) {
        if (canceled) {
          logger.debug("[playset-hasher] canceled");
          return;
        }
        for (const [, playsetConfig, playset] of playsets) {
          const determination = playsetConfig.determine(
            entry.id,
            entry.value.metadata,
          );
          if (determination === Determination.Include) {
            playset.entries.set(entry.id, entry);
          }
        }
      }

      if (!canceled) {
        for (const [playsetKey, , playset] of playsets) {
          graph.setAtom<AllowableTypes["playset"]>(
            playsetKey,
            Right.create(playset),
            eitherIsEqual,
          );
        }
      }
    })();

    return () => {
      canceled = true;
    };
  });
}

export interface Data {
  readonly revision: number;
  readonly db: ReadonlyDataIndexDb<DataswornTypes>;
}

export const campaignAssignment = memoizeWeak(
  (graph: GraphContext<AllowableTypes>) =>
    memoizeWeak((file: Signal<File>) => {
      return onlyChanges(
        computed(() => {
          const allCampaigns = graph.getAllNodes("campaign").value;
          const path = file.value.path;
          const matches = [];
          for (const campaignIndexPath of allCampaigns.values()) {
            const campaignRoot = parentFolderOf(campaignIndexPath);
            if (childOfPath(campaignRoot, path)) {
              matches.push(campaignIndexPath);
            }
          }
          if (matches.length != 1) {
            return undefined;
          }
          return matches[0];
        }),
        (a, b) => a === b,
      );
    }),
);

export type NodeParsers<
  AllowableTypes extends Record<string, unknown>,
  KS extends keyof AllowableTypes,
> = {
  [K in KS]: (
    ctx: GraphContext<AllowableTypes>,
    file: Signal<File>,
  ) => AllowableTypes[K];
};

const nodeTypes: NodeParsers<AllowableTypes, keyof FileKind> = {
  campaign: (graph: GraphContext<AllowableTypes>, file: Signal<File>) => {
    return flatMap(
      frontmatter(file).value.mapOrElse<
        Either<Error, undefined | Record<string, unknown>>
      >(Left.create, Right.create),
      (content) =>
        zodResultToEither(campaignFileSchemaWithPlayset.safeParse(content)).map(
          (raw) => ({
            ...raw,
            name: raw.name || baseNameOf(file.value.path),
          }),
        ),
    );
  },
  character: (graph: GraphContext<AllowableTypes>, file: Signal<File>) => {
    const campaignPath = campaignAssignment(graph)(file);
    if (campaignPath.value === undefined) {
      return Left.create(new Error("No campaign found"));
    }
    // SAFE: if this campaign is in the campaign assignment, it must be a node.
    const campaign = graph.getNode("campaign", campaignPath.value)!;

    const playset = playsetNodeForCampaign(graph)(campaign).value;
    if (playset.isLeft()) {
      return playset;
    }

    const fm = frontmatter(file).value;
    if (fm.isErr) {
      return Left.create(fm.error);
    }

    return flatMap(
      Ruleset.fromActiveRulesPackages(
        playset.value.entries
          .values()
          .filter((e) => e.kind === "rules_package")
          .map((e) => e.value.data)
          .toArray(),
      ),
      (ruleset) => {
        const { validater } = characterLens(ruleset);
        return validater(fm.value);
      },
    );
  },
};

export interface GraphContext<AllowableTypes extends Record<string, unknown>> {
  getAtom<T>(key: string): Signal<T> | undefined;
  getNode<T extends keyof AllowableTypes>(
    type: T,
    id: string,
  ): Signal<AllowableTypes[T]> | undefined;
  getNodeTracked<T extends keyof AllowableTypes>(
    type: T,
    id: string,
  ): Signal<AllowableTypes[T]> | undefined;
  getAllNodes<const T extends keyof AllowableTypes>(
    type: T,
  ): Signal<Set<string>>;
  getOrCreateAtom<T>(
    key: string,
    value: T,
    equalityFn?: (a: T, b: T) => boolean,
  ): Signal<T>;
}

export class EqualitySignal<T> extends Signal<T> {
  constructor(
    value: T,
    private readonly equalityFn: (a: T, b: T) => boolean,
  ) {
    super(value);
  }

  get value(): T {
    return super.value;
  }

  set value(newValue: T) {
    const prevValue = super.value;
    if (
      prevValue !== newValue &&
      (prevValue === undefined ||
        newValue === undefined ||
        !this.equalityFn(prevValue, newValue))
    ) {
      super.value = newValue; // Only update if the new value is different
    }
  }
}

export function equalitySignal<T>(
  value: T,
  equalityFn: (a: T, b: T) => boolean,
): Signal<T> {
  return new EqualitySignal(value, equalityFn);
}

/** Wraps a signal so that only changes (as determined by equality function
 * are propagated.
 */
export function onlyChanges<T>(
  signal: Signal<T>,
  equalityFn: (a: T, b: T) => boolean,
): Signal<T> {
  let prev: [T] | undefined = undefined;
  return computed(() => {
    const newValue = signal.value;

    if (prev !== undefined && equalityFn(prev[0], newValue)) {
      return prev[0];
    } else {
      prev = [newValue];
      return newValue;
    }
  });
}

export function memoizeGraph<U>(
  fn: (graph: GraphContext<AllowableTypes>) => U,
) {
  return memoizeWeak(fn);
}

export function memoizeWeak<T extends WeakKey, U>(
  fn: (arg: T) => U,
): (arg: T) => U {
  const cache = new WeakMap<T, U>();
  return (arg: T) => {
    if (!cache.has(arg)) {
      cache.set(arg, fn(arg));
    }
    return cache.get(arg)!;
  };
}

export function memoizeStrong<T, U>(fn: (arg: T) => U): (arg: T) => U {
  const cache = new Map<T, U>();
  return (arg: T) => {
    if (!cache.has(arg)) {
      cache.set(arg, fn(arg));
    }
    return cache.get(arg)!;
  };
}

export function areSetsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const item of a) {
    if (!b.has(item)) {
      return false;
    }
  }
  return true;
}

export function withPrevious<T>(fn: (prev: T) => T, initialValue: T): Signal<T>;
export function withPrevious<T>(fn: (prev: T | undefined) => T): Signal<T>;
export function withPrevious<T>(
  fn: (prev: T | undefined) => T,
  initialValue?: T,
): Signal<T> {
  let prev: T | undefined = initialValue;
  return computed(() => {
    const next = fn(prev);
    return (prev = next);
  });
}

export class Graph implements GraphContext<AllowableTypes> {
  #nodes: Signal<Map<string, Signal<unknown>>> = signal(new Map());
  #subscriptions: Map<string, (() => void)[]> = new Map();

  constructor() {}

  allNodesOfType = memoizeStrong((type: keyof AllowableTypes) =>
    withPrevious((prev) => {
      const next = new Set(
        [...this.#nodes.value.keys()]
          .filter((entry) => entry.startsWith(type + "/"))
          .map((entry) => entry.slice(type.length + 1)),
      );
      return areSetsEqual(prev, next) ? prev : next;
    }, new Set<string>()),
  );

  getAllNodes<T extends string & keyof AllowableTypes>(type: T) {
    return this.allNodesOfType(type);
  }

  allNodes() {
    return this.#nodes.value
      .entries()
      .map(([key, value]): [string, unknown] => [key, value.value]);
  }

  addOrUpdateFile(file: File): Signal<File> {
    const key = `@file/${file.path}`;
    const existing = this.#nodes.value.get(key) as Signal<File> | undefined;
    if (existing) {
      existing.value = { ...file };
      return existing;
    } else {
      const signal = this.getOrCreateAtom(key, { ...file }, (a, b) => {
        return a.path === b.path && a.content === b.content;
      });
      // const previous = withPrevious(([last, _]) => ([signal.value, last]), [undefined, signal.value]);
      // TODO: if file path changes, we need to remove the old node
      const lastRegistered: string | undefined = undefined;
      this._registerSubscription(
        key,
        effect(() => {
          const kind = ironVaultKind(signal).value;
          if (lastRegistered !== undefined && lastRegistered !== kind) {
            this.removeNode(lastRegistered, signal.value.path);
          }
          if (kind === undefined || !isValidFileKind(kind)) {
            return;
          }
          this.registerNode(kind, signal.value.path, (ctx) =>
            nodeTypes[kind](ctx, signal),
          );
        }),
      );
      return signal;
    }
  }

  removeFile(path: string) {
    return untracked(() => {
      const key = `@file/${path}`;
      const existing = this.#nodes.value.get(key) as Signal<File> | undefined;
      if (existing) {
        // Mark it as deleted to start updates that will remove it.
        existing.value = { ...existing.value, deleted: true };
        this.removeNode("@file", path);
      }
    });
  }

  renameFile(oldPath: string, newPath: string) {
    return untracked(() => {
      const key = `@file/${oldPath}`;
      const existing = this.#nodes.value.get(key) as Signal<File> | undefined;
      if (existing) {
        // We update the node's path and adjust the graph in a single transaction
        batch(() => {
          existing.value = { ...existing.value, path: newPath };
          this.#nodes.value = produce(this.#nodes.value, (draft) => {
            draft.delete(key);
            draft.set(`@file/${newPath}`, existing);
          });
        });
      } else {
        logger.warn(
          "Attempted to rename non-existent file %s to %s",
          oldPath,
          newPath,
        );
      }
    });
  }

  _registerSubscription(
    key: string,
    subscription: () => void,
  ): (() => void) | undefined {
    const existing = this.#subscriptions.get(key);
    if (existing) {
      existing.push(subscription);
    } else {
      this.#subscriptions.set(key, [subscription]);
    }
    return () => {
      const existing = this.#subscriptions.get(key);
      if (existing) {
        const index = existing.indexOf(subscription);
        if (index !== -1) {
          existing.splice(index, 1);
        }
        if (existing.length === 0) {
          this.#subscriptions.delete(key);
        }
      }
    };
  }

  getOrCreateAtom<T>(
    key: string,
    value: T,
    equalityFn?: (a: T, b: T) => boolean,
  ): Signal<T> {
    return untracked(() => {
      if (this.#nodes.value.has(key)) {
        return this.#nodes.value.get(key) as Signal<T>;
      }
      const newsig = equalityFn
        ? equalitySignal(value, equalityFn)
        : signal(value);
      logger.debug("[graph] creating atom %s: %o", key, value);
      this.#nodes.value = produce(this.#nodes.value, (draft) => {
        draft.set(key, newsig);
      });
      return newsig;
    });
  }

  setAtom<T>(
    key: string,
    value: T,
    equalityFn?: (a: T, b: T) => boolean,
  ): Signal<T> {
    return untracked(() => {
      const existing = this.#nodes.value.get(key) as Signal<T> | undefined;
      if (existing) {
        logger.debug("[graph] updating atom %s: %o", key, value);
        existing.value = value;
        return existing;
      }
      const newsig = equalityFn
        ? equalitySignal(value, equalityFn)
        : signal(value);
      logger.debug("[graph] creating atom %s: %o", key, value);
      this.#nodes.value = produce(this.#nodes.value, (draft) => {
        draft.set(key, newsig);
      });
      return newsig;
    });
  }

  getAtom<T>(key: string): Signal<T> | undefined {
    return untracked(() => this.getAtomTracked<T>(key));
  }

  getAtomTracked<T>(key: string): Signal<T> | undefined {
    return this.#nodes.value.get(key) as Signal<T> | undefined;
  }

  registerNode<const T extends keyof AllowableTypes>(
    type: T,
    id: string,
    fn: (ctx: GraphContext<AllowableTypes>) => AllowableTypes[T],
    equalityFn?: (a: AllowableTypes[T], b: AllowableTypes[T]) => boolean,
  ): Signal<AllowableTypes[T]> {
    return untracked(() => {
      const key = `${type}/${id}`;
      if (this.#nodes.value.has(key)) {
        logger.warn("Ignoring duplicate node registration", key);
        // Just return the existing signal
        return this.#nodes.value.get(key) as Signal<AllowableTypes[T]>;
      }
      let newsig = computed(() => fn(this));
      if (equalityFn) {
        newsig = onlyChanges(newsig, equalityFn);
      }
      this.#nodes.value = produce(this.#nodes.value, (draft) => {
        draft.set(key, newsig);
      });
      this._registerSubscription(
        key,
        newsig.subscribe((value) => this.onUpdate(type, id, "changed", value)),
      );
      return newsig;
    });
  }

  removeNode(type: string, id: string) {
    return untracked(() => {
      const key = `${type}/${id}`;
      const subscriptions = this.#subscriptions.get(key);
      if (subscriptions) {
        for (const subscription of subscriptions) {
          try {
            subscription();
          } catch (e) {
            logger.error("Error unsubscribing from node", key, e);
          }
        }

        this.#subscriptions.delete(key);
      }
      this.#nodes.value.delete(key);
      this.onUpdate(type, id, "deleted", undefined);
    });
  }

  onUpdate(
    type: string,
    id: string,
    action: "changed" | "deleted",
    value: unknown,
  ) {
    const key = `${type}/${id}`;
    console.debug(`Node %s %s: %o`, key, action, value);
  }

  /** Gets an atom by type and id. */
  getNode<T extends keyof AllowableTypes>(
    type: T,
    id: string,
  ): Signal<AllowableTypes[T]> | undefined {
    const key = `${type}/${id}`;
    return this.getAtom<AllowableTypes[T]>(key);
  }

  /** Gets an atom by type and id. */
  getNodeTracked<T extends keyof AllowableTypes>(
    type: T,
    id: string,
  ): Signal<AllowableTypes[T]> | undefined {
    const key = `${type}/${id}`;
    return this.getAtomTracked<AllowableTypes[T]>(key);
  }
}
