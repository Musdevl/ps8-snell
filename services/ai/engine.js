// ─── CONSTANTS ───────────────────────────────────────────────────────────────

export const COLORS = { WHITE: 0, BLACK: 8 };

export const PIECE = { NONE: 0, TRIANGLE: 1, FULL_MIRROR: 2, SHOOTER: 3, PROTECTOR: 4, KING: 5 };

export const DIRECTIONS = { NORTH: 0, EAST: 16, SOUTH: 32, WEST: 48 };

export const OPPOSITE_DIRECTIONS = { 0: 32, 16: 48, 32: 0, 48: 16 };

export const DIRECTION_ORDER = [DIRECTIONS.NORTH, DIRECTIONS.EAST, DIRECTIONS.SOUTH, DIRECTIONS.WEST];

export const ROTATION_DIRECTION = { CLOCK_WISE: 16, ANTI_CLOCK_WISE: 48 };

export const PLAYER_ACTION = { MOVE: "MOVE", ROTATE: "ROTATE", SWAP: "SWAP", PLACE: "PLACE" };

export const MASK = {
    PIECE: 0b00000111,
    COLOR: 0b00001000,
    DIRECTION: 0b00110000,
    COOLDOWN: 0b11000000
};


// ─── LOOKUP TABLES ───────────────────────────────────────────────────────────
// Les regles du laser sont figees : on les precalcule une fois dans des tables
// plates indexees par (rotationIndex * 4 + laserDirectionIndex). Les predicats
// ci-dessous sont appeles des centaines de milliers de fois par recherche IA ;
// construire un objet litteral a chaque appel coutait plus cher que le trace
// du faisceau lui-meme.

export const dirIndex = d => d >> 4;              // 0/16/32/48 -> 0/1/2/3
export const indexToDir = i => i << 4;

export const BEAM_DELTA_ROW = [-1, 0, 1, 0];      // indexe par dirIndex
export const BEAM_DELTA_COL = [0, 1, 0, -1];

function buildTable(spec, fallback) {
    const table = new Int8Array(16).fill(fallback);
    for (const [rotation, entries] of Object.entries(spec))
        for (const [laserDir, value] of Object.entries(entries))
            table[dirIndex(+rotation) * 4 + dirIndex(+laserDir)] = value;
    return table;
}

const TRIANGLE_VULNERABLE = buildTable({
    [DIRECTIONS.NORTH]: { [DIRECTIONS.NORTH]: 1, [DIRECTIONS.EAST]: 1 },
    [DIRECTIONS.EAST]:  { [DIRECTIONS.EAST]: 1,  [DIRECTIONS.SOUTH]: 1 },
    [DIRECTIONS.SOUTH]: { [DIRECTIONS.SOUTH]: 1, [DIRECTIONS.WEST]: 1 },
    [DIRECTIONS.WEST]:  { [DIRECTIONS.WEST]: 1,  [DIRECTIONS.NORTH]: 1 },
}, 0);

// -1 = pas de rebond (le triangle est vulnerable depuis cette direction).
const TRIANGLE_BOUNCE = buildTable({
    [DIRECTIONS.NORTH]: { [DIRECTIONS.SOUTH]: DIRECTIONS.EAST,  [DIRECTIONS.WEST]:  DIRECTIONS.NORTH },
    [DIRECTIONS.EAST]:  { [DIRECTIONS.NORTH]: DIRECTIONS.EAST,  [DIRECTIONS.WEST]:  DIRECTIONS.SOUTH },
    [DIRECTIONS.SOUTH]: { [DIRECTIONS.NORTH]: DIRECTIONS.WEST,  [DIRECTIONS.EAST]:  DIRECTIONS.SOUTH },
    [DIRECTIONS.WEST]:  { [DIRECTIONS.SOUTH]: DIRECTIONS.WEST,  [DIRECTIONS.EAST]:  DIRECTIONS.NORTH },
}, -1);

