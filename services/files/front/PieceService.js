
import { MASK } from "../enum/Pieces.js"

export function rotateLeft(encoded) {
    const currentRotation = encoded & 0b110000; // extraire rotation
    const currentIndex = DIRECTION_ORDER.indexOf(currentRotation);
    const newRotation = DIRECTION_ORDER[(currentIndex + 3) % 4];
    return (encoded & 0b11001111) | newRotation; // remplacer rotation
}

export function rotateRight(encoded) {
    const currentRotation = encoded & 0b110000;
    const currentIndex = DIRECTION_ORDER.indexOf(currentRotation);
    const newRotation = DIRECTION_ORDER[(currentIndex + 1) % 4];
    return (encoded & 0b11001111) | newRotation;
}

export function createPiece(piece, color, direction, cooldown){
    return piece | color | direction | cooldown;
}

export function getCooldown(piece){
    return piece & MASK.COOLDOWN;
}

export function getRotation(piece){
    return piece & MASK.DIRECTION;
}

export function getColor(piece){
    return piece & MASK.COLOR;
}

export function getPiece(piece){
   return piece & MASK.PIECE;
}

export function setPiece(piece, newPiece){ return (piece & ~MASK.PIECE) | newPiece; }

export function setColor(piece, color) { return (piece & ~MASK.COLOR) | color; }

export function setDirection (piece, direction) { return (piece & ~MASK.DIRECTION) | direction; }

export function setCooldown(piece, coolDown) { return (piece & ~MASK.COOLDOWN) | coolDown; }