import { type Datasworn } from "@datasworn/core";
import { produce } from "immer";
import { ConditionMeterDefinition } from "rules/ruleset";
import { DataIndex } from "../datastore/data-index";
import { Either, Left, Right } from "../utils/either";
import { reader, writer } from "../utils/lens";
import {
  CharLens,
  CharReader,
  CharWriter,
  CharacterLens,
  IronVaultSheetAssetSchema,
} from "./lens";

export class AssetError extends Error {}

export function assetWithDefnReader(
  charLens: CharacterLens,
  index: DataIndex,
): CharReader<
  Array<
    Either<
      AssetError,
      { asset: IronVaultSheetAssetSchema; defn: Datasworn.Asset }
    >
  >
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
  | Datasworn.AssetControlField
  | Datasworn.AssetAbilityControlField
  | Datasworn.AssetConditionMeterControlField;

type AnyOptionField =
  | Datasworn.AssetOptionField
  | Datasworn.AssetAbilityOptionField;

function traverseAssetControls(
  asset: Datasworn.Asset,
  markedAbilities: boolean[],
): Pathed<AnyControlField>[] {
  function conditionMeterControls(
    controls: Datasworn.AssetConditionMeter["controls"],
    parent: Pathed<AnyControlField>,
  ): Pathed<AnyControlField>[] {
    return Object.entries(controls ?? {}).map(([key, field]) => {
      return extendPathed(parent, key, field);
    });
  }
  const baseControls: Pathed<AnyControlField>[] = Object.entries(
    asset.controls ?? {},
  ).flatMap(([key, field]) => {
    const curControl = pathed([asset._id, key], field);
    const conditionMeterFields =
      field.field_type == "condition_meter"
        ? conditionMeterControls(field.controls, curControl)
        : [];
    return [curControl, ...conditionMeterFields];
  });

  if (markedAbilities.length != asset.abilities.length) {
    throw new Error(
      `Asset has ${asset.abilities.length} abilities, but marked abilities only ${markedAbilities.length}`,
    );
  }

  const abilityControls: Pathed<AnyControlField>[] = asset.abilities
    .filter((_ability, index) => markedAbilities[index])
    .flatMap((ability) => {
      return Object.entries(ability.controls ?? {}).map(([key, field]) =>
        pathed([ability._id, key], field),
      );
    });

  return [...baseControls, ...abilityControls];
}

export function traverseAssetOptions(
  asset: Datasworn.Asset,
  markedAbilities: boolean[],
): Pathed<AnyOptionField>[] {
  const baseControls: Pathed<AnyOptionField>[] = Object.entries(
    asset.options ?? {},
  ).map(([key, field]) => pathed([asset._id, key], field));

  if (markedAbilities.length != asset.abilities.length) {
    throw new Error(
      `Asset has ${asset.abilities.length} abilities, but marked abilities only ${markedAbilities.length}`,
    );
  }

  const abilityOptions: Pathed<AnyOptionField>[] = asset.abilities
    .filter((_ability, index) => markedAbilities[index])
    .flatMap((ability) => {
      return Object.entries(ability.options ?? {}).map(([key, field]) =>
        pathed([ability._id, key], field),
      );
    });

  return [...baseControls, ...abilityOptions];
}

export function samePath(
  left: Pathed<unknown>,
  right: Pathed<unknown>,
): boolean {
  if (left.path == right.path) return true;
  if (left.path.length != right.path.length) return false;

  for (const idx in left.path) {
    if (left.path[idx] != right.path[idx]) return false;
  }

  return true;
}

export function getPathLabel(pathed: Pathed<unknown>): string {
  // Skip first element (which is asset/ability id)
  return pathed.path.slice(1).join("/");
}

export function defaultMarkedAbilitiesForAsset(
  asset: Datasworn.Asset,
): boolean[] {
  return asset.abilities.map(({ enabled }) => enabled);
}

export function updateAssetWithOptions(
  asset: Datasworn.Asset,
  options: Record<string, string>,
): Datasworn.Asset {
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

export function addAsset(charLens: CharacterLens): CharWriter<Datasworn.Asset> {
  return writer((character, newAsset) => {
    const currentAssets = charLens.assets.get(character);

    // If character already has asset, this is a no-op
    if (currentAssets.find(({ id }) => id == newAsset._id)) return character;

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
      { id: newAsset._id, abilities: marked_abilities, controls, options },
    ]);
  });
}

export class MissingAssetError extends Error {}

export function assetMeters(
  charLens: CharacterLens,
  asset: Datasworn.Asset,
  markedAbilities: boolean[],
): {
  key: string;
  definition: ConditionMeterDefinition;
  lens: CharLens<number>;
}[] {
  const meters = traverseAssetControls(
    asset,
    markedAbilities ?? defaultMarkedAbilitiesForAsset(asset),
  ).filter(
    (pathed): pathed is Pathed<Datasworn.ConditionMeterField> =>
      pathed.value.field_type == "condition_meter",
  );

  return meters.map((pathed) => {
    const { value: control } = pathed;
    const key = getPathLabel(pathed);

    return {
      key,
      definition: {
        kind: "condition_meter",
        label: control.label,
        min: control.min,
        max: control.max,
        rollable: control.rollable,
      },
      lens: {
        get(source) {
          const assets = charLens.assets.get(source);
          const thisAsset = assets.find(({ id }) => id === asset._id);
          if (!thisAsset) {
            // should probably use a lens type that has concept of errors
            throw new MissingAssetError(`expected asset with id ${asset._id}`);
          }
          // TODO: should this raise an error if not a number?
          return typeof thisAsset.controls[key] === "number"
            ? (thisAsset.controls[key] as number)
            : control.value;
        },
        update(source, newval) {
          const assets = charLens.assets.get(source);
          const thisAsset = assets.find(({ id }) => id === asset._id);
          if (!thisAsset) {
            // should probably use a lens type that has concept of errors
            throw new MissingAssetError(`expected asset with id ${asset._id}`);
          }
          if (thisAsset.controls[key] === newval) return source;
          thisAsset.controls[key] = newval;
          return charLens.assets.update(source, assets);
        },
      },
    };
  });
}
