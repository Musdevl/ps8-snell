import { DIRECTIONS } from "../enum/Directions.js";
import * as PieceService from "../../src/service/PieceService.js"
import { PIECE } from "../enum/Pieces.js";

export function initPlayer(player, number_of_triangle=7) {
    for (let i = 0; i < number_of_triangle; i++) {
        const piece = PieceService.createPiece(PIECE.TRIANGLE, player.getColor(), DIRECTIONS.NORTH, 0)
        player.inventory[i] = piece
    }

    return player;
}
