import * as engine from "../engine.js";
import { MOVE_TYPE, moveType, moveFrom, moveTo, movePayload, opponentOf } from "./moves.js";

/**
 * Etat de recherche : applique et annule un coup sur une seule instance de
 * Game, au lieu de cloner la partie a chaque noeud.
 *
 * Un clone complet alloue un Board, deux Player et quatre Uint8Array ; ici on
 * recopie 100 octets de grille et 28 octets d'inventaires dans une pile
 * pre-allouee, donc la recherche ne declenche aucun ramassage de miettes.
 */

const MAX_PLY = 64;
const BOARD_SIZE = 100;
const INVENTORY_SIZE = 14;

const COOLDOWN_UNIT = 1 << 6; // retirer un tour de cooldown = soustraire 64

export class SearchPosition {
    constructor(game) {
        this.game = game;
        this.ply = 0;
        this.beam = engine.createBeamTrace();

        this.savedGrids = new Uint8Array(MAX_PLY * BOARD_SIZE);
        this.savedInventories = new Uint8Array(MAX_PLY * INVENTORY_SIZE * 2);
        this.savedFlags = new Int32Array(MAX_PLY * 4); // colorTurn, count, roi blanc, roi noir
    }

    get board() { return this.game.board; }
    get colorTurn() { return this.game.colorTurn; }

    playerOf(color) { return this.game.getPlayerByColor(color); }

    kingAlive(color) { return this.game.getPlayerByColor(color).kingAlive; }

    isGameOver() {
        return !this.kingAlive(engine.COLORS.WHITE)
            || !this.kingAlive(engine.COLORS.BLACK)
            || this.game.count >= DRAW_MOVE_COUNT;
    }

    make(move) {
        this.save();

        const game = this.game;
        const color = game.colorTurn;
        const player = game.getPlayerByColor(color);

        decrementCooldowns(game.board.grid, player.inventory, color);
        const firesLaser = applyMove(game, move, color, player);

        if (firesLaser) {
            const shot = engine.shootBeam(game.board, color, game.players, { collectPath: false });
            engine.addTrianglesToInventories(game, shot.white_triangle_shooted, shot.black_triange_shooted);
        }

        game.count++;
        game.colorTurn = opponentOf(color);
        this.ply++;
    }

    unmake() {
        this.ply--;
        const game = this.game;
        const gridOffset = this.ply * BOARD_SIZE;
        const inventoryOffset = this.ply * INVENTORY_SIZE * 2;
        const flagOffset = this.ply * 4;

        game.board.grid.set(this.savedGrids.subarray(gridOffset, gridOffset + BOARD_SIZE));

        const white = game.getPlayerByColor(engine.COLORS.WHITE);
        const black = game.getPlayerByColor(engine.COLORS.BLACK);
        white.inventory.set(this.savedInventories.subarray(inventoryOffset, inventoryOffset + INVENTORY_SIZE));
        black.inventory.set(this.savedInventories.subarray(inventoryOffset + INVENTORY_SIZE, inventoryOffset + INVENTORY_SIZE * 2));

        game.colorTurn = this.savedFlags[flagOffset];
        game.count = this.savedFlags[flagOffset + 1];
        white.kingAlive = this.savedFlags[flagOffset + 2] === 1;
        black.kingAlive = this.savedFlags[flagOffset + 3] === 1;
    }

    save() {
        const game = this.game;
        const gridOffset = this.ply * BOARD_SIZE;
        const inventoryOffset = this.ply * INVENTORY_SIZE * 2;
        const flagOffset = this.ply * 4;

        this.savedGrids.set(game.board.grid, gridOffset);

        const white = game.getPlayerByColor(engine.COLORS.WHITE);
        const black = game.getPlayerByColor(engine.COLORS.BLACK);
        this.savedInventories.set(white.inventory, inventoryOffset);
        this.savedInventories.set(black.inventory, inventoryOffset + INVENTORY_SIZE);

        this.savedFlags[flagOffset] = game.colorTurn;
        this.savedFlags[flagOffset + 1] = game.count;
        this.savedFlags[flagOffset + 2] = white.kingAlive ? 1 : 0;
        this.savedFlags[flagOffset + 3] = black.kingAlive ? 1 : 0;
    }

    /** Cle de transposition : voir zobristKey plus bas. */
    key() {
        return zobristKey(this.game);
    }
}

