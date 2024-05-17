import { Ruleset } from "@datasworn/core";
import data from "@datasworn/starforged/json/starforged.json";
import { OracleGrouping, OracleGroupingType } from "../../model/oracle";
import { indexIntoOracleMap } from "./dataforged";

describe("indexIntoOracleMap", () => {
  it("indexes included starforged data", () => {
    const map = indexIntoOracleMap(data as Ruleset);
    expect(map.get("starforged/oracles/core/action")).toHaveProperty(
      "id",
      "starforged/oracles/core/action",
    );
  });

  it("indexes each Ask The Oracle entry", () => {
    const map = indexIntoOracleMap(data as Ruleset);
    const almostCertain = map.get(
      "starforged/oracles/moves/ask_the_oracle/almost_certain",
    )!;
    expect(almostCertain.name).toEqual("Almost Certain");
    expect(almostCertain.parent).toEqual<OracleGrouping>({
      grouping_type: OracleGroupingType.Collection,
      id: "starforged/collections/oracles/moves/ask_the_oracle",
      name: "Ask the Oracle",
      parent: {
        grouping_type: OracleGroupingType.Collection,
        id: "starforged/collections/oracles/moves",
        name: "Move Oracles",
        parent: {
          grouping_type: OracleGroupingType.Ruleset,
          id: "starforged",
          name: "Ironsworn: Starforged Rulebook",
        },
      },
    });
  });
});
