import * as accountService from "../../../services/account-service.js"

const overlay = document.getElementById('recovery-popup');
const codeEl  = document.getElementById('recovery-code');

async function register() {
    const email    = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const username = document.getElementById("username").value;
    return await accountService.register(email, username, password);
}

function showRecoveryPopup(code) {
    console.log(code)
    codeEl.textContent = code.slice(0, 3) + ' ' + code.slice(3);
    overlay.classList.remove('hidden');
}

document.getElementById('register-btn').addEventListener('click', async () => {
    const user = await register();
    showRecoveryPopup(user.verification_code);
});

document.getElementById('recovery-ok').addEventListener('click', () => {
    window.location.href = '/';
});