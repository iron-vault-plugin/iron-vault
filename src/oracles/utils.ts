import { type OracleBase } from "dataforged";
import { type OracleIndex } from "datastore/data-index";

export function formatOraclePath(
  index: OracleIndex,
  oracle: OracleBase,
): string {
  const parts = oracle.Ancestors.map(
    (id) => index.get(id)?.Title.Standard ?? "??",
  );
  parts.push(oracle.Title.Standard);
  return parts.join(" / ");
}
