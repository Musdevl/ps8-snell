import * as playerService from "./PlayerService.js";
import * as boardService from "./BoardService.js"
import { Board } from "../model/Board.js";
import { COLORS } from "../enum/Colors.js";
import { Game } from "../model/Game.js";

export const tutorial_actions = [
    "PLACE/91,0",  // WHITE
    "PLACE/71,16",  // BLACK
    "ROTATE/97,48", // WHITE
    "PLACE/61,16",  // BLACK
    "PLACE/67,32",  // WHITE
    "ROTATE/02,48", // BLACK
    "SWAP/56,74",   // WHITE
    "PLACE/64,0",  // BLACK
    "MOVE/54,53",   // WHITE
    "ROTATE/02,16",  // BLACK
    "PLACE/24,16"   // WHITE
];

export function initTutorial() {

    const white_player_mock = playerService.createPlayer(COLORS.WHITE, undefined, undefined);
    const black_player_mock = playerService.createPlayer(COLORS.BLACK, undefined, undefined);

    const tutorial_board = boardService.initTutorialBoard(new Board());

    const game = new Game(tutorial_board, "LOCAL", true);

    game.addPlayer(white_player_mock);
    game.addPlayer(black_player_mock);

    return game;
}
