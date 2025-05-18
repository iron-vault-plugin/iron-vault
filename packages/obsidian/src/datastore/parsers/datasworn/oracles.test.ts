import { type Datasworn } from "@datasworn/core";
import assert from "assert";
import { OracleGrouping, OracleGroupingType } from "../../../model/oracle";
import { DataswornOracle } from "./oracles";

import rawSfData from "@datasworn/starforged/json/starforged.json" with { type: "json" };
import { scopeSource, scopeTags } from "datastore/datasworn-symbols";
import merge from "lodash.merge";

// @ts-expect-error Type inference of the raw SF json data seems to end up not matching Datasworn types.
// Hoping it will be corrected in future tsc.
const data = rawSfData as Datasworn.Ruleset;

function loadOracle(...path: string[]): DataswornOracle {
  assert(path.length >= 2, "must have at least a collection and a table");
  const tableName = path.pop();
  assert(tableName != null);

  let grouping: OracleGrouping = {
    grouping_type: OracleGroupingType.Ruleset,
    id: data._id,
    name: data._id,
  };
  let contents: Record<string, Datasworn.OracleCollection> | null =
    data.oracles;
  let name: string | undefined;
  let collection!: Datasworn.OracleCollection;
  while ((name = path.shift()) != null) {
    assert(contents != null);
    assert(name in contents, `expected ${name} to be in collection`);
    collection = contents[name];
    grouping = {
      grouping_type: OracleGroupingType.Collection,
      name: collection.name,
      id: collection._id,
      parent: grouping,
      [scopeSource]: collection._source,
      [scopeTags]: collection.tags ?? {},
    };
    contents = "collections" in collection ? collection.collections : null;
  }

  assert(collection?.oracle_type == "tables", "expected tables oracle");
  assert(
    collection.contents != null,
    "expected final step to include contents",
  );
  assert(
    grouping.grouping_type == OracleGroupingType.Collection,
    `unexpected grouping type ${grouping.grouping_type}`,
  );
  assert(tableName in collection.contents, `expected ${tableName} in contents`);

  return new DataswornOracle(
    collection.contents[tableName],
    grouping,
    merge({}, collection.tags, collection.contents[tableName].tags ?? {}),
  );
}

describe("DataswornOracle", () => {
  describe(".row", () => {
    it("returns a row of the oracle", () => {
      const fringeOracle = loadOracle("faction", "fringe_group");
      expect(fringeOracle.row(18)).toEqual({
        result: "Gangsters",
        range: { min: 16, max: 25 },
        template: undefined,
      });
    });
    it("throws error for missing row", () => {
      const fringeOracle = loadOracle("faction", "fringe_group");
      expect(() => fringeOracle.row(101)).toThrow(
        "roll 101 is off the charts for oracle_rollable:starforged/faction/fringe_group",
      );
    });
  });

  // TODO: roll tests
});
