
import { MASK } from "../enum/Pieces.js"
import { DIRECTION_ORDER } from "../enum/Directions.js"

export function rotateLeft(piece) {
    const currentRotation = piece & 0b110000; // extraire rotation
    const currentIndex = DIRECTION_ORDER.indexOf(currentRotation);
    const newRotation = DIRECTION_ORDER[(currentIndex + 3) % 4];
    return (piece & 0b11001111) | newRotation; // remplacer rotation
}

export function rotateRight(piece) {
    const currentRotation = piece & 0b110000;
    const currentIndex = DIRECTION_ORDER.indexOf(currentRotation);
    const newRotation = DIRECTION_ORDER[(currentIndex + 1) % 4];
    return (piece & 0b11001111) | newRotation;
}

export function createPiece(piece, color, direction, cooldown) {
    return piece | color | direction | (cooldown << 6);
}

export function getRotation(piece) {
    return piece & MASK.DIRECTION;
}

export function getColor(piece) {
    return piece & MASK.COLOR;
}

export function getPiece(piece) {
    return piece & MASK.PIECE;
}

export function setDirection(piece, direction) { return (piece & ~MASK.DIRECTION) | direction; }

// Setter : vous passez l'INDEX (0-4)
export function setCooldown(piece, coolDownIndex) {
    const coolDownBits = (coolDownIndex << 6) & MASK.COOLDOWN;
    return (piece & ~MASK.COOLDOWN) | coolDownBits;
}

// Getter : retourne l'INDEX (0-4)
export function getCooldown(piece) {
    return (piece & MASK.COOLDOWN) >> 6;
}

// Décrémenter devient trivial
export function decrementCD(piece) {
    let cd = getCooldown(piece);
    if (cd > 0) {
        piece = setCooldown(piece, cd - 1);
    }
    return piece;
}