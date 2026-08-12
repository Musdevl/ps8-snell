/**
 * Gabarit commun des mails Snell.
 *
 * Contraintes propres à l'email, qui expliquent le style du code ci-dessous :
 * - Gmail supprime les <style> du <head>, donc tout est en style inline.
 * - Outlook (moteur Word) ignore flexbox/grid, donc la mise en page est en <table>.
 * - Le bouton est une table et non un <a> stylé, sinon Outlook n'affiche pas le fond.
 */

const COLORS = {
    body: "#312e2b",
    card: "#262522",
    accent: "#68b844",
    accentText: "#0f1a09",
    text: "#f1efec",
    muted: "#a8a29b",
    border: "#3d3936",
};

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * @param {object} content
 * @param {string} content.preheader  Texte d'aperçu dans la boîte de réception
 * @param {string} content.heading    Titre principal
 * @param {string[]} content.body     Paragraphes
 * @param {string} [content.buttonLabel]
 * @param {string} [content.buttonUrl]  Sans lui, le mail n'a pas de bouton
 * @param {string} content.footnote   Mention de fin (expiration, non-demandé...)
 */
export function renderHtml({ preheader, heading, body, buttonLabel, buttonUrl, footnote }) {
    const paragraphs = body
        .map(
            (paragraph) =>
                `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:${COLORS.text};">${paragraph}</p>`
        )
        .join("");

    // Un mail purement informatif, comme la bienvenue, n'a rien sur quoi cliquer.
    const button = !buttonUrl ? "" : `
        <tr>
          <td style="padding:8px 32px 24px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="background-color:${COLORS.accent};border-radius:8px;">
                  <a href="${escapeHtml(buttonUrl)}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:${COLORS.accentText};text-decoration:none;">${escapeHtml(buttonLabel)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark light">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.body};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.body};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px;">
        <tr>
          <td style="padding:32px 32px 8px 32px;font-family:${FONT};">
            <p style="margin:0 0 24px 0;font-size:20px;font-weight:700;letter-spacing:1px;color:${COLORS.accent};">SNELL</p>
            <h1 style="margin:0 0 20px 0;font-size:22px;line-height:30px;font-weight:600;color:${COLORS.text};">${escapeHtml(heading)}</h1>
            ${paragraphs}
          </td>
        </tr>
${button}
        <tr>
          <td style="padding:0 32px 32px 32px;font-family:${FONT};">
            <hr style="border:none;border-top:1px solid ${COLORS.border};margin:0 0 16px 0;">
            <p style="margin:0;font-size:12px;line-height:19px;color:${COLORS.muted};">${escapeHtml(footnote)}</p>
          </td>
        </tr>
      </table>
      <p style="max-width:520px;margin:16px auto 0 auto;font-family:${FONT};font-size:11px;line-height:18px;color:${COLORS.muted};text-align:center;">Snell — mail automatique, merci de ne pas y répondre.</p>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Version texte, obligatoire : sans elle les filtres anti-spam pénalisent le mail. */
export function renderText({ heading, body, buttonLabel, buttonUrl, footnote }) {
    const stripped = body.map((paragraph) => paragraph.replace(/<[^>]+>/g, ""));

    // La version texte n'a pas de bouton : l'URL en clair y est le seul moyen d'agir.
    const action = buttonUrl ? [`${buttonLabel} :`, buttonUrl, ""] : [];

    return [
        "SNELL",
        "",
        heading,
        "",
        ...stripped,
        "",
        ...action,
        footnote,
        "",
        "Mail automatique, merci de ne pas y répondre.",
    ].join("\n");
}

export function render(content) {
    return { html: renderHtml(content), text: renderText(content) };
}

export { escapeHtml };
