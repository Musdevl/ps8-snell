import { GATEWAY_URL } from '../../../env.js';
import * as accountService from '../../../services/account-service.js';

async function init() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const userId = params.get('userId');

    const title = document.getElementById('title');
    const message = document.getElementById('message');
    const homeBtn = document.getElementById('home-btn');
    const dancers = document.querySelectorAll('.dancer');

    try {
        const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/shop/verify?session_id=${sessionId}&userId=${userId}`);
        const data = await res.json();

        if (data.success) {
            title.textContent = 'Payment confirmed';
            message.textContent = '5000 Snell Coins have been added to your account.';

            dancers.forEach(d => {
                d.classList.add('show-celebration');
            });

            const userRes = await accountService.authFetch(`${GATEWAY_URL}/api/user/info/${userId}`);
            const user = await userRes.json();
            accountService.setAccount(user);
        } else {
            title.textContent = 'Payment failed';
            message.textContent = 'We could not verify the payment status.';
        }
    } catch (e) {
        console.error("[ERROR]", e);
        title.textContent = 'Error';
        message.textContent = 'Something went wrong during verification.';
    } finally {
        homeBtn.classList.remove('hidden');
    }
}

init();