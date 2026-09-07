import { Player } from "../model/Player.js"
import * as PieceService from "../service/PieceService.js"
import * as PlayerInitializer from "../initializer/PlayerInitializer.js"
import { PIECE } from "../enum/Pieces.js";
import { DIRECTIONS } from "../enum/Directions.js";


export function createPlayer(color, webSocketId, userId) {
    const player = new Player(color, webSocketId, userId);
    return PlayerInitializer.initPlayer(player);
}

export function checkPlayerCanPlace(player) {
    if (player.inventory.every(v => v === 0)) {
        console.log(`[GAME SERVICE] Player ${player.color} hasn't enough inventory`);
        return false;
    }

    if (player.inventory.every(item => PieceService.getCooldown(item) > 0)) {
        console.log(`[GAME SERVICE] Player ${player.color} can't place any piece right now`);
        return false;
    }

    return true;
}

export function takeLastAvailablePiece(inventory) {
    for (let i = inventory.length - 1; i >= 0; i--) {
        if (inventory[i] !== 0 && PieceService.getCooldown(inventory[i]) === 0) {
            const piece = inventory[i];
            inventory[i] = 0;

            // rearrange inventory
            for (i; i < inventory.length - 1; i++) {
                inventory[i] = inventory[i + 1]
                inventory[i + 1] = 0;
            }

            return piece;
        }
    }

    throw new Error("No Pieces available");
}

export function decrementInventoryCD(player) {
    for (let i = 0; i < player.inventory.length; i++) {
        player.inventory[i] = PieceService.decrementCD(player.inventory[i]);
    }
}

export function addTriangleToInventory(player, number_of_triangle_to_add) {

    for (let i = 0; i < number_of_triangle_to_add; i++) {
        let triangle = PieceService.createPiece(PIECE.TRIANGLE, player.color, DIRECTIONS.NORTH, 1);
        player.addTriangle(triangle);
    }
}