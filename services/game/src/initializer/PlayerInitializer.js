import { DIRECTIONS } from "../enum/Directions.js";
import * as PieceService from "../../src/service/PieceService.js"
import { PIECE } from "../enum/Pieces.js";

export function initPlayer(player) {
    for (let i = 0; i < 7; i++) {
        const piece = PieceService.createPiece(PIECE.TRIANGLE, player.getColor(), DIRECTIONS.NORTH, 0)
        player.inventory[i] = piece
    }

    return player;
}
