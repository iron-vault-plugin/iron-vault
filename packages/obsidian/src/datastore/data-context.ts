import { Datasworn } from "@datasworn/core";
import { Ruleset } from "rules/ruleset";
import { VersionedMapImpl } from "utils/versioned-map";
import { SourcedMap, SourcedMapImpl, StandardIndex } from "./data-indexer";
import { DataswornIndex, DataswornTypes } from "./datasworn-indexer";
import { moveOrigin, scopeSource, scopeTags } from "./datasworn-symbols";

export interface IDataContext {
  readonly moves: StandardIndex<DataswornTypes["move"]>;
  readonly assets: StandardIndex<DataswornTypes["asset"]>;
  readonly moveCategories: StandardIndex<DataswornTypes["move_category"]>;
  readonly oracles: StandardIndex<DataswornTypes["oracle"]>;
  readonly truths: StandardIndex<DataswornTypes["truth"]>;
  readonly trackTypes: Set<string>;

  readonly rulesPackages: StandardIndex<DataswornTypes["rules_package"]>;
  readonly ruleset: Ruleset;
}

export interface ICompleteDataContext extends IDataContext {
  readonly prioritized: SourcedMap<DataswornTypes>;
}

export class MockDataContext implements IDataContext {
  readonly moves: StandardIndex<DataswornTypes["move"]>;
  readonly assets: StandardIndex<DataswornTypes["asset"]>;
  readonly moveCategories: StandardIndex<DataswornTypes["move_category"]>;
  readonly oracles: StandardIndex<DataswornTypes["oracle"]>;
  readonly truths: StandardIndex<DataswornTypes["truth"]>;

  constructor({
    moves,
    assets,
  }: {
    moves?: Datasworn.Move[];
    assets?: Datasworn.Asset[];
  }) {
    this.moves = new VersionedMapImpl(
      (moves ?? []).map((move) => [
        move._id,
        {
          ...move,
          [moveOrigin]: {},
          [scopeSource]: move._source,
          [scopeTags]: move.tags ?? {},
        },
      ]),
    );
    this.assets = new VersionedMapImpl(
      (assets ?? []).map((asset) => [
        asset._id,
        {
          ...asset,
          [scopeSource]: asset._source,
          [scopeTags]: asset.tags ?? {},
        },
      ]),
    );
    this.moveCategories = new VersionedMapImpl();
    this.oracles = new VersionedMapImpl();
    this.truths = new VersionedMapImpl();
  }

  get rulesPackages(): StandardIndex<DataswornTypes["rules_package"]> {
    throw new Error("not implemented");
  }

  get ruleset(): Ruleset {
    throw new Error("not implemented");
  }

  get trackTypes(): Set<string> {
    return trackTypesFromMoves(this.moves);
  }
}

export function trackTypesFromMoves(
  moves: StandardIndex<DataswornTypes["move"]>,
): Set<string> {
  const types = new Set<string>();
  moves.forEach((move) => {
    if (move.roll_type == "progress_roll") {
      types.add(move.tracks.category);
    }
  });
  return types;
}

// TODO(@cwegrzyn): make this cacheable
export class BaseDataContext implements ICompleteDataContext {
  readonly prioritized: SourcedMap<DataswornTypes>;

  constructor(public readonly index: DataswornIndex) {
    this.prioritized = new SourcedMapImpl<DataswornTypes, keyof DataswornTypes>(
      index,
    );
  }

  get moves() {
    return this.prioritized.ofKind("move").projected((entry) => entry.value);
  }

  get assets() {
    return this.prioritized.ofKind("asset").projected((entry) => entry.value);
  }

  get moveCategories() {
    return this.prioritized
      .ofKind("move_category")
      .projected((entry) => entry.value);
  }

  get oracles() {
    return this.prioritized.ofKind("oracle").projected((entry) => entry.value);
  }

  get truths() {
    return this.prioritized.ofKind("truth").projected((entry) => entry.value);
  }

  get rulesPackages() {
    return this.prioritized
      .ofKind("rules_package")
      .projected((entry) => entry.value);
  }

  get ruleset() {
    const rules = [...this.prioritized.ofKind("rules_package").values()].map(
      ({ value }) => value,
    );
    return Ruleset.fromActiveRulesPackages(rules).unwrapOrElse((e) => {
      throw new Error(`Playset produced invalid ruleset: ${e.message}`);
    });
  }

  get trackTypes() {
    return trackTypesFromMoves(this.moves);
  }
}
