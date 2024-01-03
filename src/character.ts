import { Asset, Move } from "@datasworn/core";
import { DataIndex } from "datastore/data-index";
import { Immutable, immerable, produce } from "immer";
import { z } from "zod";

interface Measure {
  /** Kind of measure. Meters change; stats do not. */
  kind: "meter" | "stat";

  /** Internal ID */
  id: string;

  /** How should we show this in the UI? */
  label: string;

  /** Where does this live in frontmatter data? */
  dataPath: string;
}

export type MeasureSpec = Record<string, Measure>;

export const IronswornMeasures = {
  heart: {
    kind: "stat",
    id: "heart",
    label: "Heart",
    dataPath: "heart",
  },
  wits: {
    kind: "stat",
    id: "wits",
    label: "Wits",
    dataPath: "wits",
  },
  shadow: {
    kind: "stat",
    id: "shadow",
    label: "Shadow",
    dataPath: "shadow",
  },
  edge: {
    kind: "stat",
    id: "edge",
    label: "Edge",
    dataPath: "edge",
  },
  iron: {
    kind: "stat",
    id: "iron",
    label: "Iron",
    dataPath: "iron",
  },
  momentum: {
    kind: "meter",
    id: "momentum",
    label: "Momentum",
    dataPath: "momentum",
  },
  health: {
    kind: "meter",
    id: "health",
    label: "Health",
    dataPath: "health",
  },
  spirit: {
    kind: "meter",
    id: "spirit",
    label: "Spirit",
    dataPath: "spirit",
  },
  supply: {
    kind: "meter",
    id: "supply",
    label: "Supply",
    dataPath: "supply",
  },
} satisfies MeasureSpec;

export function schemaFromSpec(spec: MeasureSpec) {
  const schemas: Record<string, z.ZodTypeAny> = {};
  for (const [key, _measure] of Object.entries(spec)) {
    schemas[key] = z.number();
  }
  return schemas;
}

export interface BaseMeasureSetUtils<T extends MeasureSpec> {
  get specs(): T;
  value: (key: keyof T) => number | null;
  keys: () => Array<keyof T>; // TODO: maybe use iterator, but do they support map/reduce yet?
  entries: () => Array<{
    key: keyof T;
    value: number | null;
    definition: Measure;
  }>;
}

export interface ReadonlyMeasureSetUtils<T extends MeasureSpec>
  extends BaseMeasureSetUtils<T> {}

export interface MeasureSetUtils<T extends MeasureSpec, U>
  extends BaseMeasureSetUtils<T> {
  set: (key: keyof T, newValue: number | null) => U;
}

export type MeasureSet<T extends MeasureSpec, U> = {
  readonly [P in keyof T]: number;
} & MeasureSetUtils<T, U>;

export type ReadonlyMeasureSet<T extends MeasureSpec> = {
  readonly [P in keyof T]: number;
} & ReadonlyMeasureSetUtils<T>;

export type IrowswornMeasureSet<U> = MeasureSet<typeof IronswornMeasures, U>;

export function createMeasureSetImpl<T extends MeasureSpec>(
  measureClass: T,
): [
  new (data: any) => ReadonlyMeasureSet<T>,
  new <U>(data: any, build: (data: any) => U) => MeasureSet<T, U>,
] {
  const base = class implements BaseMeasureSetUtils<T> {
    constructor(protected readonly _data: any) {
      for (const name of Object.keys(measureClass)) {
        Object.defineProperty(this, name, {
          enumerable: true,
          get: () => this.value(name),
          // set: (newValue: any) => {
          //   this.setValue(name, newValue);
          // },
        });
      }
    }
    value(key: keyof T): number | null {
      return Number.isInteger(this._data[key])
        ? this._data[key]
        : typeof this._data[key] === "string"
          ? Number.parseInt(this._data[key])
          : null;
    }

    get specs(): T {
      return measureClass;
    }

    keys(): string[] {
      return Object.keys(measureClass);
    }

    entries(): Array<{
      key: string;
      value: number | null;
      definition: Measure;
    }> {
      return Object.entries(measureClass).map(([key, definition]) => ({
        key,
        value: this.value(key),
        definition,
      }));
    }
  };
  const immutable = class extends base implements ReadonlyMeasureSetUtils<T> {};
  const mutable = class<U> extends base implements MeasureSetUtils<T, U> {
    constructor(
      data: any,
      protected readonly build: (data: any) => U,
    ) {
      super(data);
    }
    set(key: keyof T, newValue: number | null): U {
      const stringKey = String(key);
      newValue = Number.isInteger(newValue)
        ? newValue
        : typeof newValue === "string"
          ? Number.parseInt(newValue)
          : NaN;
      if (Number.isNaN(newValue)) {
        throw new TypeError(`${stringKey} must be an integer.`);
      }
      return this.build(
        produce(this._data, (draft: any) => {
          draft[stringKey] = newValue;
        }),
      );
    }
  };
  return [
    immutable as new (data: any) => ReadonlyMeasureSet<T>,
    mutable as new <U>(data: any, build: (data: any) => U) => MeasureSet<T, U>,
  ];
}

