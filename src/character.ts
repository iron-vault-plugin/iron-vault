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

export interface MeasureSetUtils<T extends MeasureSpec> {
  get specs(): T;
  value: (key: keyof T) => number | null;
  setValue: (key: keyof T, newValue: number | null) => void;
  keys: () => Array<keyof T>; // TODO: maybe use iterator, but do they support map/reduce yet?
  entries: () => Array<{
    key: keyof T;
    value: number | null;
    definition: Measure;
  }>;
}

export type MeasureSet<T extends MeasureSpec> = {
  [P in keyof T]: number;
} & MeasureSetUtils<T>;

export type IrowswornMeasureSet = MeasureSet<typeof IronswornMeasures>;

export function createMeasureSetImpl<T extends MeasureSpec>(
  measureClass: T,
): new (data: any, changeMap?: Map<string, any>) => MeasureSet<T> {
  return class MeasureSetImpl implements MeasureSetUtils<T> {
    constructor(
      protected readonly _data: any,
      public readonly changeMap: Map<string, any> = new Map(),
    ) {
      for (const name of Object.keys(measureClass)) {
        Object.defineProperty(this, name, {
          enumerable: true,
          get: () => this.value(name),
          set: (newValue: any) => {
            this.setValue(name, newValue);
          },
        });
      }
    }

    setValue(key: keyof T, newValue: number | null): void {
      const stringKey = String(key);
      newValue = Number.isInteger(newValue)
        ? newValue
        : typeof newValue === "string"
        ? Number.parseInt(newValue)
        : NaN;
      if (Number.isNaN(newValue)) {
        throw new TypeError(`${stringKey} must be an integer.`);
      }
      if (this.originalValue(stringKey) === newValue) {
        this.changeMap.delete(stringKey);
      } else {
        this.changeMap.set(stringKey, newValue);
      }
    }

    originalValue(key: string): number | null {
      return Number.isInteger(this._data[key])
        ? this._data[key]
        : typeof this._data[key] === "string"
        ? Number.parseInt(this._data[key])
        : null;
    }

    value(key: keyof T): number | null {
      return (
        this.changeMap.get(key.toString()) ?? this.originalValue(key.toString())
      );
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
  } as new (...args: any[]) => MeasureSet<T>;
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

function parseImpact(val: string): Impact | undefined {
  val = val.trim();
  if (val === "0" || val === "⬡") {
    return Impact.Unmarked;
  } else if (val === "1" || val === "⬢") {
    return Impact.Marked;
  } else {
    return undefined;
  }
}

export interface Measured<T extends MeasureSpec> {
  measures: MeasureSet<T>;
}

export interface CharacterMetadata {
  name: string;
}

class UnwritableMap<K, V> extends Map<K, V> {
  set(key: K, value: V): this {
    throw new Error(`attempt to write key ${key} to unwritable map`);
  }
  clear(): void {
    throw new Error("attempt to clear unwritable map");
  }
  delete(key: K): boolean {
    throw new Error(`attempt to delete key ${key} to unwritable map`);
  }
}

export class CharacterWrapper {
  constructor(
    protected readonly _data: Record<string, any>,
    protected readonly _validatedSheets: Set<
      CharacterMetadataFactory<CharacterMetadata>
    >,
  ) {}

  as<T extends CharacterMetadata>(kls: CharacterMetadataFactory<T>): T {
    return this.forUpdates(kls, this._data, new UnwritableMap());
  }

  forUpdates<T extends CharacterMetadata>(
    kls: CharacterMetadataFactory<T>,
    data: Record<string, any>,
    changes: Map<string, any>,
  ): T {
    if (!this._validatedSheets.has(kls)) {
      throw new Error(`requested character sheet ${kls} not in validated list`);
    }
    return new kls(data, changes);
  }
}

export type CharacterMetadataFactory<T extends CharacterMetadata> = new (
  _data: Record<string, any>,
  changes: Map<string, any>,
) => T;

export const IronswornMeasureSetImpl = createMeasureSetImpl(IronswornMeasures);
export class IronswornCharacterMetadata
  implements Measured<typeof IronswornMeasures>, CharacterMetadata
{
  protected _measures: MeasureSet<typeof IronswornMeasures>;

  constructor(
    public readonly _data: Record<string, any>,
    public readonly changes: Map<string, any> = new Map(),
  ) {
    this._measures = new IronswornMeasureSetImpl(this._data, this.changes);
  }

  public get measures(): MeasureSet<typeof IronswornMeasures> {
    return this._measures;
  }

  public get name(): string {
    return this._data.name;
  }

  get impacts(): Map<string, Impact | undefined> {
    return new Map(
      IRONSWORN_IMPACTS.map((impactKey) => [
        impactKey,
        parseImpact(this._data[impactKey]),
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
