import { indexIntoOracleMap } from "./dataforged";
const data = require("@datasworn/starforged/json/starforged.json");

describe("indexIntoOracleMap", () => {
  it("indexes included starforged data", () => {
    const map = indexIntoOracleMap(data);
    expect(map.get("starforged/oracles/core/action")).toHaveProperty(
      "id",
      "starforged/oracles/core/action",
    );
  });

  it("indexes each Ask The Oracle entry", () => {
    const map = indexIntoOracleMap(data);
    expect(
      map.get("starforged/oracles/moves/ask_the_oracle/almost_certain"),
    ).toHaveProperty("name", "Ask the Oracle: Almost Certain");
    expect(
      map.get("starforged/oracles/moves/ask_the_oracle/almost_certain"),
    ).toHaveProperty(
      "parentId",
      "starforged/collections/oracles/moves/ask_the_oracle",
    );
    expect(
      map.get("starforged/oracles/moves/ask_the_oracle/almost_certain"),
    ).toHaveProperty("category", "Move Oracles / Ask the Oracle");
  });
});
