import { escapeHtml } from "./layout.js";

const COLORS = {
    body: "#312e2b",
    card: "#262522",
    accent: "#68b844",
    accentText: "#0f1a09",
    text: "#f1efec",
    muted: "#a8a29b",
    border: "#3d3936",
    danger: "#d64545",
};

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/**
 * Console d'envoi, servie uniquement hors prod. Page autonome : aucune ressource
 * externe, pour qu'elle fonctionne sur un serveur sans accès Internet sortant.
 */
export function renderConsole({ smtp, publicBase }) {
    const smtpOk = smtp.ok;
    const smtpLabel = smtpOk
        ? `SMTP joignable — ${smtp.host}:${smtp.port}`
        : `SMTP injoignable — ${smtp.host}:${smtp.port} (${smtp.error || "erreur inconnue"})`;

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Snell — console mail</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 40px 20px; background: ${COLORS.body}; color: ${COLORS.text}; font-family: ${FONT}; }
  .wrap { max-width: 560px; margin: 0 auto; }
  .brand { font-size: 20px; font-weight: 700; letter-spacing: 1px; color: ${COLORS.accent}; margin: 0 0 4px 0; }
  .sub { margin: 0 0 28px 0; font-size: 14px; color: ${COLORS.muted}; }
  .card { background: ${COLORS.card}; border: 1px solid ${COLORS.border}; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
  .status { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; line-height: 20px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; margin-top: 6px; flex: none; background: ${smtpOk ? COLORS.accent : COLORS.danger}; }
  label { display: block; font-size: 13px; font-weight: 600; margin: 0 0 8px 0; }
  input[type=email], select {
    width: 100%; padding: 11px 12px; font-size: 15px; font-family: inherit;
    color: ${COLORS.text}; background: ${COLORS.body};
    border: 2px solid ${COLORS.border}; border-radius: 8px; outline: none;
  }
  input[type=email]:focus, select:focus { border-color: ${COLORS.accent}; }
  .field + .field { margin-top: 18px; }
  button {
    width: 100%; margin-top: 22px; padding: 13px; font-size: 15px; font-weight: 600; font-family: inherit;
    color: ${COLORS.accentText}; background: ${COLORS.accent};
    border: none; border-radius: 8px; cursor: pointer;
  }
  button:disabled { opacity: .55; cursor: default; }
  pre {
    margin: 16px 0 0 0; padding: 14px; font-family: ${MONO}; font-size: 12px; line-height: 19px;
    white-space: pre-wrap; word-break: break-all;
    background: ${COLORS.body}; border: 1px solid ${COLORS.border}; border-radius: 8px; color: ${COLORS.muted};
  }
  a { color: ${COLORS.accent}; }
  .hint { font-size: 12px; line-height: 19px; color: ${COLORS.muted}; margin: 14px 0 0 0; }
  code { font-family: ${MONO}; font-size: 12px; }
</style>
</head>
<body>
<div class="wrap">
  <p class="brand">SNELL</p>
  <p class="sub">Console d'envoi du service mail — indisponible en production.</p>

  <div class="card">
    <div class="status"><span class="dot"></span><span>${escapeHtml(smtpLabel)}</span></div>
    <p class="hint">Les liens des mails sont construits sur <code>${escapeHtml(publicBase)}</code>.</p>
  </div>

  <div class="card">
    <form id="form">
      <div class="field">
        <label for="to">Adresse du destinataire</label>
        <input type="email" id="to" name="to" required placeholder="test@exemple.fr" autocomplete="off">
      </div>
      <div class="field">
        <label for="type">Type de mail</label>
        <select id="type" name="type">
          <option value="VERIFY_ACCOUNT">Validation de compte</option>
          <option value="RESET_PASSWORD">Réinitialisation de mot de passe</option>
        </select>
      </div>
      <button type="submit" id="submit">Envoyer</button>
    </form>
    <pre id="result" hidden></pre>
    <p class="hint">
      Le mail part avec un vrai token : le lien reçu est cliquable et déroule le même
      chemin que le parcours réel, seul l'utilisateur est fictif.
      <span id="mailpit"></span>
    </p>
  </div>
</div>

<script>
  var form = document.getElementById('form');
  var button = document.getElementById('submit');
  var result = document.getElementById('result');

  var mailpitUrl = 'http://' + location.hostname + ':8025';
  document.getElementById('mailpit').innerHTML =
    'Les mails envoyés s\\'affichent dans <a href="' + mailpitUrl + '" target="_blank">Mailpit</a>.';

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    button.disabled = true;
    button.textContent = 'Envoi…';
    result.hidden = true;

    try {
      var response = await fetch('/api/mail/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: document.getElementById('to').value,
          type: document.getElementById('type').value
        })
      });

      var payload = await response.json();
      result.textContent = (response.ok ? '✓ ' : '✗ ') + JSON.stringify(payload, null, 2);
    } catch (error) {
      result.textContent = '✗ ' + error.message;
    }

    result.hidden = false;
    button.disabled = false;
    button.textContent = 'Envoyer';
  });
</script>
</body>
</html>`;
}
