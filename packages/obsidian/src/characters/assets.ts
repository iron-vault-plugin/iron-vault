import { type Datasworn } from "@datasworn/core";
import { IDataContext } from "datastore/data-context";
import { produce } from "immer";
import merge from "lodash.merge";
import { ConditionMeterDefinition } from "rules/ruleset";
import { Result } from "true-myth";
import { err, ok } from "true-myth/result";
import { Reader, Writer, addOrUpdateMatching, writer } from "../utils/lens";
import { MissingAssetError } from "./errors";
import {
  CharLens,
  CharWriter,
  CharacterLens,
  IronVaultSheetAssetSchema,
} from "./lens";

// export function assetWithDefnReader(
//   charLens: CharacterLens,
//   dataContext: IDataContext,
// ): CharReader<
//   Array<
//     Either<
//       AssetError,
//       { asset: IronVaultSheetAssetSchema; defn: Datasworn.Asset }
//     >
//   >
// > {
//   return reader((source) => {
//     return charLens.assets.get(source).map((asset) => {
//       const defn = dataContext.assets.get(asset.id);
//       if (defn) {
//         return Right.create({ asset, defn });
//       } else {
//         return Left.create(new AssetError(`missing asset with id ${asset.id}`));
//       }
//     });
//   });
// }

export type AssetWalker = {
  onAnyOption?: (
    key: string,
    option: Datasworn.AssetOptionField | Datasworn.AssetAbilityOptionField,
    parentKey?: string | number,
  ) => void;
  onBaseOption?: (key: string, option: Datasworn.AssetOptionField) => void;
  onAbilityOption?: (
    key: string,
    option: Datasworn.AssetAbilityOptionField,
    parent: Datasworn.AssetAbility,
    parentIdx: number,
  ) => void;
  onAnyControl?: (
    key: string,
    control:
      | Datasworn.AssetControlField
      | Datasworn.AssetAbilityControlField
      | Datasworn.AssetConditionMeterControlField,
    parentKey?: string | number,
  ) => void;
  onBaseControl?: (key: string, control: Datasworn.AssetControlField) => void;
  onAbilityControl?: (
    key: string,
    control: Datasworn.AssetAbilityControlField,
    parent: Datasworn.AssetAbility,
    parentIdx: number,
  ) => void;
  onConditionMeterSubcontrol?: (
    key: string,
    control: Datasworn.AssetConditionMeterControlField,
    parent: Datasworn.AssetConditionMeter,
    parentKey: string,
  ) => void;
};

/** Walks the asset controls and options, descending into those nested in abilities or other controls.
 * @param markedAbilities if provided, only walk asset abilities for marked abilities.
 */
export function walkAsset(
  asset: Datasworn.Asset,
  handlers: AssetWalker,
  markedAbilities: boolean[] = asset.abilities.map(() => true),
): void {
  if (markedAbilities.length != asset.abilities.length) {
    throw new Error(
      `Asset has ${asset.abilities.length} abilities, but marked abilities only ${markedAbilities.length}`,
    );
  }

  for (const [key, control] of Object.entries(asset.controls ?? {})) {
    if (handlers.onAnyControl) handlers.onAnyControl(key, control);
    if (handlers.onBaseControl) handlers.onBaseControl(key, control);

    if (control.field_type == "condition_meter") {
      for (const [subkey, subcontrol] of Object.entries(
        control.controls ?? {},
      )) {
        if (handlers.onAnyControl)
          handlers.onAnyControl(subkey, subcontrol, key);
        if (handlers.onConditionMeterSubcontrol)
          handlers.onConditionMeterSubcontrol(subkey, subcontrol, control, key);
      }
    }
  }

  for (const [key, option] of Object.entries(asset.options ?? {})) {
    if (handlers.onAnyOption) handlers.onAnyOption(key, option);
    if (handlers.onBaseOption) handlers.onBaseOption(key, option);
  }

  for (
    let abilityIndex = 0;
    abilityIndex < asset.abilities.length;
    abilityIndex++
  ) {
    if (!markedAbilities[abilityIndex]) continue;

    const ability = asset.abilities[abilityIndex];
    for (const [key, control] of Object.entries(ability.controls ?? {})) {
      if (handlers.onAnyControl)
        handlers.onAnyControl(key, control, abilityIndex);
      if (handlers.onAbilityControl)
        handlers.onAbilityControl(key, control, ability, abilityIndex);
    }

    for (const [key, option] of Object.entries(ability.options ?? {})) {
      if (handlers.onAnyOption) handlers.onAnyOption(key, option, abilityIndex);
      if (handlers.onAbilityOption)
        handlers.onAbilityOption(key, option, ability, abilityIndex);
    }
  }
}

