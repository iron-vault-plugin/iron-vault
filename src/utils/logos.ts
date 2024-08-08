import delveLogoBin from "../../media/ironvault_logo_delve.png";
import ironswornLogoBin from "../../media/ironvault_logo_ironsworn.png";
import starforgedLogoBin from "../../media/ironvault_logo_starforged.png";
import sunderedIslesLogoBin from "../../media/ironvault_logo_sunderedisles.png";

function bytesToPngDataURI(bytes: Uint8Array) {
  const binString = Array.from(bytes, (byte) =>
    String.fromCodePoint(byte),
  ).join("");
  return "data:image/png;base64," + btoa(binString);
}

export const IS_LOGO = bytesToPngDataURI(
  ironswornLogoBin as unknown as Uint8Array,
);
export const DELVE_LOGO = bytesToPngDataURI(
  delveLogoBin as unknown as Uint8Array,
);
export const SF_LOGO = bytesToPngDataURI(
  starforgedLogoBin as unknown as Uint8Array,
);
export const SI_LOGO = bytesToPngDataURI(
  sunderedIslesLogoBin as unknown as Uint8Array,
);
