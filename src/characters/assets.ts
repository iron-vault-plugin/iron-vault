import {
  Asset,
  AssetAbilityControlField,
  AssetAbilityOptionField,
  AssetConditionMeter,
  AssetConditionMeterControlField,
  AssetControlField,
  AssetOptionField,
} from "@datasworn/core";
import { produce } from "immer";
import { DataIndex } from "../datastore/data-index";
import { Either, Left, Right } from "../utils/either";
import { reader, writer } from "../utils/lens";
import {
  CharReader,
  CharWriter,
  CharacterLens,
  ForgedSheetAssetSchema,
} from "./lens";

export class AssetError extends Error {}

export function assetWithDefnReader(
  charLens: CharacterLens,
  index: DataIndex,
): CharReader<
  Array<Either<AssetError, { asset: ForgedSheetAssetSchema; defn: Asset }>>
> {
  return reader((source) => {
    return charLens.assets.get(source).map((asset) => {
      const defn = index._assetIndex.get(asset.id);
      if (defn) {
        return Right.create({ asset, defn });
      } else {
        return Left.create(new AssetError(`missing asset with id ${asset.id}`));
      }
    });
  });
}

export type Pathed<T> = { path: string[]; value: T };
export function pathed<T>(path: string[], value: T): Pathed<T> {
  return { path, value };
}

export function extendPathed<T>(
  pathed: Pathed<T>,
  nextStep: string,
  value: T,
): Pathed<T> {
  return { path: [...pathed.path, nextStep], value };
}

type AnyControlField =
  | AssetControlField
  | AssetAbilityControlField
  | AssetConditionMeterControlField;

type AnyOptionField = AssetOptionField | AssetAbilityOptionField;

function traverseAssetControls(
  asset: Asset,
  markedAbilities?: number[],
): Pathed<AnyControlField>[] {
  function conditionMeterControls(
    controls: AssetConditionMeter["controls"],
    parent: Pathed<AnyControlField>,
  ): Pathed<AnyControlField>[] {
    return Object.entries(controls ?? {}).map(([key, field]) => {
      return extendPathed(parent, key, field);
    });
  }
  const baseControls: Pathed<AnyControlField>[] = Object.entries(
    asset.controls ?? {},
  ).flatMap(([key, field]) => {
    const curControl = pathed([asset.id, key], field);
    const conditionMeterFields =
      field.field_type == "condition_meter"
        ? conditionMeterControls(field.controls, curControl)
        : [];
    return [curControl, ...conditionMeterFields];
  });

  const abilityControls: Pathed<AnyControlField>[] = (markedAbilities ?? [])
    .map((abilityNum) => asset.abilities[abilityNum - 1]) // TODO: marked abilities 0-indexing FOR-13
    .flatMap((ability) => {
      return Object.entries(ability.controls ?? {}).map(([key, field]) =>
        pathed([ability.id, key], field),
      );
    });

  return [...baseControls, ...abilityControls];
}

export function traverseAssetOptions(
  asset: Asset,
  markedAbilities?: number[],
): Pathed<AnyOptionField>[] {
  const baseControls: Pathed<AnyOptionField>[] = Object.entries(
    asset.options ?? {},
  ).map(([key, field]) => pathed([asset.id, key], field));

  const abilityOptions: Pathed<AnyOptionField>[] = (markedAbilities ?? [])
    .map((abilityNum) => asset.abilities[abilityNum - 1]) // TODO: marked abilities 0-indexing FOR-13
    .flatMap((ability) => {
      return Object.entries(ability.options ?? {}).map(([key, field]) =>
        pathed([ability.id, key], field),
      );
    });

  return [...baseControls, ...abilityOptions];
}

export function samePath(left: Pathed<any>, right: Pathed<any>): boolean {
  if (left.path == right.path) return true;
  if (left.path.length != right.path.length) return false;

  for (const idx in left.path) {
    if (left.path[idx] != right.path[idx]) return false;
  }

  return true;
}

export function getPathLabel(pathed: Pathed<any>): string {
  // Skip first element (which is asset/ability id)
  return pathed.path.slice(1).join("/");
}

export function defaultMarkedAbilitiesForAsset(asset: Asset): number[] {
  // TODO: 0-index FOR-13
  return asset.abilities.flatMap(({ enabled }, index) =>
    enabled ? [index + 1] : [],
  );
}

export function updateAssetWithOptions(
  asset: Asset,
  options: Record<string, any>,
): Asset {
  return produce(asset, (draft) => {
    for (const pathed of traverseAssetOptions(
      draft,
      defaultMarkedAbilitiesForAsset(asset),
    )) {
      const updatedValue = options[getPathLabel(pathed)];
      if (updatedValue) {
        pathed.value.value = updatedValue;
      }
    }
  });
}

export function addAsset(charLens: CharacterLens): CharWriter<Asset> {
  return writer((character, newAsset) => {
    const currentAssets = charLens.assets.get(character);

    // If character already has asset, this is a no-op
    if (currentAssets.find(({ id }) => id == newAsset.id)) return character;

    const marked_abilities = defaultMarkedAbilitiesForAsset(newAsset);
    const controls = Object.fromEntries(
      traverseAssetControls(newAsset, marked_abilities).map((pathedField) => [
        getPathLabel(pathedField),
        pathedField.value.value,
      ]),
    );

    const options = Object.fromEntries(
      traverseAssetOptions(newAsset, marked_abilities).map((pathedOption) => [
        getPathLabel(pathedOption),
        pathedOption.value.value,
      ]),
    );

    return charLens.assets.update(character, [
      ...currentAssets,
      { id: newAsset.id, marked_abilities, controls, options },
    ]);
  });
}
