import { type Datasworn } from "@datasworn/core";
import assert from "assert";
import { OracleGrouping, OracleGroupingType } from "../../../model/oracle";
import { DataswornOracle } from "./oracles";

import rawSfData from "@datasworn/starforged/json/starforged.json" with { type: "json" };

const data = rawSfData as Datasworn.Ruleset;

function loadOracle(...[first, ...rest]: string[]): DataswornOracle {
  let collection: Datasworn.OracleCollection = data.oracles[first];
  const tableName = rest.pop();
  assert(tableName != null);

  let grouping: OracleGrouping = {
    grouping_type: OracleGroupingType.Ruleset,
    id: data._id,
    name: data._id,
  };

  let name: string | undefined;
  while ((name = rest.shift()) != null) {
    assert(collection != null);
    assert(collection.oracle_type == "tables", "expected tables oracle");
    assert(
      collection.collections && name in collection.collections,
      `expected ${name} to be in collection`,
    );
    grouping = {
      grouping_type: OracleGroupingType.Collection,
      name: collection.name,
      id: collection._id,
      parent: grouping,
    };
    collection = collection.collections[name];
  }

  assert(
    collection.contents != null,
    "expected final step to include contents",
  );
  assert(tableName in collection.contents, `expected ${tableName} in contents`);

  return new DataswornOracle(collection.contents[tableName], grouping);
}

describe("DataswornOracle", () => {
  describe(".row", () => {
    it("returns a row of the oracle", () => {
      const fringeOracle = loadOracle("factions", "fringe_group");
      expect(fringeOracle.row(18)).toEqual({
        result: "Gangsters",
        range: { min: 16, max: 25 },
        template: undefined,
      });
    });
    it("throws error for missing row", () => {
      const fringeOracle = loadOracle("factions", "fringe_group");
      expect(() => fringeOracle.row(101)).toThrow(
        "roll 101 is off the charts for starforged/oracles/factions/fringe_group",
      );
    });
  });

  // TODO: roll tests
});
