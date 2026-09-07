import "server-only";
import type { Database } from "@/lib/supabase/database.types";

type Business = Database["public"]["Tables"]["businesses"]["Row"];
type Branding = Database["public"]["Tables"]["business_branding"]["Row"] | null;

/** Marketing email HTML: visually the CLIENT business, not LoyalNest (Part
 * 14/23) — business name/logo/colors drive the template; LoyalNest appears
 * only as a small footer credit. Plain-text body lines are converted to
 * paragraphs; this is intentionally simple (no rich HTML editor today). */
export function renderEmailHtml(params: {
  business: Business;
  branding: Branding;
  bodyText: string;
  unsubscribeUrl: string;
}) {
  const accent = params.branding?.primary_color ?? "#171717";
  const bg = params.branding?.background_color ?? "#ffffff";
  const text = params.branding?.text_color ?? "#171717";
  const logo = params.branding?.logo_url;

  const paragraphs = params.bodyText
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">${escapeHtml(line)}</p>`)
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:${bg};color:${text};border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 0;text-align:center;">
                ${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(params.business.name)}" width="48" height="48" style="border-radius:9999px;object-fit:cover;" />` : `<div style="width:48px;height:48px;border-radius:9999px;background:${accent};color:#fff;display:inline-block;line-height:48px;font-size:20px;font-weight:600;">${escapeHtml(params.business.name.slice(0, 1).toUpperCase())}</div>`}
                <h1 style="font-size:18px;margin:16px 0 24px;">${escapeHtml(params.business.name)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                ${paragraphs}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid rgba(0,0,0,0.08);text-align:center;">
                <p style="font-size:11px;color:rgba(0,0,0,0.4);margin:0 0 8px;">Powered by LoyalNest</p>
                <a href="${escapeHtml(params.unsubscribeUrl)}" style="font-size:11px;color:rgba(0,0,0,0.4);">Unsubscribe</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
