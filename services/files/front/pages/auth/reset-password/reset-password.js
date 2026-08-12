import * as accountService from "../../../services/account-service.js"
import { notify } from "../../../services/notification-service.js"

const form = document.getElementById('form');
const invalidLink = document.getElementById('invalid-link');

// Le token vient du lien reçu par mail : /pages/auth/reset-password/?token=...
const token = new URLSearchParams(window.location.search).get('token');

if (!token) {
    form.classList.add('hidden');
    invalidLink.classList.remove('hidden');
}

document.getElementById('reset-btn').addEventListener('click', async () => {
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;

    if (!password) return notify("Choose a password", 'error');
    if (password !== confirm) return notify("Both passwords must match", 'error');

    const done = await accountService.resetPassword(token, password);

    if (done) setTimeout(() => window.location.replace('/pages/auth/login/index.html'), 1200);
});
