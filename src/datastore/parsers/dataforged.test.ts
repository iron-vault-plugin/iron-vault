import { indexIntoOracleMap } from "./dataforged";
const data = require("@datasworn/starforged/json/starforged.json");

describe("indexIntoOracleMap", () => {
  it("indexes included starforged data", () => {
    const map = indexIntoOracleMap(data);
    expect(map.get("starforged/oracles/core/action")).toHaveProperty(
      "oracle_type",
      "table_simple",
    );
  });
});