// Un miroir plein renvoie toujours le faisceau, quelle que soit l'incidence.
const MIRROR_BOUNCE = buildTable({
    [DIRECTIONS.NORTH]: { [DIRECTIONS.NORTH]: DIRECTIONS.WEST, [DIRECTIONS.EAST]: DIRECTIONS.SOUTH, [DIRECTIONS.SOUTH]: DIRECTIONS.EAST, [DIRECTIONS.WEST]: DIRECTIONS.NORTH },
    [DIRECTIONS.SOUTH]: { [DIRECTIONS.NORTH]: DIRECTIONS.WEST, [DIRECTIONS.EAST]: DIRECTIONS.SOUTH, [DIRECTIONS.SOUTH]: DIRECTIONS.EAST, [DIRECTIONS.WEST]: DIRECTIONS.NORTH },
    [DIRECTIONS.EAST]:  { [DIRECTIONS.NORTH]: DIRECTIONS.EAST, [DIRECTIONS.EAST]: DIRECTIONS.NORTH, [DIRECTIONS.SOUTH]: DIRECTIONS.WEST, [DIRECTIONS.WEST]: DIRECTIONS.SOUTH },
    [DIRECTIONS.WEST]:  { [DIRECTIONS.NORTH]: DIRECTIONS.EAST, [DIRECTIONS.EAST]: DIRECTIONS.NORTH, [DIRECTIONS.SOUTH]: DIRECTIONS.WEST, [DIRECTIONS.WEST]: DIRECTIONS.SOUTH },
}, -1);

// Un protecteur ne bloque que le faisceau qui arrive pile en face de lui.
const PROTECTOR_SAFE_FROM = {
    [DIRECTIONS.NORTH]: DIRECTIONS.SOUTH,
    [DIRECTIONS.SOUTH]: DIRECTIONS.NORTH,
    [DIRECTIONS.WEST]:  DIRECTIONS.EAST,
    [DIRECTIONS.EAST]:  DIRECTIONS.WEST,
};

const PROTECTOR_VULNERABLE = (() => {
    const table = new Int8Array(16).fill(1);
    for (const [rotation, safeDir] of Object.entries(PROTECTOR_SAFE_FROM))
        table[dirIndex(+rotation) * 4 + dirIndex(safeDir)] = 0;
    return table;
})();

// ─── PIECE UTILS ─────────────────────────────────────────────────────────────

export const getPiece = p => p & MASK.PIECE;
export const getColor = p => p & MASK.COLOR;
export const getRotation = p => p & MASK.DIRECTION;
export const getCooldown = p => (p & MASK.COOLDOWN) >> 6;

export const setDirection = (p, d) => (p & ~MASK.DIRECTION) | d;
export const setCooldown = (p, cd) => (p & ~MASK.COOLDOWN) | ((cd << 6) & MASK.COOLDOWN);
export const decrementCD = p => { const cd = getCooldown(p); return cd > 0 ? setCooldown(p, cd - 1) : p; };

export function createPiece(piece, color, direction, cooldown) {
    return piece | color | direction | (cooldown << 6);
}

const ROTATE_CW = { 0: 16, 16: 32, 32: 48, 48: 0 };
const ROTATE_CCW = { 0: 48, 16: 0, 32: 16, 48: 32 };

export function rotateLeft(p) {
    return (p & 0b11001111) | ROTATE_CCW[p & 0b110000];
}

export function rotateRight(p) {
    return (p & 0b11001111) | ROTATE_CW[p & 0b110000];
}

// ─── BOARD ───────────────────────────────────────────────────────────────────

export class Board {
    constructor() {
        this.grid = new Uint8Array(100); // flat [r*10+c]
    }
    getSlot(r, c) { return this.grid[r * 10 + c]; }
    setSlot(r, c, v) { this.grid[r * 10 + c] = v; }
    killSlot(r, c) { this.grid[r * 10 + c] = 0; }
    clone() {
        const b = new Board();
        b.grid.set(this.grid); // une seule copie mémoire, très rapide
        return b;
    }
}

// ─── PLAYER ──────────────────────────────────────────────────────────────────

