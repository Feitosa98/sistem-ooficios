import { logoDataUrl as logo } from "@/lib/embedded-assets";
import { watermarkDataUrl as watermark } from "@/lib/embedded-assets";
function decode(value: string) { return Uint8Array.from(Buffer.from(value.slice(value.indexOf(",") + 1), "base64")); }
export const oficioAssets = { logo: decode(logo), watermark: decode(watermark) };
