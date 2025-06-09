import { Oracle, OracleGrouping, OracleGroupingType } from "../model/oracle";

export function oracleNameWithParents(oracle: Oracle): string {
  const steps = [oracle.name];
  let next: OracleGrouping = oracle.parent;
  while (next && next.grouping_type != OracleGroupingType.Ruleset) {
    steps.unshift(next.name);
    next = next.parent;
  }
  return steps.join(" / ");
}
