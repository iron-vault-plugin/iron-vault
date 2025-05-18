import { numbers } from "@ironvault/utils/numbers";

export function sanitizeNameForId(name: string): string {
  return name
    .replaceAll(/[0-9]/g, (digit) => numbers[Number.parseInt(digit)])
    .replaceAll(/[^a-z]+/gi, "_")
    .replaceAll(/^_|_$/g, "")
    .toLowerCase();
}
