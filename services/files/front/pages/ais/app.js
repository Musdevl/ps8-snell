import * as accountService from '../../services/account-service.js';
import { GATEWAY_URL } from '../../env.js';

let ais_ = [];

// Puzzles

async function fetchAis() {
    try {

        const res = await accountService.authFetch(`${GATEWAY_URL}/api/ais`)

        if (!res.ok) {
            console.error("Failed to load ais");
            puzzle_list.innerHTML += `<div class="no-ais-container"><span class="no-ais">No Ai available...</span></div>`
        } else {

            const { ais } = await res.json();

            loadAis(ais);
        }

    } catch (error) {
        console.error('An Error Occured while fetching ais', error);
    }
}

function loadAis(ais, query = "") {
    try {
        const ai_list = document.querySelector('.ais')
        const displayed_ai = ais.filter(p => p.name.toLowerCase().includes(query.toLocaleLowerCase()));

        ai_list.replaceChildren();

        displayed_ai.forEach(ai => {
            const item = document.createElement('div');
            item.classList.add('ai-item');
            item.innerHTML += `
                        <div class="ai-ico-container">
                            <img class="ai-ico" src="${ai.path}">
                        </div>
                        <div class="ai-info">
                        <span class="ai-name">${ai.name}</span>
                        <span class="ai-elo">${ai.elo}</span>
                        </div>
                        `
            item.addEventListener("click", () => {
                window.location.replace(`/pages/game/ai-game/index.html?id=${ai.id}`);
            })

            ai_list.appendChild(item);

        });
    } catch (error) {
        console.error("An Error occured while loading ais", error);
    }

}

function setupBtns() {

    try {
        const search_btn = document.querySelector('.search-ai-btn');
        search_btn.addEventListener('click', () => search_puzzles())

        const search_bar = document.querySelector('.search-ais');
        search_bar.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                search_puzzles()
            }
        })


    } catch (error) {
        console.error("Failed to setup search btn", error);
    }

    try {
        const leave = document.querySelectorAll('.leave-ico');
        leave.forEach(l => l.addEventListener("click", () => window.location.replace('/')));
    } catch (error) {
        console.error("Failed to setup leave btn", error);
    }

}

function search_puzzles() {
    const query = document.querySelector('.search-puzzles').value ?? ""
    loadAis(query);
}

setupBtns();
await fetchAis();