export class Player {
    constructor(color) {
        this.color = color;
        this.kingAlive = true;
        this.inventory = new Uint8Array(14);
        // Init 7 triangles
        for (let i = 0; i < 7; i++)
            this.inventory[i] = createPiece(PIECE.TRIANGLE, color, DIRECTIONS.NORTH, 0);
    }
    hasKingAlive() { return this.kingAlive; }
    killKing() { this.kingAlive = false; }
    getColor() { return this.color; }
    getInventory() { return this.inventory; }

    clone() {
        const c = new Player(this.color);
        c.kingAlive = this.kingAlive;
        c.inventory = new Uint8Array(this.inventory);
        return c;
    }
}

// ─── PLAYER UTILS ────────────────────────────────────────────────────────────

export function checkPlayerCanPlace(player) {
    let hasAvailable = false;
    for (const v of player.inventory) {
        if (v !== 0 && getCooldown(v) === 0) return true;
    }
    return false;
}

export function takeLastAvailablePiece(inventory) {
    for (let i = inventory.length - 1; i >= 0; i--) {
        if (inventory[i] !== 0 && getCooldown(inventory[i]) === 0) {
            const piece = inventory[i];
            inventory[i] = 0;
            for (; i < inventory.length - 1; i++) { inventory[i] = inventory[i + 1]; inventory[i + 1] = 0; }
            return piece;
        }
    }
    throw new Error("No pieces available");
}

export function decrementInventoryCD(player) {
    for (let i = 0; i < player.inventory.length; i++)
        player.inventory[i] = decrementCD(player.inventory[i]);
}

export function addTriangleToInventory(player, count) {
    for (let i = 0; i < count; i++) {
        const t = createPiece(PIECE.TRIANGLE, player.color, DIRECTIONS.NORTH, 1);
        for (let j = 0; j < player.inventory.length; j++) {
            if (player.inventory[j] === 0) { player.inventory[j] = t; break; }
        }
    }
}

// ─── GAME ────────────────────────────────────────────────────────────────────

export class Game {
    constructor(board) {
        this.board = board;
        this.colorTurn = COLORS.WHITE;
        this.count = 0;
        this.laserBeam = [];
        this.isGameOver = false;
        this.players = [new Player(COLORS.WHITE), new Player(COLORS.BLACK)];
    }

    getPlayerByColor(color) {
        return color === COLORS.WHITE ? this.players[0] : this.players[1];
    }

    incrementCount() {
        this.count++;
        this.colorTurn = this.colorTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    }
    clone() {
        const g = new Game(this.board.clone());
        g.colorTurn = this.colorTurn;
        g.count = this.count;
        g.laserBeam = [...this.laserBeam];
        g.isGameOver = this.isGameOver;
        g.players = this.players.map(p => p.clone());
        return g;
    }
}

// ─── BOARD ACTIONS ───────────────────────────────────────────────────────────

export function move(board, action, colorTurn) {
    const { oldRow, oldCol, newRow, newCol } = stringToMove(action);
    const piece = board.getSlot(oldRow, oldCol);
    if (getColor(piece) !== colorTurn) throw new Error("Wrong color");
    if (getPiece(piece) === PIECE.SHOOTER || getPiece(piece) === PIECE.KING) throw new Error("Can't move this piece");
    if (board.getSlot(newRow, newCol) !== 0) throw new Error("Target cell not empty");
    board.setSlot(newRow, newCol, piece);
    board.setSlot(oldRow, oldCol, 0);
}

export function place(player, board, action, color) {
    if (!checkPlayerCanPlace(player)) throw new Error("Can't place");
    const { row, col, direction } = stringToPlace(action);
    if (board.getSlot(row, col) !== 0 || isNearToYourKing(board, row, col, color) || isNearToAShooter(board, row, col))
        throw new Error("Can't place here");
    let triangle = takeLastAvailablePiece(player.getInventory());
    triangle = setDirection(triangle, direction);
    board.setSlot(row, col, triangle);
}

