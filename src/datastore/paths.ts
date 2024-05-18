/* eslint-disable @typescript-eslint/no-explicit-any */
// NOTE: This whole thing is a currently unused experiment.
import { type Datasworn } from "@datasworn/core";

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

export type ResourceKindOf<T> = T extends Datasworn.AssetAbility
  ? "ability"
  : T extends Datasworn.Asset
    ? "asset"
    : never;
export type ResourceParentPathOf<T> = T extends Datasworn.AssetAbility
  ? ResourcePath<Datasworn.Asset>
  : T extends Datasworn.Asset
    ? null
    : never;

export type ResourcePath<T> = ResourcePathSegment<
  ResourceKindOf<T>,
  ResourceParentPathOf<T>
>;

export type AssetConditionMeterResourcePath = ResourcePathSegment<
  "condition_meter",
  ResourcePath<Datasworn.Asset>
>;

export type AssetControlFieldReference =
  | ResourcePathTagged<
      ResourcePath<Datasworn.Asset>,
      Datasworn.AssetControlField
    >
  | ResourcePathTagged<
      ResourcePath<Datasworn.AssetAbility>,
      Datasworn.AssetAbilityControlField
    >
  | ResourcePathTagged<
      AssetConditionMeterResourcePath,
      Datasworn.AssetConditionMeterControlField
    >;
