import { COLORS } from "../enum/Colors.js";
import * as pieceService from "../services/PieceService.js"

// Define in game Achievement with his own function

const autismo_debilo =
{
    content: {
        name: "Maximo Debilo",
        picture: "/assets/achievements/autismo-debilo.gif",
        reward: {
            snell_coins: 5
        },
        description: "Lose a game by shooting your own king."
    },
    check: (game_state_1, game_state_2) => { return autismo_debilo_achievement(game_state_1, game_state_2); }
}

function autismo_debilo_achievement(previous_game_state, next_game_state) {
    const previous_color_turn = previous_game_state.colorTurn;
    const winner_color = next_game_state.status;

    if (previous_color_turn === COLORS.WHITE && winner_color === "BLACK") return true;

    else if (previous_color_turn === COLORS.BLACK && winner_color === "WHITE") return true;

    return false;
}

const protector_slayer =
{
    content: {
        name: "Protector Slayer",
        picture: "/assets/achievements/protector_slayer.png",
        reward: {
            snell_coins: 10
        },
        description: "Detroy all of your opponent's protectors."
    },
    check: (game_state_1, game_state_2) => { return protector_destroyer_achievement(game_state_1, game_state_2); }
}

function protector_destroyer_achievement(previous_game_state, next_game_state) {
    const previous_grid = pieceService.convertIntGridToBin(previous_game_state.grid);
    const next_grid = pieceService.convertIntGridToBin(next_game_state.grid);

    const opponentColor = next_game_state.colorTurn;

    const hasAliveProtectorsInPreviousTurn = pieceService.findProtectors(previous_grid, opponentColor).length > 0;

    const hasAliveProtectorsInNextTurn = pieceService.findProtectors(next_grid, opponentColor).length > 0

    return hasAliveProtectorsInPreviousTurn && !hasAliveProtectorsInNextTurn
}


export const already_a_master =
{
    content: {
        name: "Already a Master ?",
        picture: "/assets/achievements/already_a_master.svg",
        reward: {
            snell_coins: 1
        },
        description: "Complete the tutorial."
    },
    // To Do
    check: () => { return true }
}

// const robber_master =
// {
//     content: {
//         name:"Robber master",
//         picture: "/assets/achievements/robber-master.gif",
//         reward: {
//             snell_coins: 15
//         },
//         description: "Steel all of your opponent's triangles"
//     },
//     check: (game_state_1, game_state_2) => { return robber_master(game_state_1) || robber_master(game_state_2) }
// }


// function robber_master(game_state) {

// }

// Export the list of in game achivement
export const in_game_achievements = [
    autismo_debilo,
    protector_slayer
]


export const blank_achievemnets = [
    { ...autismo_debilo.content, isCompleted: false },
    { ...protector_slayer.content, isCompleted: false },
    { ...already_a_master.content, isCompleted: false }
]