export enum Impact {
  Unmarked = 0,
  Marked = 1,
}

export const IRONSWORN_IMPACTS = [
  "Wounded",
  "Shaken",
  "Unprepared",
  "Harmed",
  "Traumatized",
  "Doomed",
  "Tormented",
  "Indebted",
];

function parseImpact(val: string | undefined): Impact | undefined {
  val = val?.trim();
  if (val === "0" || val === "⬡") {
    return Impact.Unmarked;
  } else if (val === "1" || val === "⬢") {
    return Impact.Marked;
  } else {
    return undefined;
  }
}

// export interface Measured<T extends MeasureSpec> {
//   measures: MeasureSet<T>;
// }

export interface CharacterMetadata {
  name: string;
  readonly data: Readonly<Record<string, any>>;
}

export interface IronswornCharacterAsset {
  id: string;
  marked_abilities?: number[];
  condition_meter?: number;
  marked_conditions?: string[];
  marked_states?: string[];
  inputs?: Record<string, any>;
}

export type CharacterMetadataFactory<T extends CharacterMetadata> = new (
  _data: Record<string, any>,
  _index: DataIndex,
) => T;

export class IronswornAssetWrapper {
  constructor(
    public readonly _assetData: IronswornCharacterAsset,
    public readonly _index: DataIndex,
  ) {}

  get definition(): Asset {
    const val = this._index._assetIndex.get(this._assetData.id);
    if (val == null) {
      throw new Error(`missing asset ${this._assetData.id}`);
    }
    return val;
  }

  get moves(): Move[] {
    const moveList = [];
    const defn = this.definition;
    const marked_abilities = this._assetData.marked_abilities ?? [];
    for (const [idx, ability] of defn.abilities.entries()) {
      if (marked_abilities.includes(idx + 1)) {
        moveList.push(...Object.values(ability.moves ?? {}));
      }
    }
    return moveList;
  }
}

// const characterSchema = z.object({
//   name: z.string(),
//   momentum: z.number().optional(),
// });

export const [
  ImmutableIronswornMeasureSetImpl,
  MutableIronswornMeasureSetImpl,
] = createMeasureSetImpl(IronswornMeasures);
export class IronswornCharacterMetadata implements CharacterMetadata {
  // implements Measured<typeof IronswornMeasures>
  [immerable] = true;

  constructor(
    public readonly data: Immutable<Record<string, any>>,
    public readonly _index: DataIndex,
  ) {}

  public get measures(): MeasureSet<
    typeof IronswornMeasures,
    IronswornCharacterMetadata
  > {
    return new MutableIronswornMeasureSetImpl(
      this.data,
      (data: any) => new IronswornCharacterMetadata(data, this._index),
    );
  }

  public get name(): string {
    return this.data.name;
  }

  public get assets(): IronswornCharacterAsset[] {
    return this.data.assets ?? [];
  }

  public get moves(): Move[] {
    return this.assets.flatMap(
      (asset) => new IronswornAssetWrapper(asset, this._index).moves,
    );
  }

  get impacts(): Map<string, Impact | undefined> {
    return new Map(
      IRONSWORN_IMPACTS.map((impactKey) => [
        impactKey,
        parseImpact(this.data[impactKey]),
      ]),
    );
  }

  get markedImpacts(): Set<string> {
    const marked = new Set<string>();
    for (const [key, status] of this.impacts.entries()) {
      if (status === Impact.Marked) {
        marked.add(key);
      }
    }
    return marked;
  }

  // TODO: are there assets that change this?
  get momentumReset(): number {
    const numMarked = this.markedImpacts.size;
    if (numMarked == 0) {
      return 2;
    } else if (numMarked == 1) {
      return 1;
    } else {
      return 0;
    }
  }

  // TODO: are there assets that change this?
  get maxMomentum(): number {
    return Math.max(0, 10 - this.markedImpacts.size);
  }
}
