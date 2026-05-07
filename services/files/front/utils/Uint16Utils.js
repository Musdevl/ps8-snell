import * as BoardUtils from "./BoardUtils.js"
import { MASK } from "../enum/Pieces.js"
import { DIRECTIONS, DIRECTION_ORDER } from "../enum/Directions.js";

export function parseBytesGrid(gridBuffers) {

    const grid = gridBuffers.map(buffer => new Uint8Array(buffer));

    let newBoard = BoardUtils.createEmptyBoard();

    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            const piece = grid[row][col];
            newBoard[row][col] = composePiece(piece);
        }
    }

    return newBoard;
}

export function rotatePiece(piece, direction) {
    const currentIndex = DIRECTION_ORDER.indexOf(piece.direction);

    switch (direction) {
        case DIRECTIONS.WEST:  // rotation gauche
            const newIndexRight = (currentIndex + 1) % 4;
            piece.direction = DIRECTION_ORDER[newIndexRight];
            return piece;

        case DIRECTIONS.EAST:  // rotation droite
            const newIndexLeft = (currentIndex + 3) % 4; // +3 = -1 en modulo 4
            piece.direction = DIRECTION_ORDER[newIndexLeft];
            return piece;

        default:
            throw new Error("Invalid Rotation");
    }
}

export function getPieceName(pieceUInt) {
    const pieceValue = getPiece(pieceUInt)

    const pieces = {
        1: 'triangle',
        2: 'full_mirror',
        3: 'shooter',
        4: 'protector',
        5: 'king',
    };

    return pieces[pieceValue];
}

export function getColorName(pieceUInt) {
    const colorValue = getColor(pieceUInt);

    const colors = {
        0: 'white',
        8: 'black'
    };

    return colors[colorValue];
}

export function parseInventory(inventoryBuffer) {

    const parsedInventory = new Uint8Array(inventoryBuffer);

    const newInventory = []

    for (let i = 0; i < parsedInventory.length; i++) {
        newInventory[i] = composePiece(parsedInventory[i]);
    }

    return newInventory;

}


function composePiece(piece) {
    if (piece !== 0) {

        const pieceName = getPieceName(piece);
        const color = getColor(piece);
        const direction = getDirection(piece);
        const cooldown = getCooldown(piece);

        return {
            pieceName,
            color,
            direction,
            cooldown
        }
    } else {
        return null;
    }
}

function getCooldown(piece) {
    return (piece & MASK.COOLDOWN) >> 6;
}

function getDirection(piece) {
    return piece & MASK.DIRECTION;
}

function getColor(piece) {
    return piece & MASK.COLOR;
}

function getPiece(piece) {
    return piece & MASK.PIECE;
}

function objectToArrayBuffer(obj) {
    const keys = Object.keys(obj).map(Number).sort((a, b) => a - b);
    const buffer = new ArrayBuffer(keys.length);
    const view = new Uint8Array(buffer);
    keys.forEach(key => { view[key] = obj[key]; });
    return buffer;
}

export function normalizeGameState(data) {
    data.grid = data.grid.map(row => objectToArrayBuffer(row));
    data.white_inventory = objectToArrayBuffer(data.white_inventory);
    data.black_inventory = objectToArrayBuffer(data.black_inventory);
    return data;
}