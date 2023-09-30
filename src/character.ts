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

    value(key: string): number | null {
      return this.changeMap.get(key) ?? this.originalValue(key);
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

export class CharacterMetadata {
  public changes: Map<string, any>;

  constructor(public readonly _data: any) {
    this.changes = new Map();
  }

  public measures<T extends MeasureSpec>(measureClass: T): MeasureSet<T> {
    return new (createMeasureSetImpl(measureClass))(this._data, this.changes);
  }

  get name(): string {
    return this._data.name;
  }
}
