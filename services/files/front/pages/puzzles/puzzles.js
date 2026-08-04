import * as accountService from '../../services/account-service.js'; 
import { GATEWAY_URL } from '../../env.js';

// Mobile

if (accountService.isLoggedIn()) {

    const snell_coins = document.getElementById('snell-coins');
    snell_coins.textContent = accountService.getSnellCoins();
    snell_coins.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        console.log('[BUY] Initiating checkout...');

        const userId = accountService.getUserId();
        if (!userId) {
            console.error("User ID non trouvé");
            return;
        }

        try {
            const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/shop/create-checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                console.error("Pas d'URL Stripe reçue", data);
            }
        } catch (err) {
            console.error('[BUY] Fetch error:', err);
        }
    });
} else {
    document.querySelector('.snell-coins-container').style.display = "none";
}


// Puzzles

async function loadPuzzles() {
    try {
        const puzzle_list = document.querySelector('.puzzles')
        const res = await accountService.authFetch(`${GATEWAY_URL}/api/game/puzzles`)

        if (!res.ok) {
            console.error("Failed to load puzzles");
            puzzle_list.innerHTML += `<div class="no-puzzles-container"><span class="no-puzzles">No puzzles available...</span></div>`
        } else {

            const puzzles = await res.json();

            for (puzzle in puzzles) {
                puzzle_list.innerHTML +=
                    `<div class="puzzle-item">
                    <div class="puzzle-ico-container">
                        <img class="puzzle-ico" src="/assets/puzzle-piece-silver.svg">
                        <span>${puzzle.number}</span>
                    </div>
                    <div class="">
                    </div>
                </div>`
            }

        }

    } catch (error) {
        console.error('An Error Occured while fetching puzzles', error);
    }
}


await loadPuzzles();