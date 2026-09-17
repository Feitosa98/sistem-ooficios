import logo from "./assets/logo-cartorio.jpg?inline";
import watermark from "./assets/marca-dagua-cartorio.png?inline";
function decode(value: string) { return Uint8Array.from(Buffer.from(value.slice(value.indexOf(",") + 1), "base64")); }
export const oficioAssets = { logo: decode(logo), watermark: decode(watermark) };
