import { OracleCollection, Ruleset } from "@datasworn/core";
import assert from "assert";
import { OracleGrouping, OracleGroupingType } from "../../../model/oracle";
import { DataswornOracle } from "./oracles";

const data = require("@datasworn/starforged/json/starforged.json") as Ruleset;

function loadOracle(...[first, ...rest]: string[]): DataswornOracle {
  let collection: OracleCollection = data.oracles[first];
  const tableName = rest.pop();
  assert(tableName != null);

  let grouping: OracleGrouping = {
    grouping_type: OracleGroupingType.Ruleset,
    id: data.id,
    name: data.id,
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
      id: collection.id,
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
      expect(
        fringeOracle.row("starforged/oracles/factions/fringe_group/16-25"),
      ).toEqual({
        id: "starforged/oracles/factions/fringe_group/16-25",
        result: "Gangsters",
        range: { min: 16, max: 25 },
        template: undefined,
      });
    });
    it("throws error for missing row", () => {
      const fringeOracle = loadOracle("factions", "fringe_group");
      expect(() =>
        fringeOracle.row("starforged/oracles/factions/fringe_group/101-102"),
      ).toThrow("missing row starforged/oracles/factions/fringe_group/101-102");
    });
  });

  // TODO: roll tests
});
