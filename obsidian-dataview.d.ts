import { type App } from "obsidian";

declare module "obsidian-dataview" {
  // type ArrayFunc<T, O> = (elem: T, index: number, arr: T[]) => O;

  // /** A function which compares two types. */
  // export type ArrayComparator<T> = (a: T, b: T) => number;

  // /** Finds the value of the lowest value type in a grouping. */
  // export type LowestKey<T> = T extends { key: any; rows: any }
  //   ? LowestKey<T["rows"][0]>
  //   : T;

  // /** A ridiculous type which properly types the result of the 'groupIn' command. */
  // export type Ingrouped<U, T> = T extends { key: any; rows: any }
  //   ? { key: T["key"]; rows: Ingrouped<U, T["rows"][0]> }
  //   : { key: U; rows: T[] };

  /**
   * Proxied interface which allows manipulating array-based data. All functions on a data array produce a NEW array
   * (i.e., the arrays are immutable).
   */
  // interface DataArray<T> {
  //   /** The total number of elements in the array. */
  //   length: number;

  //   // /** Filter the data array down to just elements which match the given predicate. */
  //   where(predicate: ArrayFunc<T, boolean>): DataArray<T>;
  //   // /** Alias for 'where' for people who want array semantics. */
  //   // filter(predicate: ArrayFunc<T, boolean>): DataArray<T>;

  //   // /** Map elements in the data array by applying a function to each. */
  //   // map<U>(f: ArrayFunc<T, U>): DataArray<U>;
  //   // /** Map elements in the data array by applying a function to each, then flatten the results to produce a new array. */
  //   // flatMap<U>(f: ArrayFunc<T, U[]>): DataArray<U>;
  //   // /** Mutably change each value in the array, returning the same array which you can further chain off of. */
  //   // mutate(f: ArrayFunc<T, void>): DataArray<T>;

  //   // /** Limit the total number of entries in the array to the given value. */
  //   // limit(count: number): DataArray<T>;
  //   // /**
  //   //  * Take a slice of the array. If `start` is undefined, it is assumed to be 0; if `end` is undefined, it is assumbed
  //   //  * to be the end of the array.
  //   //  */
  //   // slice(start?: number, end?: number): DataArray<T>;
  //   // /** Concatenate the values in this data array with those of another iterable / data array / array. */
  //   // concat(other: Iterable<T>): DataArray<T>;

  //   // /** Return the first index of the given (optionally starting the search) */
  //   // indexOf(element: T, fromIndex?: number): number;
  //   // /** Return the first element that satisfies the given predicate. */
  //   // find(pred: ArrayFunc<T, boolean>): T | undefined;
  //   // /** Find the index of the first element that satisfies the given predicate. Returns -1 if nothing was found. */
  //   // findIndex(pred: ArrayFunc<T, boolean>, fromIndex?: number): number;
  //   // /** Returns true if the array contains the given element, and false otherwise. */
  //   // includes(element: T): boolean;

  //   // /**
  //   //  * Return a string obtained by converting each element in the array to a string, and joining it with the
  //   //  * given separator (which defaults to ', ').
  //   //  */
  //   // join(sep?: string): string;

  //   // /**
  //   //  * Return a sorted array sorted by the given key; an optional comparator can be provided, which will
  //   //  * be used to compare the keys in leiu of the default dataview comparator.
  //   //  */
  //   // sort<U>(
  //   //   key: ArrayFunc<T, U>,
  //   //   direction?: "asc" | "desc",
  //   //   comparator?: ArrayComparator<U>,
  //   // ): DataArray<T>;

  //   // /**
  //   //  * Mutably modify the current array with an in place sort; this is less flexible than a regular sort in exchange
  //   //  * for being a little more performant. Only use this is performance is a serious consideration.
  //   //  */
  //   // sortInPlace<U>(
  //   //   key: (v: T) => U,
  //   //   direction?: "asc" | "desc",
  //   //   comparator?: ArrayComparator<U>,
  //   // ): DataArray<T>;

  //   // /**
  //   //  * Return an array where elements are grouped by the given key; the resulting array will have objects of the form
  //   //  * { key: <key value>, rows: DataArray }.
  //   //  */
  //   // groupBy<U>(
  //   //   key: ArrayFunc<T, U>,
  //   //   comparator?: ArrayComparator<U>,
  //   // ): DataArray<{ key: U; rows: DataArray<T> }>;

  //   // /**
  //   //  * If the array is not grouped, groups it as `groupBy` does; otherwise, groups the elements inside each current
  //   //  * group. This allows for top-down recursive grouping which may be easier than bottom-up grouping.
  //   //  */
  //   // groupIn<U>(
  //   //   key: ArrayFunc<LowestKey<T>, U>,
  //   //   comparator?: ArrayComparator<U>,
  //   // ): DataArray<Ingrouped<U, T>>;

  //   // /**
  //   //  * Return distinct entries. If a key is provided, then rows with distinct keys are returned.
  //   //  */
  //   // distinct<U>(
  //   //   key?: ArrayFunc<T, U>,
  //   //   comparator?: ArrayComparator<U>,
  //   // ): DataArray<T>;

  //   // /** Return true if the predicate is true for all values. */
  //   // every(f: ArrayFunc<T, boolean>): boolean;
  //   // /** Return true if the predicate is true for at least one value. */
  //   // some(f: ArrayFunc<T, boolean>): boolean;
  //   // /** Return true if the predicate is FALSE for all values. */
  //   // none(f: ArrayFunc<T, boolean>): boolean;

  //   // /** Return the first element in the data array. Returns undefined if the array is empty. */
  //   // first(): T;
  //   // /** Return the last element in the data array. Returns undefined if the array is empty. */
  //   // last(): T;

  //   // /** Map every element in this data array to the given key, and then flatten it.*/
  //   // to(key: string): DataArray<any>;
  //   // /** Map every element in this data array to the given key; unlike to(), does not flatten the result. */
  //   // into(key: string): DataArray<any>;

  //   // /**
  //   //  * Recursively expand the given key, flattening a tree structure based on the key into a flat array. Useful for handling
  //   //  * heirarchical data like tasks with 'subtasks'.
  //   //  */
  //   // expand(key: string): DataArray<any>;

  //   // /** Run a lambda on each element in the array. */
  //   // forEach(f: ArrayFunc<T, void>): void;

  //   // /** Convert this to a plain javascript array. */
  //   // array(): T[];

  //   // /** Allow iterating directly over the array. */
  //   // [Symbol.iterator](): Iterator<T>;

  //   /** Map indexes to values. */
  //   // [index: number]: any;
  //   /** Automatic flattening of fields. Equivalent to implicitly calling `array.to("field")` */
  //   // [field: string]: any;
  // }

  // class DataviewApi {
  //   pagePaths(query?: string, originFile?: string): any; // DataArray<string>;
  // }
  // function getAPI(app?: App): DataviewApi | undefined;

  /** Determine if Dataview is enabled in the given application. */
  function isPluginEnabled(app: App): boolean;
}
