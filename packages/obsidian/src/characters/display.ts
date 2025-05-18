import { MeterCommon } from "rules/ruleset";
import { capitalize } from "utils/strings";
import { KeyWithDefinition } from "./lens";

/** Get human readable name for meter, including parent asset when present. */
export function labelForMeter<T extends MeterCommon>(
  meter: KeyWithDefinition<T>,
): string {
  return (
    (meter.parent ? `${meter.parent.label} / ` : "") +
    capitalize(meter.definition.label)
  );
}