export function swap(board, action, color) {
    const { firstPieceRow: r1, firstPieceCol: c1, secondPieceRow: r2, secondPieceCol: c2 } = stringToSwap(action);
    const p1 = board.getSlot(r1, c1), p2 = board.getSlot(r2, c2);
    if (!p1 || !p2) throw new Error("Empty slot");
    if (getCooldown(p1) > 0 || getCooldown(p2) > 0) throw new Error("Cooldown active");
    if (getColor(p1) !== color && getColor(p2) !== color) throw new Error("Wrong color");
    if (getColor(p1) !== getColor(p2)) throw new Error("Must be same color");
    if (getPiece(p1) !== PIECE.FULL_MIRROR) throw new Error("First piece must be full mirror");
    board.setSlot(r1, c1, setCooldown(p2, 2));
    board.setSlot(r2, c2, p1);
    return { allowed_to_shoot: getPiece(p1) !== PIECE.SHOOTER && getPiece(p2) !== PIECE.SHOOTER };
}

export function rotate(board, action) {
    const { row, col, direction } = stringToRotate(action);
    let piece = board.getSlot(row, col);
    if (!piece) throw new Error("Empty cell");
    if (getPiece(piece) === PIECE.KING) throw new Error("Can't rotate King");
    piece = direction === ROTATION_DIRECTION.CLOCK_WISE ? rotateLeft(piece) : rotateRight(piece);
    board.setSlot(row, col, piece);
}

// ─── LASER ───────────────────────────────────────────────────────────────────

/**
 * Tir du laser du camp `colorTurn` : detruit ce qui est touche et renvoie le
 * trajet parcouru. `collectPath` peut etre mis a false par la recherche IA,
 * qui n'a pas besoin du trajet et economise ainsi une allocation par noeud.
 */
export function shootBeam(board, colorTurn, players = [], { collectPath = true } = {}) {
    const [shooter, pos] = findShooter(board, colorTurn);
    const grid = board.grid;
    let dirIdx = dirIndex(shooter & MASK.DIRECTION);
    let r = pos[0], c = pos[1];
    const laserPath = [];
    let white_triangle_shooted = 0, black_triange_shooted = 0;

    const seen = beamSeen;
    beamStamp++;

    while (true) {
        r += BEAM_DELTA_ROW[dirIdx];
        c += BEAM_DELTA_COL[dirIdx];
        if (r < 0 || r > 9 || c < 0 || c > 9) break;

        const square = r * 10 + c;
        if (seen[square] === beamStamp) break;
        seen[square] = beamStamp;
        if (collectPath) laserPath.push([r, c]);

        const cell = grid[square];
        const piece = cell & MASK.PIECE;
        if (piece === PIECE.NONE) continue;

        const tableIndex = dirIndex(cell & MASK.DIRECTION) * 4 + dirIdx;

        if (piece === PIECE.TRIANGLE) {
            if (TRIANGLE_VULNERABLE[tableIndex] === 1) {
                if ((cell & MASK.COLOR) === COLORS.WHITE) white_triangle_shooted++;
                else black_triange_shooted++;
                grid[square] = 0;
            } else {
                dirIdx = dirIndex(TRIANGLE_BOUNCE[tableIndex]);
            }
            continue;
        }
        if (piece === PIECE.FULL_MIRROR) {
            dirIdx = dirIndex(MIRROR_BOUNCE[tableIndex]);
            continue;
        }
        if (piece === PIECE.KING) {
            for (const p of players) if (p.getColor() === (cell & MASK.COLOR)) p.killKing();
            grid[square] = 0;
            continue;
        }
        if (piece === PIECE.PROTECTOR) {
            if (PROTECTOR_VULNERABLE[tableIndex] === 1) { grid[square] = 0; continue; }
            break;
        }
        if (piece === PIECE.SHOOTER) break;
    }

    return { laserPath, white_triangle_shooted, black_triange_shooted };
}

export function hasCycle(path) {
    const seen = new Set();
    for (const [r, c] of path) {
        const key = r * 10 + c;
        if (seen.has(key)) return true;
        seen.add(key);
    }
    return false;
}

export function findShooter(board, color) {
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 10; c++) {
            const cell = board.getSlot(r, c);
            if (getPiece(cell) === PIECE.SHOOTER && getColor(cell) === color) return [cell, [r, c]];
        }
    throw new Error("Shooter not found");
}

