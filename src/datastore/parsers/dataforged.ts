import {
  Asset,
  Move,
  OracleBase,
  OracleSet,
  OracleTable,
  Starforged,
} from "dataforged";
import { DataIndex } from "datastore/data-index";

export function indexDataForgedData(
  index: DataIndex,
  normalizedPath: string,
  priority: number,
  data: Starforged,
): void {
  index.indexSource(normalizedPath, priority, {
    oracles: indexIntoOracleMap(data),
    moves: Object.values(data["Move categories"] ?? []).flatMap(
      (category): Array<[string, Move]> =>
        Object.values(category.Moves).map((m) => [m.$id, m]),
    ),
    assets: Object.values(data["Asset types"] ?? []).flatMap(
      (category): Array<[string, Asset]> =>
        Object.values(category.Assets).map((asset) => [asset.$id, asset]),
    ),
  });
}

type OracleMap = Map<string, OracleTable | OracleSet>;

export function indexIntoOracleMap(data: Starforged): OracleMap {
  const index = new Map();
  function expand(oracleBase: OracleBase, prefix: string[]): void {
    index.set(oracleBase.$id, oracleBase);
    if (oracleBase.Sets != null) {
      for (const [name, set] of Object.entries(oracleBase.Sets)) {
        expand(set, prefix.concat([name]));
      }
    }
    if (oracleBase.Tables != null) {
      for (const [name, set] of Object.entries(oracleBase.Tables)) {
        expand(set, prefix.concat(name));
      }
    }
  }
  if (data?.["Oracle sets"] == null) {
    throw new Error("Oracle data seems to be missing");
  }
  for (const [name, set] of Object.entries(data["Oracle sets"])) {
    expand(set, [name]);
  }
  return index;
}
