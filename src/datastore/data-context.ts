import { Datasworn } from "@datasworn/core";
import { Asset, Rules } from "@datasworn/core/dist/Datasworn";
import merge from "lodash.merge";
import { OracleRoller } from "oracles/roller";
import { Ruleset } from "rules/ruleset";
import { VersionedMapImpl } from "utils/versioned-map";
import { SourcedMap, SourcedMapImpl, StandardIndex } from "./data-indexer";
import {
  DataswornIndex,
  DataswornTypes,
  moveOrigin,
  MoveWithSelector,
} from "./datasworn-indexer";

export interface IDataContext {
  readonly moves: StandardIndex<DataswornTypes["move"]>;
  readonly assets: StandardIndex<DataswornTypes["asset"]>;
  readonly moveCategories: StandardIndex<DataswornTypes["move_category"]>;
  readonly moveRulesets: StandardIndex<DataswornTypes["move_ruleset"]>;
  readonly oracles: StandardIndex<DataswornTypes["oracle"]>;
  readonly truths: StandardIndex<DataswornTypes["truth"]>;

  readonly roller: OracleRoller;
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
  readonly moveRulesets: StandardIndex<DataswornTypes["move_ruleset"]>;
  readonly oracles: StandardIndex<DataswornTypes["oracle"]>;
  readonly truths: StandardIndex<DataswornTypes["truth"]>;

  constructor({
    moves,
    assets,
  }: {
    moves?: Datasworn.AnyMove[];
    assets?: Datasworn.Asset[];
  }) {
    this.moves = new VersionedMapImpl(
      (moves ?? []).map((move) => [move._id, { ...move, [moveOrigin]: {} }]),
    );
    this.assets = new VersionedMapImpl(
      (assets ?? []).map((asset) => [asset._id, asset]),
    );
    this.moveCategories = new VersionedMapImpl();
    this.moveRulesets = new VersionedMapImpl();
    this.oracles = new VersionedMapImpl();
    this.truths = new VersionedMapImpl();
  }

  get rulesPackages(): StandardIndex<DataswornTypes["rules_package"]> {
    throw new Error("not implemented");
  }

  get ruleset(): Ruleset {
    throw new Error("not implemented");
  }

  get roller() {
    return new OracleRoller(this.oracles);
  }
}

// TODO(@cwegrzyn): make this cacheable
export class BaseDataContext implements ICompleteDataContext {
  readonly prioritized: SourcedMap<DataswornTypes>;

  constructor(public readonly index: DataswornIndex) {
    this.prioritized = new SourcedMapImpl<DataswornTypes, keyof DataswornTypes>(
      index,
    );
  }

  get moves(): StandardIndex<MoveWithSelector> {
    return this.prioritized.ofKind("move").projected((entry) => entry.value);
  }

  get assets(): StandardIndex<Asset> {
    return this.prioritized.ofKind("asset").projected((entry) => entry.value);
  }

  get moveCategories(): StandardIndex<DataswornTypes["move_category"]> {
    return this.prioritized
      .ofKind("move_category")
      .projected((entry) => entry.value);
  }

  get moveRulesets(): StandardIndex<DataswornTypes["move_ruleset"]> {
    return this.prioritized
      .ofKind("move_ruleset")
      .projected((entry) => entry.value);
  }

  get oracles(): StandardIndex<DataswornTypes["oracle"]> {
    return this.prioritized.ofKind("oracle").projected((entry) => entry.value);
  }

  get truths(): StandardIndex<DataswornTypes["truth"]> {
    return this.prioritized.ofKind("truth").projected((entry) => entry.value);
  }

  get roller(): OracleRoller {
    return new OracleRoller(this.oracles);
  }

  get rulesPackages(): StandardIndex<DataswornTypes["rules_package"]> {
    return this.prioritized
      .ofKind("rules_package")
      .projected((entry) => entry.value);
  }

  // TODO: this should return an error if the datacontext houses
  //       too many rulesets.
  get ruleset(): Ruleset {
    const ids: string[] = [];
    const rules = [...this.prioritized.ofKind("rules_package").values()]
      .map((pkg) => {
        ids.push(pkg.id);
        return pkg.value.rules;
      })
      .reduce((acc, rules) => merge(acc, rules)) as Rules;

    return new Ruleset(ids, rules);
  }
}