export function isTriangleVulnerable(piece, laserDir) {
    return TRIANGLE_VULNERABLE[dirIndex(getRotation(piece)) * 4 + dirIndex(laserDir)] === 1;
}

export function getTriangleBounceDirection(piece, inDir) {
    const out = TRIANGLE_BOUNCE[dirIndex(getRotation(piece)) * 4 + dirIndex(inDir)];
    return out === -1 ? null : out;
}

export function getFullMirrorBounceDirection(piece, inDir) {
    const out = MIRROR_BOUNCE[dirIndex(getRotation(piece)) * 4 + dirIndex(inDir)];
    return out === -1 ? null : out;
}

export function isProtectorVulnerable(piece, laserDir) {
    return PROTECTOR_VULNERABLE[dirIndex(getRotation(piece)) * 4 + dirIndex(laserDir)] === 1;
}

// ─── TRACE DU FAISCEAU (LECTURE SEULE) ───────────────────────────────────────

const MAX_BEAM_HITS = 16;

/**
 * Rejoue exactement la trajectoire de shootBeam sans rien detruire : on veut
 * savoir ce qui SERAIT touche si ce camp tirait maintenant. C'est la primitive
 * de base de l'evaluation et du generateur de coups tactiques de l'IA.
 *
 * Attention : le faisceau TRAVERSE ce qu'il detruit (shootBeam fait killSlot
 * puis continue). Un seul tir peut donc faire plusieurs victimes, y compris
 * dans les deux camps a la fois. On collecte donc tous les impacts, pas
 * seulement le premier. Le faisceau ne s'arrete que sur un bord, une boucle,
 * un protecteur presente de face, ou un tireur.
 *
 * `out` est un objet reutilisable (cree par createBeamTrace) pour ne rien
 * allouer dans la boucle chaude.
 */
export function createBeamTrace() {
    return {
        path: new Int8Array(128),
        pathLength: 0,
        hitSquares: new Int8Array(MAX_BEAM_HITS),
        hitValues: new Uint8Array(MAX_BEAM_HITS),
        hitCount: 0,
    };
}

export function traceBeam(board, color, out) {
    out.pathLength = 0;
    out.hitCount = 0;

    const start = findShooterSquare(board, color);
    if (start < 0) return out;

    const grid = board.grid;
    let dirIdx = dirIndex(grid[start] & MASK.DIRECTION);
    let r = (start / 10) | 0, c = start % 10;

    const seen = beamSeen;
    beamStamp++;

    while (out.pathLength < out.path.length) {
        r += BEAM_DELTA_ROW[dirIdx];
        c += BEAM_DELTA_COL[dirIdx];
        if (r < 0 || r > 9 || c < 0 || c > 9) return out;

        const square = r * 10 + c;
        if (seen[square] === beamStamp) return out; // le faisceau boucle
        seen[square] = beamStamp;
        out.path[out.pathLength++] = square;

        const value = grid[square];
        const piece = value & MASK.PIECE;
        if (piece === PIECE.NONE) continue;

        const tableIndex = dirIndex(value & MASK.DIRECTION) * 4 + dirIdx;

        if (piece === PIECE.TRIANGLE) {
            if (TRIANGLE_VULNERABLE[tableIndex] === 1) recordHit(out, square, value);
            else dirIdx = dirIndex(TRIANGLE_BOUNCE[tableIndex]);
            continue;
        }
        if (piece === PIECE.FULL_MIRROR) {
            dirIdx = dirIndex(MIRROR_BOUNCE[tableIndex]);
            continue;
        }
        if (piece === PIECE.PROTECTOR) {
            if (PROTECTOR_VULNERABLE[tableIndex] === 1) { recordHit(out, square, value); continue; }
            return out; // face blindee : le faisceau s'arrete sans degat
        }
        if (piece === PIECE.SHOOTER) return out;

        recordHit(out, square, value); // ROI : detruit, et le faisceau poursuit
    }
    return out;
}

