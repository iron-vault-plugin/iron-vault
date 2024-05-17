/* eslint-disable @typescript-eslint/no-explicit-any */
// NOTE: This whole thing is a currently unused experiment.
import {
  Asset,
  AssetAbility,
  AssetAbilityControlField,
  AssetConditionMeterControlField,
  AssetControlField,
} from "@datasworn/core";

export type ResourceKinds = "ability" | "asset" | "condition_meter";
export type ResourcePathSegment<
  T extends ResourceKinds = ResourceKinds,
  Parent extends ResourcePathSegment<ResourceKinds, any> | null = null,
> = { kind: T; id: string; key: string | null; parent: Parent };

export type ResourcePathTagged<T extends ResourcePathSegment<any, any>, U> = {
  parent: T;
  key: string;
  value: U;
};

export type ResourceKindOf<T> = T extends AssetAbility
  ? "ability"
  : T extends Asset
    ? "asset"
    : never;
export type ResourceParentPathOf<T> = T extends AssetAbility
  ? ResourcePath<Asset>
  : T extends Asset
    ? null
    : never;

export type ResourcePath<T> = ResourcePathSegment<
  ResourceKindOf<T>,
  ResourceParentPathOf<T>
>;

export type AssetConditionMeterResourcePath = ResourcePathSegment<
  "condition_meter",
  ResourcePath<Asset>
>;

export type AssetControlFieldReference =
  | ResourcePathTagged<ResourcePath<Asset>, AssetControlField>
  | ResourcePathTagged<ResourcePath<AssetAbility>, AssetAbilityControlField>
  | ResourcePathTagged<
      AssetConditionMeterResourcePath,
      AssetConditionMeterControlField
    >;
