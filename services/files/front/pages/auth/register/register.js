import * as accountService from "../../../services/account-service.js"

async function register() {
    const email    = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const username = document.getElementById("username").value;
    return await accountService.register(email, username, password);
}

document.getElementById('register-btn').addEventListener('click', async () => {
    const user = await register();
    if (user) window.location.href = '/';
});