/** Le roi de `color` est-il detruit par le tir de `shooterColor` tel qu'oriente ? */
export function beamKillsKing(board, shooterColor, kingColor, out) {
    traceBeam(board, shooterColor, out);
    for (let i = 0; i < out.hitCount; i++) {
        const value = out.hitValues[i];
        if ((value & MASK.PIECE) === PIECE.KING && (value & MASK.COLOR) === kingColor) return true;
    }
    return false;
}

const beamSeen = new Int32Array(100);
let beamStamp = 0;

function recordHit(out, square, value) {
    if (out.hitCount >= MAX_BEAM_HITS) return;
    out.hitSquares[out.hitCount] = square;
    out.hitValues[out.hitCount] = value;
    out.hitCount++;
}

export function findShooterSquare(board, color) {
    const grid = board.grid;
    for (let square = 0; square < 100; square++) {
        const value = grid[square];
        if ((value & MASK.PIECE) === PIECE.SHOOTER && (value & MASK.COLOR) === color) return square;
    }
    return -1;
}

// ─── PLACEMENT HELPERS ───────────────────────────────────────────────────────

export function isNearToYourKing(board, row, col, color) {
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const r = row + dr, c = col + dc;
        if (r >= 0 && r < 10 && c >= 0 && c < 10) {
            const cell = board.getSlot(r, c);
            if (getPiece(cell) === PIECE.KING && getColor(cell) === color) return true;
        }
    }
    return false;
}

export function isNearToAShooter(board, row, col) {
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const r = row + dr, c = col + dc;
        if (r >= 0 && r < 10 && c >= 0 && c < 10 && getPiece(board.getSlot(r, c)) === PIECE.SHOOTER) return true;
    }
    return false;
}

// ─── GAME ACTIONS ────────────────────────────────────────────────────────────

export function placeAction(game, action, colorTurn) {
    let laserResult = { laserPath: [], white_triangle_shooted: 0, black_triange_shooted: 0 };

    switch (action.split("/")[0]) {
        case PLAYER_ACTION.MOVE:
            move(game.board, action, colorTurn);
            laserResult = shootBeam(game.board, game.colorTurn, game.players);
            break;
        case PLAYER_ACTION.ROTATE:
            rotate(game.board, action);
            laserResult = shootBeam(game.board, game.colorTurn, game.players);
            break;
        case PLAYER_ACTION.SWAP: {
            const res = swap(game.board, action, colorTurn);
            if (res.allowed_to_shoot) laserResult = shootBeam(game.board, game.colorTurn, game.players);
            break;
        }
        case PLAYER_ACTION.PLACE:
            place(game.getPlayerByColor(colorTurn), game.board, action, colorTurn);
            laserResult = shootBeam(game.board, game.colorTurn, game.players);
            break;
        default:
            throw new Error(`Invalid action: ${action}`);
    }

    game.laserBeam = laserResult.laserPath;
    addTrianglesToInventories(game, laserResult.white_triangle_shooted, laserResult.black_triange_shooted);
    game.incrementCount();
    return checkGameStatus(game);
}

export function decrementPiecesCD(game) {
    decrementInventoryCD(game.getPlayerByColor(game.colorTurn));
    decrementBoardPieces(game.board, game.colorTurn);
}

export function decrementBoardPieces(board, colorTurn) {
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 10; c++) {
            const p = board.getSlot(r, c);
            if (getColor(p) === colorTurn) board.setSlot(r, c, decrementCD(p));
        }
}

export function addTrianglesToInventories(game, wt, bt) {
    addTriangleToInventory(game.getPlayerByColor(COLORS.WHITE), bt);
    addTriangleToInventory(game.getPlayerByColor(COLORS.BLACK), wt);
}

// ─── GAME STATUS ─────────────────────────────────────────────────────────────

export function checkGameStatus(game) {
    const w = game.getPlayerByColor(COLORS.WHITE);
    const b = game.getPlayerByColor(COLORS.BLACK);
    if ((!w.hasKingAlive() && !b.hasKingAlive()) || game.count >= 200) return "DRAW";
    if (!w.hasKingAlive()) return "BLACK";
    if (!b.hasKingAlive()) return "WHITE";
    if (game.isGameOver) return game.colorTurn === COLORS.WHITE ? "BLACK" : "WHITE";
    return "CONTINUE";
}

