/**
 * Tests for typed Datasworn package imports.
 *
 * These tests verify that the typed exports from Datasworn packages work correctly
 * without requiring `as unknown as` type assertions.
 */
import { describe, expect, it } from "vitest";
import { type Datasworn } from "@datasworn/core";

// Import typed exports - these should work without type assertions
import { classic } from "@datasworn/ironsworn-classic";
import { delve } from "@datasworn/ironsworn-classic-delve";
import { starforged } from "@datasworn/starforged";
import { sundered_isles } from "@datasworn/sundered-isles";
import { ancient_wonders } from "@datasworn-community-content/ancient-wonders";
import { fe_runners } from "@datasworn-community-content/fe-runners";
import { starsmith } from "@datasworn-community-content/starsmith";

describe("Typed Datasworn Imports", () => {
  describe("Rulesets", () => {
    it("classic is typed as Datasworn.Ruleset", () => {
      // TypeScript compilation proves the type is correct
      const ruleset: Datasworn.Ruleset = classic;
      expect(ruleset.type).toBe("ruleset");
      expect(ruleset._id).toBe("classic");
      expect(ruleset.title).toBeDefined();
    });

    it("starforged is typed as Datasworn.Ruleset", () => {
      const ruleset: Datasworn.Ruleset = starforged;
      expect(ruleset.type).toBe("ruleset");
      expect(ruleset._id).toBe("starforged");
      expect(ruleset.title).toBeDefined();
    });
  });

  describe("Expansions", () => {
    it("delve is typed as Datasworn.Expansion", () => {
      const expansion: Datasworn.Expansion = delve;
      expect(expansion.type).toBe("expansion");
      expect(expansion._id).toBe("delve");
      expect(expansion.ruleset).toBe("classic");
    });

    it("sundered_isles is typed as Datasworn.Expansion", () => {
      const expansion: Datasworn.Expansion = sundered_isles;
      expect(expansion.type).toBe("expansion");
      expect(expansion._id).toBe("sundered_isles");
      expect(expansion.ruleset).toBe("starforged");
    });

    it("ancient_wonders is typed as Datasworn.Expansion", () => {
      const expansion: Datasworn.Expansion = ancient_wonders;
      expect(expansion.type).toBe("expansion");
      expect(expansion._id).toBe("ancient_wonders");
      expect(expansion.ruleset).toBe("starforged");
    });

    it("fe_runners is typed as Datasworn.Expansion", () => {
      const expansion: Datasworn.Expansion = fe_runners;
      expect(expansion.type).toBe("expansion");
      expect(expansion._id).toBe("fe_runners");
      expect(expansion.ruleset).toBe("starforged");
    });

    it("starsmith is typed as Datasworn.Expansion", () => {
      const expansion: Datasworn.Expansion = starsmith;
      expect(expansion.type).toBe("expansion");
      expect(expansion._id).toBe("starsmith");
      expect(expansion.ruleset).toBe("starforged");
    });
  });

  describe("Type compatibility with RulesPackage", () => {
    it("all packages can be used as RulesPackage without assertions", () => {
      // This is the key test - these assignments should work without `as unknown as`
      const packages: Datasworn.RulesPackage[] = [
        classic,
        delve,
        starforged,
        sundered_isles,
        ancient_wonders,
        fe_runners,
        starsmith,
      ];

      expect(packages).toHaveLength(7);
      packages.forEach((pkg) => {
        expect(pkg._id).toBeDefined();
        expect(pkg.title).toBeDefined();
        expect(["ruleset", "expansion"]).toContain(pkg.type);
      });
    });
  });
});
