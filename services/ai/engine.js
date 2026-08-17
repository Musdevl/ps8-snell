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

export function shootBeam(board, colorTurn, players = []) {
    const [shooter, pos] = findShooter(board, colorTurn);
    let dir = shooter & MASK.DIRECTION;
    let r = pos[0], c = pos[1];
    const laserPath = [];
    const visited = new Set();
    const delta = { 0: [-1, 0], 32: [1, 0], 48: [0, -1], 16: [0, 1] };
    let white_triangle_shooted = 0, black_triange_shooted = 0;

    while (true) {
        r += delta[dir][0];
        c += delta[dir][1];

        if (r < 0 || r >= 10 || c < 0 || c >= 10) break;

        const key = r * 10 + c;
        if (visited.has(key)) break;
        visited.add(key);
        laserPath.push([r, c]);

        const cell = board.getSlot(r, c);

        if (getPiece(cell) === PIECE.NONE) { /* empty */ }
        else if (getPiece(cell) === PIECE.TRIANGLE) {
            if (isTriangleVulnerable(cell, dir)) {
                if (getColor(cell) === COLORS.WHITE) white_triangle_shooted++;
                else black_triange_shooted++;
                board.killSlot(r, c);
            } else { dir = getTriangleBounceDirection(cell, dir); }
        }
        else if (getPiece(cell) === PIECE.FULL_MIRROR) { dir = getFullMirrorBounceDirection(cell, dir); }
        else if (getPiece(cell) === PIECE.KING) {
            players.forEach(p => { if (p.getColor() === (cell & MASK.COLOR)) p.killKing(); });
            board.killSlot(r, c);
        }
        else if (getPiece(cell) === PIECE.PROTECTOR) {
            if (isProtectorVulnerable(cell, dir)) board.killSlot(r, c);
            else break;
        }
        else if (getPiece(cell) === PIECE.SHOOTER) { break; }
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
    const d = getRotation(piece);
    const vuln = {
        [DIRECTIONS.SOUTH]: [48, 32],
        [DIRECTIONS.WEST]: [0, 48],
        [DIRECTIONS.NORTH]: [0, 16],
        [DIRECTIONS.EAST]: [16, 32],
    };
    return (vuln[d] || []).includes(laserDir);
}

export function getTriangleBounceDirection(piece, inDir) {
    const map = {
        [DIRECTIONS.SOUTH]: { 0: 48, 16: 32 },
        [DIRECTIONS.WEST]: { 32: 48, 16: 0 },
        [DIRECTIONS.NORTH]: { 32: 16, 48: 0 },
        [DIRECTIONS.EAST]: { 0: 16, 48: 32 },
    };
    return map[getRotation(piece)]?.[inDir] ?? null;
}

export function getFullMirrorBounceDirection(piece, inDir) {
    const map = {
        [DIRECTIONS.SOUTH]: { 0: 48, 16: 32, 32: 16, 48: 0 },
        [DIRECTIONS.WEST]: { 0: 16, 16: 0, 32: 48, 48: 32 },
        [DIRECTIONS.NORTH]: { 0: 48, 16: 32, 32: 16, 48: 0 },
        [DIRECTIONS.EAST]: { 0: 16, 16: 0, 32: 48, 48: 32 },
    };
    return map[getRotation(piece)]?.[inDir] ?? null;
}

export function isProtectorVulnerable(piece, laserDir) {
    const safe = {
        [DIRECTIONS.NORTH]: 32,
        [DIRECTIONS.SOUTH]: 0,
        [DIRECTIONS.WEST]: 16,
        [DIRECTIONS.EAST]: 48,
    };
    return safe[getRotation(piece)] !== laserDir;
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