// ─── ACTION GENERATORS ───────────────────────────────────────────────────────

export function getPlayerPieces(board, color) {
    const res = [];
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 10; c++) {
            const v = board.getSlot(r, c);
            if (v && getColor(v) === color) res.push({ value: v, row: r, col: c });
        }

    return res;
}

export function getAllAvailableCells(board, color) {
    const res = [];
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 10; c++)
            if (board.getSlot(r, c) === 0 && !isNearToAShooter(board, r, c) && !isNearToYourKing(board, r, c, color))
                res.push({ row: r, col: c });
    return res;
}

export function getSwappableCells(board, row, col) {
    const color = getColor(board.getSlot(row, col));
    const res = [];
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 10; c++) {
            const p = board.getSlot(r, c);
            if (p && getColor(p) === color && getCooldown(p) === 0 &&
                (getPiece(p) === PIECE.KING || getPiece(p) === PIECE.SHOOTER))
                res.push({ row: r, col: c });
        }
    return res;
}


function collectSwaps(game, actions, color) {
    const mirror = getPlayerPieces(game.board, color)
        .find(p => getPiece(p.value) === PIECE.FULL_MIRROR);
    if (!mirror) return;

    for (const cell of getSwappableCells(game.board, mirror.row, mirror.col))
        actions.push(`SWAP/${mirror.row}${mirror.col},${cell.row}${cell.col}`);
}
function collectMoves(game, actions, color) {
    for (const piece of getPlayerPieces(game.board, color)) {
        if (getCooldown(piece.value) > 0
            || getPiece(piece.value) === PIECE.SHOOTER
            || getPiece(piece.value) === PIECE.KING) continue;

        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const r = piece.row + dr, c = piece.col + dc;
            if (r >= 0 && r < 10 && c >= 0 && c < 10 && game.board.getSlot(r, c) === 0)
                actions.push(`MOVE/${piece.row}${piece.col},${r}${c}`);
        }
    }
}

function collectPlaces(game, actions, color) {
    const player = game.getPlayerByColor(color);
    if (!checkPlayerCanPlace(player)) return;

    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            if (game.board.getSlot(r, c) !== 0) continue;
            if (isNearToAShooter(game.board, r, c)) continue;
            if (isNearToYourKing(game.board, r, c, player.color)) continue;

            for (const d of DIRECTION_ORDER)
                actions.push(`PLACE/${r}${c},${d}`);
        }
    }
}

function collectRotations(game, actions, color) {
    for (const piece of getPlayerPieces(game.board, color)) {
        if (getPiece(piece.value) === PIECE.KING) continue;
        actions.push(`ROTATE/${piece.row}${piece.col},${ROTATION_DIRECTION.CLOCK_WISE}`);
        actions.push(`ROTATE/${piece.row}${piece.col},${ROTATION_DIRECTION.ANTI_CLOCK_WISE}`);
    }
}

export function getAllActions(game, color = game.colorTurn) {
    const actions = [];
    collectMoves(game, actions, color);
    collectPlaces(game, actions, color);
    collectSwaps(game, actions, color);
    collectRotations(game, actions, color);
    return actions;
}

// ─── ACTION SERIALIZERS ──────────────────────────────────────────────────────

export function stringToMove(s) {
    const [, payload] = s.split("/");
    const [a, b] = payload.split(",");
    return { oldRow: +a[0], oldCol: +a[1], newRow: +b[0], newCol: +b[1] };
}

export function stringToPlace(s) {
    const [, payload] = s.split("/");
    const [coords, dir] = payload.split(",");
    return { row: +coords[0], col: +coords[1], direction: +dir };
}

export function stringToSwap(s) {
    const [, payload] = s.split("/");
    const [a, b] = payload.split(",");
    return { firstPieceRow: +a[0], firstPieceCol: +a[1], secondPieceRow: +b[0], secondPieceCol: +b[1] };
}

export function stringToRotate(s) {
    const [, payload] = s.split("/");
    const [coords, dir] = payload.split(",");
    return { row: +coords[0], col: +coords[1], direction: +dir };
}