import "server-only";
import QRCode from "qrcode";

export async function generateQrDataUrl(value: string) {
  return QRCode.toDataURL(value, {
    width: 480,
    margin: 2,
    color: { dark: "#171717", light: "#ffffff" },
  });
}
