import * as accountService from '../../services/account-service.js';
import { GATEWAY_URL } from '../../env.js';

let puzzles_ = [];

// Puzzles

async function fetchPuzzles() {
    try {

        const res = await accountService.authFetch(`${GATEWAY_URL}/api/game/puzzles`)

        if (!res.ok) {
            console.error("Failed to load puzzles");
            puzzle_list.innerHTML += `<div class="no-puzzles-container"><span class="no-puzzles">No puzzles available...</span></div>`
        } else {

            const { puzzles } = await res.json();

            puzzles_ = puzzles;

            loadPuzzles();

            // puzzles.forEach(puzzle => {
            //     const item = document.createElement('div');
            //     item.classList.add('puzzle-item');
            //     item.innerHTML += `
            //         <div class="puzzle-item-left">
            //             <div class="puzzle-ico-container">
            //                 <img class="puzzle-ico" src="/assets/puzzle-piece-silver.svg">
            //                 <span class="puzzle-number">${puzzle.id}</span>
            //             </div>
            //             <div class="puzzle-name">
            //             ${puzzle.name}
            //             </div>
            //         </div>
            //         <div class="puzzle-item-right">
            //             <svg class="see-more-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            //                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            //                     <path d="m9 18 6-6-6-6"></path>
            //             </svg>
            //         </div>`

            //     item.addEventListener("click", () => {
            //         window.location.replace(`/pages/game/puzzle/index.html?id=${puzzle.id}`);
            //     })

            //     puzzle_list.appendChild(item);
            // });

        }

    } catch (error) {
        console.error('An Error Occured while fetching puzzles', error);
    }
}

function loadPuzzles(query = "") {
    try {
        const puzzle_list = document.querySelector('.puzzles')
        const displayed_puzzles = puzzles_.filter(p => p.name.toLowerCase().includes(query.toLocaleLowerCase()));

        puzzle_list.replaceChildren();

        displayed_puzzles.forEach(puzzle => {
            const item = document.createElement('div');
            item.classList.add('puzzle-item');
            item.innerHTML += `
                    <div class="puzzle-item-left">
                        <div class="puzzle-ico-container">
                            <img class="puzzle-ico" src="/assets/puzzle-piece-silver.svg">
                            <span class="puzzle-number">${puzzle.id}</span>
                        </div>
                        <div class="puzzle-name">
                        ${puzzle.name}
                        </div>
                    </div>
                    <div class="puzzle-item-right">
                        <svg class="see-more-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="m9 18 6-6-6-6"></path>
                        </svg>
                    </div>`

            item.addEventListener("click", () => {
                window.location.replace(`/pages/game/puzzle/index.html?id=${puzzle.id}`);
            })

            puzzle_list.appendChild(item);

        });
    } catch (error) {
        console.error("An Error occured while loading puzzles", error);
    }

}

function setupBtns() {

    try {
        const search_btn = document.querySelector('.search-puzzle-btn');
        search_btn.addEventListener('click', () => search_puzzles())

        const search_bar = document.querySelector('.search-puzzles');
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
    loadPuzzles(query);
}

setupBtns();
await fetchPuzzles();