/** Returns the default marked abilities array for this asset. */
export function defaultMarkedAbilitiesForAsset(
  asset: Datasworn.Asset,
): boolean[] {
  return asset.abilities.map(({ enabled }) => enabled);
}

/** Produces a writer that adds or updates an asset to the character assets based on id. */
export function addOrUpdateAssetData(
  charLens: CharacterLens,
): CharWriter<IronVaultSheetAssetSchema> {
  return addOrUpdateMatching(
    charLens.assets,
    (existing, candidate) => existing.id === candidate.id,
  );
}

/** Produces a writer that adds or updates an asset to the character assets using a populated
 * Datasworn.Asset object.
 */
export function addOrUpdateViaDataswornAsset(
  charLens: CharacterLens,
): CharWriter<Datasworn.Asset> {
  const assetDataWriter = addOrUpdateAssetData(charLens);
  const assetLens = integratedAssetWriter();

  return writer((source, newval) => {
    return assetDataWriter.update(
      source,
      assetLens.update(
        { id: newval._id, abilities: [], controls: {}, options: {} },
        newval,
      ),
    );
  });
}

function assetKey(key: string, parentKey: string | number | undefined): string {
  return parentKey != null ? `${parentKey}/${key}` : key;
}

/** A lens that takes a character asset choice and produces an asset w/ choices merged in. */
export function integratedAssetReader(
  dataContext: IDataContext,
): Reader<
  IronVaultSheetAssetSchema,
  Result<Datasworn.Asset, MissingAssetError>
> {
  return {
    get(assetData) {
      const dataswornAsset = dataContext.assets.get(assetData.id);
      if (!dataswornAsset) {
        return err(
          new MissingAssetError(`unable to find asset ${assetData.id}`),
        );
      }
      return ok(
        produce(dataswornAsset, (draft) => {
          assetData.abilities.forEach((enabled, index) => {
            if (enabled != null) {
              draft.abilities[index].enabled = enabled;
            }
            if (
              draft.abilities[index].enabled &&
              draft.abilities[index].enhance_asset
            ) {
              draft = merge(draft, draft.abilities[index].enhance_asset);
            }
          });
          walkAsset(draft, {
            onAnyOption(key, option, parentKey) {
              const newVal = assetData.options[assetKey(key, parentKey)];
              if (newVal !== undefined && option.value !== newVal) {
                option.value = newVal as string;
              }
            },
            onAnyControl(key, control, parentKey) {
              const newVal = assetData.controls[assetKey(key, parentKey)];
              if (newVal !== undefined && control.value !== newVal) {
                control.value = newVal;
              }
            },
          });
        }),
      );
    },
  };
}

export function integratedAssetWriter(): Writer<
  IronVaultSheetAssetSchema,
  Datasworn.Asset
> {
  return {
    update(source, asset) {
      return produce(source, (draft) => {
        draft.id = asset._id;
        draft.abilities = asset.abilities.map(({ enabled }) => enabled);
        walkAsset(asset, {
          onAnyOption(key, option, parentKey) {
            const fullKey = assetKey(key, parentKey);
            if (draft.options[fullKey] !== option.value)
              draft.options[fullKey] = option.value;
          },
          onAnyControl(key, control, parentKey) {
            const fullKey = assetKey(key, parentKey);
            if (draft.controls[fullKey] !== control.value)
              draft.controls[fullKey] = control.value;
          },
        });
      });
    },
  };
}

export function assetMeters(
  charLens: CharacterLens,
  asset: Datasworn.Asset,
): {
  key: string;
  definition: ConditionMeterDefinition;
  lens: CharLens<number>;
}[] {
  const meters: [string, Datasworn.ConditionMeterField][] = [];
  walkAsset(
    asset,
    {
      onBaseControl(key, control) {
        if (control.field_type == "condition_meter") {
          meters.push([key, control]);
        }
      },
    },
    asset.abilities.map(({ enabled }) => enabled),
  );

  return meters.map(([key, control]) => {
    return {
      key: `${asset._id}@${key}`,
      definition: new ConditionMeterDefinition({
        label: control.label,
        min: control.min,
        max: control.max,
        rollable: control.rollable,
        value: control.value,
      }),
      parent: { label: asset.name },
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
