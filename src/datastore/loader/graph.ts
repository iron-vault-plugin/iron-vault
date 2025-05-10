import {
  computed,
  effect,
  Signal,
  signal,
  untracked,
} from "@preact/signals-core";
import { campaignFileSchemaWithPlayset, CampaignInput } from "campaigns/entity";
import { enableMapSet, produce } from "immer";
import isEqual from "lodash.isequal";
import { Either, flatMap, Left } from "utils/either";
import { extractFrontmatter } from "utils/markdown";
import { baseNameOf, childOfPath, parentFolderOf } from "utils/paths";
import { zodResultToEither } from "utils/zodutils";
import { PLUGIN_KIND_FIELD } from "../../constants";

enableMapSet();

export type FileKind = {
  campaign: Either<Error, CampaignInput>;
  character: Either<Error, Record<string, unknown>>;
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
};

export type AllowableTypes = FileKind & {
  "@file": File;
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
        frontmatter(file).value.getOrElse({}) ?? {};
      return fm[PLUGIN_KIND_FIELD] as string | undefined;
    }),
    isEqual,
  ),
);

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
              matches.push(campaignRoot);
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
    return flatMap(frontmatter(file).value, (content) =>
      zodResultToEither(campaignFileSchemaWithPlayset.safeParse(content)).map(
        (raw) => ({
          ...raw,
          name: raw.name || baseNameOf(file.value.path),
        }),
      ),
    );
  },
  character: (graph: GraphContext<AllowableTypes>, file: Signal<File>) => {
    const campaign = campaignAssignment(graph)(file);
    if (campaign.value === undefined) {
      return Left.create(new Error("No campaign found"));
    }
    const fm = frontmatter(file).value;
    return fm.map((fm) => fm ?? {});
  },
};

export interface GraphContext<AllowableTypes extends Record<string, unknown>> {
  getAtom<T>(key: string): Signal<T> | undefined;
  getNode<T extends keyof AllowableTypes>(
    type: T,
    id: string,
  ): Signal<AllowableTypes[T]> | undefined;
  getAllNodes<const T extends keyof AllowableTypes>(
    type: T,
  ): Signal<Set<string>>;
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
  #subscriptions: Map<string, () => void> = new Map();

  constructor() {}

  allNodes = memoizeStrong((type: keyof AllowableTypes) =>
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
    return this.allNodes(type);
  }

  addOrUpdateFile(file: File): Signal<File> {
    const key = `@file/${file.path}`;
    const existing = this.#nodes.value.get(key) as Signal<File> | undefined;
    if (existing) {
      existing.value = { ...file };
      return existing;
    } else {
      const signal = this.addAtom(key, { ...file }, (a, b) => {
        return a.path === b.path && a.content === b.content;
      });
      // const previous = withPrevious(([last, _]) => ([signal.value, last]), [undefined, signal.value]);
      // TODO: if file path changes, we need to remove the old node
      const lastRegistered: string | undefined = undefined;
      this.#subscriptions.set(
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

  addAtom<T>(
    key: string,
    value: T,
    equalityFn?: (a: T, b: T) => boolean,
  ): Signal<T> {
    const newsig = equalityFn
      ? equalitySignal(value, equalityFn)
      : signal(value);
    this.#nodes.value = produce(this.#nodes.value, (draft) => {
      draft.set(key, newsig);
    });
    return newsig;
  }

  getAtom<T>(key: string): Signal<T> | undefined {
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
        console.debug("Ignoring duplicate node registration", key);
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
      this.#subscriptions.set(
        key,
        newsig.subscribe((value) => this.onUpdate(type, id, value)),
      );
      return newsig;
    });
  }

  removeNode(type: string, id: string) {
    // TODO: how am i notifying the subscribers in this case? manually?
    return untracked(() => {
      const key = `${type}/${id}`;
      const subscription = this.#subscriptions.get(key);
      if (subscription) {
        subscription();
        this.#subscriptions.delete(key);
      }
      this.#nodes.value.delete(key);
    });
  }

  onUpdate(type: string, id: string, value: unknown) {
    const key = `${type}/${id}`;
    console.debug(`Node ${key} updated:`, value);
  }

  getNode<T extends keyof AllowableTypes>(
    type: T,
    id: string,
  ): Signal<AllowableTypes[T]> | undefined {
    const key = `${type}/${id}`;
    return this.#nodes.value.get(key) as Signal<AllowableTypes[T]> | undefined;
  }
}