export const DRAW_MOVE_COUNT = 200;

function decrementCooldowns(grid, inventory, color) {
    for (let cell = 0; cell < BOARD_SIZE; cell++) {
        const value = grid[cell];
        if (value !== 0 && (value & engine.MASK.COLOR) === color && (value & engine.MASK.COOLDOWN) !== 0)
            grid[cell] = value - COOLDOWN_UNIT;
    }
    for (let i = 0; i < INVENTORY_SIZE; i++) {
        const value = inventory[i];
        if (value !== 0 && (value & engine.MASK.COOLDOWN) !== 0) inventory[i] = value - COOLDOWN_UNIT;
    }
}

/**
 * Applique la mutation du plateau et dit si le laser part ensuite.
 * Un echange qui implique le tireur est le seul coup qui ne declenche pas de
 * tir (voir engine.swap : allowed_to_shoot).
 */
function applyMove(game, move, color, player) {
    const grid = game.board.grid;
    const from = moveFrom(move);

    switch (moveType(move)) {
        case MOVE_TYPE.MOVE: {
            grid[moveTo(move)] = grid[from];
            grid[from] = 0;
            return true;
        }
        case MOVE_TYPE.ROTATE: {
            grid[from] = movePayload(move) === 0 ? engine.rotateLeft(grid[from]) : engine.rotateRight(grid[from]);
            return true;
        }
        case MOVE_TYPE.SWAP: {
            const to = moveTo(move);
            const mirror = grid[from], target = grid[to];
            grid[from] = engine.setCooldown(target, 2);
            grid[to] = mirror;
            return (target & engine.MASK.PIECE) !== engine.PIECE.SHOOTER;
        }
        case MOVE_TYPE.PLACE: {
            const triangle = engine.takeLastAvailablePiece(player.inventory);
            grid[from] = engine.setDirection(triangle, engine.indexToDir(movePayload(move)));
            return true;
        }
        default:
            throw new Error(`Type de coup inconnu: ${move}`);
    }
}

// ─── HACHAGE ZOBRIST ─────────────────────────────────────────────────────────

/**
 * L'ancienne cle etait `${game.board.grid}_...`, ce qui construit une chaine
 * de ~300 caracteres a chaque noeud. On XOR ici 100 entiers tires une fois
 * pour toutes. Deux tables independantes sont combinees en un entier de 53
 * bits (le maximum exact d'un Number) pour rendre les collisions negligeables
 * a l'echelle d'une table de 200 000 entrees.
 */
const PIECE_STATES = 256;

function buildZobristTable(seed) {
    const table = new Int32Array(BOARD_SIZE * PIECE_STATES);
    let state = seed;
    for (let i = 0; i < table.length; i++) {
        state ^= state << 13; state |= 0;
        state ^= state >>> 17;
        state ^= state << 5; state |= 0;
        table[i] = state;
    }
    return table;
}

const ZOBRIST_HIGH = buildZobristTable(0x9e3779b9 | 0);
const ZOBRIST_LOW = buildZobristTable(0x85ebca6b | 0);
const SIDE_HIGH = 0x1f83d9ab | 0;
const SIDE_LOW = 0x5be0cd19 | 0;

export function zobristKey(game) {
    const grid = game.board.grid;
    let high = 0, low = 0;

    for (let cell = 0; cell < BOARD_SIZE; cell++) {
        const value = grid[cell];
        if (value === 0) continue;
        const index = cell * PIECE_STATES + value;
        high ^= ZOBRIST_HIGH[index];
        low ^= ZOBRIST_LOW[index];
    }

    // Les triangles en reserve font partie de la position : deux plateaux
    // identiques avec des inventaires differents ne sont pas transposables.
    high ^= countPlaceable(game, engine.COLORS.WHITE) * 0x27d4eb2d;
    low ^= countPlaceable(game, engine.COLORS.BLACK) * 0x165667b1;

    if (game.colorTurn === engine.COLORS.BLACK) { high ^= SIDE_HIGH; low ^= SIDE_LOW; }

    return (high >>> 0) * 2097152 + (low >>> 11);
}

function countPlaceable(game, color) {
    const inventory = game.getPlayerByColor(color).inventory;
    let count = 0;
    for (let i = 0; i < INVENTORY_SIZE; i++) if (inventory[i] !== 0) count++;
    return count;
}
