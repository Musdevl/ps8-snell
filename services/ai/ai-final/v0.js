const COLORS = { WHITE: 0, BLACK: 8 };
const PIECE = { NONE: 0, TRIANGLE: 1, FULL_MIRROR: 2, SHOOTER: 3, PROTECTOR: 4, KING: 5 };
const DIRECTIONS = { NORTH: 0, EAST: 16, SOUTH: 32, WEST: 48 };
const OPPOSITE_DIRECTIONS = { 0: 32, 16: 48, 32: 0, 48: 16 };
const DIRECTION_ORDER = [DIRECTIONS.NORTH, DIRECTIONS.EAST, DIRECTIONS.SOUTH, DIRECTIONS.WEST];
const ROTATION_DIRECTION = { CLOCK_WISE: 16, ANTI_CLOCK_WISE: 48 };
const PLAYER_ACTION = { MOVE: "MOVE", ROTATE: "ROTATE", SWAP: "SWAP", PLACE: "PLACE" };
const MASK = {
    PIECE:     0b00000111,
    COLOR:     0b00001000,
    DIRECTION: 0b00110000,
    COOLDOWN:  0b11000000
};


const getPiece    = p => p & MASK.PIECE;
const getColor    = p => p & MASK.COLOR;
const getRotation = p => p & MASK.DIRECTION;
const getCooldown = p => (p & MASK.COOLDOWN) >> 6;

const setDirection = (p, d)  => (p & ~MASK.DIRECTION) | d;
const setCooldown  = (p, cd) => (p & ~MASK.COOLDOWN) | ((cd << 6) & MASK.COOLDOWN);
const decrementCD  = p => { const cd = getCooldown(p); return cd > 0 ? setCooldown(p, cd - 1) : p; };

function createPiece(piece, color, direction, cooldown = 0) {
    return piece | color | direction | (cooldown << 6);
}

function rotateLeft(p) {
    const idx = DIRECTION_ORDER.indexOf(p & 0b110000);
    return (p & 0b11001111) | DIRECTION_ORDER[(idx + 3) % 4];
}

function rotateRight(p) {
    const idx = DIRECTION_ORDER.indexOf(p & 0b110000);
    return (p & 0b11001111) | DIRECTION_ORDER[(idx + 1) % 4];
}


class Board {
    constructor() {
        this.grid = Array.from({ length: 10 }, () => new Uint8Array(10));
    }
    getGrid()        { return this.grid; }
    getSlot(r, c)    { return this.grid[r][c]; }
    setSlot(r, c, v) { this.grid[r][c] = v; }
    killSlot(r, c)   { this.grid[r][c] = 0; }
    clone() {
        const b = new Board();
        b.grid = this.grid.map(row => new Uint8Array(row));
        return b;
    }
}


class Player {
    constructor(color) {
        this.color     = color;
        this.kingAlive = true;
        this.inventory = new Uint8Array(14);
        for (let i = 0; i < 7; i++)
            this.inventory[i] = createPiece(PIECE.TRIANGLE, color, DIRECTIONS.NORTH, 0);
    }
    hasKingAlive() { return this.kingAlive; }
    killKing()     { this.kingAlive = false; }
    getColor()     { return this.color; }
    getInventory() { return this.inventory; }
    clone() {
        const c = new Player(this.color);
        c.kingAlive = this.kingAlive;
        c.inventory = new Uint8Array(this.inventory);
        return c;
    }
}


function checkPlayerCanPlace(player) {
    return !player.inventory.every(v => v === 0) &&
        !player.inventory.every(v => getCooldown(v) > 0);
}

function takeLastAvailablePiece(inventory) {
    for (let i = inventory.length - 1; i >= 0; i--) {
        if (inventory[i] !== 0 && getCooldown(inventory[i]) === 0) {
            const piece = inventory[i];
            inventory[i] = 0;
            for (; i < inventory.length - 1; i++) { inventory[i] = inventory[i+1]; inventory[i+1] = 0; }
            return piece;
        }
    }
    throw new Error("No pieces available");
}

function decrementInventoryCD(player) {
    for (let i = 0; i < player.inventory.length; i++)
        player.inventory[i] = decrementCD(player.inventory[i]);
}

function addTriangleToInventory(player, count) {
    for (let i = 0; i < count; i++) {
        const t = createPiece(PIECE.TRIANGLE, player.color, DIRECTIONS.NORTH, 1);
        for (let j = 0; j < player.inventory.length; j++) {
            if (player.inventory[j] === 0) { player.inventory[j] = t; break; }
        }
    }
}



class Game {
    constructor(board) {
        this.board      = board;
        this.colorTurn  = COLORS.WHITE;
        this.count      = 0;
        this.laserBeam  = [];
        this.isGameOver = false;
        this.players    = [new Player(COLORS.WHITE), new Player(COLORS.BLACK)];
    }
    getPlayerByColor(color) { return this.players.find(p => p.color === color); }
    incrementCount() {
        this.count++;
        this.colorTurn = this.colorTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    }
    clone() {
        const g = new Game(this.board.clone());
        g.colorTurn  = this.colorTurn;
        g.count      = this.count;
        g.laserBeam  = [...this.laserBeam];
        g.isGameOver = this.isGameOver;
        g.players    = this.players.map(p => p.clone());
        return g;
    }
}


function move(board, action, colorTurn) {
    const { oldRow, oldCol, newRow, newCol } = stringToMove(action);
    const piece = board.getSlot(oldRow, oldCol);
    if (getColor(piece) !== colorTurn)                                       throw new Error("Wrong color");
    if (getPiece(piece) === PIECE.SHOOTER || getPiece(piece) === PIECE.KING) throw new Error("Can't move this piece");
    if (board.getSlot(newRow, newCol) !== 0)                                 throw new Error("Target cell not empty");
    board.setSlot(newRow, newCol, piece);
    board.setSlot(oldRow, oldCol, 0);
}

function place(player, board, action, color) {
    if (!checkPlayerCanPlace(player)) throw new Error("Can't place");
    const { row, col, direction } = stringToPlace(action);
    if (board.getSlot(row, col) !== 0 || isNearToYourKing(board.grid, row, col, color) || isNearToAShooter(board.grid, row, col))
        throw new Error("Can't place here");
    let triangle = takeLastAvailablePiece(player.getInventory());
    triangle = setDirection(triangle, direction);
    board.setSlot(row, col, triangle);
}

function swap(board, action, color) {
    const { firstPieceRow: r1, firstPieceCol: c1, secondPieceRow: r2, secondPieceCol: c2 } = stringToSwap(action);
    const p1 = board.getSlot(r1, c1), p2 = board.getSlot(r2, c2);
    if (!p1 || !p2)                                        throw new Error("Empty slot");
    if (getCooldown(p1) > 0 || getCooldown(p2) > 0)       throw new Error("Cooldown active");
    if (getColor(p1) !== color && getColor(p2) !== color)  throw new Error("Wrong color");
    if (getColor(p1) !== getColor(p2))                     throw new Error("Must be same color");
    if (getPiece(p1) !== PIECE.FULL_MIRROR)                throw new Error("First piece must be full mirror");
    board.setSlot(r1, c1, setCooldown(p2, 2));
    board.setSlot(r2, c2, p1);
    return { allowed_to_shoot: getPiece(p1) !== PIECE.SHOOTER && getPiece(p2) !== PIECE.SHOOTER };
}

function rotate(board, action) {
    const { row, col, direction } = stringToRotate(action);
    let piece = board.getSlot(row, col);
    if (!piece)                         throw new Error("Empty cell");
    if (getPiece(piece) === PIECE.KING) throw new Error("Can't rotate King");
    piece = direction === ROTATION_DIRECTION.CLOCK_WISE ? rotateLeft(piece) : rotateRight(piece);
    board.setSlot(row, col, piece);
}



function shootBeam(board, colorTurn, players = []) {
    const [shooter, pos] = findShooter(board, colorTurn);
    let dir = shooter & MASK.DIRECTION;
    let cur = [...pos];
    const laserPath = [];
    const delta = { 0: [-1,0], 32: [1,0], 48: [0,-1], 16: [0,1] };
    let white_triangle_shooted = 0, black_triange_shooted = 0;

    while (true) {
        cur[0] += delta[dir][0]; cur[1] += delta[dir][1];
        const [r, c] = cur;
        if (r < 0 || r >= 10 || c < 0 || c >= 10 || hasCycle(laserPath)) break;
        laserPath.push([r, c]);
        const cell = board.getSlot(r, c);

        if      (getPiece(cell) === PIECE.NONE)        { /* empty */ }
        else if (getPiece(cell) === PIECE.TRIANGLE) {
            if (isTriangleVulnerable(cell, dir)) {
                if (getColor(cell) === COLORS.WHITE) white_triangle_shooted++;
                else                                 black_triange_shooted++;
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

function hasCycle(path) {
    const seen = {};
    for (const c of path) { seen[c] = (seen[c]||0)+1; if (seen[c] > 2) return true; }
    return false;
}

function findShooter(board, color) {
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 10; c++) {
            const cell = board.getSlot(r, c);
            if (getPiece(cell) === PIECE.SHOOTER && getColor(cell) === color) return [cell, [r, c]];
        }
    throw new Error("Shooter not found");
}

function isTriangleVulnerable(piece, laserDir) {
    const d = getRotation(piece);
    const vuln = {
        [DIRECTIONS.SOUTH]: [48, 32],
        [DIRECTIONS.WEST]:  [0,  48],
        [DIRECTIONS.NORTH]: [0,  16],
        [DIRECTIONS.EAST]:  [16, 32],
    };
    return (vuln[d] || []).includes(laserDir);
}

function getTriangleBounceDirection(piece, inDir) {
    const map = {
        [DIRECTIONS.SOUTH]: { 0: 48, 16: 32 },
        [DIRECTIONS.WEST]:  { 32: 48, 16: 0 },
        [DIRECTIONS.NORTH]: { 32: 16, 48: 0 },
        [DIRECTIONS.EAST]:  { 0: 16, 48: 32 },
    };
    return map[getRotation(piece)]?.[inDir] ?? null;
}

function getFullMirrorBounceDirection(piece, inDir) {
    const map = {
        [DIRECTIONS.SOUTH]: { 0: 48, 16: 32, 32: 16, 48: 0 },
        [DIRECTIONS.WEST]:  { 0: 16, 16: 0,  32: 48, 48: 32 },
        [DIRECTIONS.NORTH]: { 0: 48, 16: 32, 32: 16, 48: 0 },
        [DIRECTIONS.EAST]:  { 0: 16, 16: 0,  32: 48, 48: 32 },
    };
    return map[getRotation(piece)]?.[inDir] ?? null;
}

function isProtectorVulnerable(piece, laserDir) {
    const safe = {
        [DIRECTIONS.NORTH]: 32,
        [DIRECTIONS.SOUTH]: 0,
        [DIRECTIONS.WEST]:  16,
        [DIRECTIONS.EAST]:  48,
    };
    return safe[getRotation(piece)] !== laserDir;
}


function isNearToYourKing(grid, row, col, color) {
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const r = row+dr, c = col+dc;
        if (r >= 0 && r < 10 && c >= 0 && c < 10) {
            const cell = grid[r][c];
            if (getPiece(cell) === PIECE.KING && getColor(cell) === color) return true;
        }
    }
    return false;
}

function isNearToAShooter(grid, row, col) {
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const r = row+dr, c = col+dc;
        if (r >= 0 && r < 10 && c >= 0 && c < 10 && getPiece(grid[r][c]) === PIECE.SHOOTER) return true;
    }
    return false;
}


function placeAction(game, action, colorTurn) {
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

function decrementPiecesCD(game) {
    decrementInventoryCD(game.getPlayerByColor(game.colorTurn));
    decrementBoardPieces(game.board, game.colorTurn);
}

function decrementBoardPieces(board, colorTurn) {
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 10; c++) {
            const p = board.grid[r][c];
            if (getColor(p) === colorTurn) board.setSlot(r, c, decrementCD(p));
        }
}

function addTrianglesToInventories(game, wt, bt) {
    addTriangleToInventory(game.getPlayerByColor(COLORS.WHITE), bt);
    addTriangleToInventory(game.getPlayerByColor(COLORS.BLACK), wt);
}


function checkGameStatus(game) {
    const w = game.getPlayerByColor(COLORS.WHITE);
    const b = game.getPlayerByColor(COLORS.BLACK);
    if ((!w.hasKingAlive() && !b.hasKingAlive()) || game.count >= 200) return "DRAW";
    if (!w.hasKingAlive()) return "BLACK";
    if (!b.hasKingAlive()) return "WHITE";
    if (game.isGameOver)   return game.colorTurn === COLORS.WHITE ? "BLACK" : "WHITE";
    return "CONTINUE";
}


function getPlayerPieces(grid, color) {
    const res = [];
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 10; c++)
            if (grid[r][c] && getColor(grid[r][c]) === color) res.push({ value: grid[r][c], row: r, col: c });
    return res;
}

function getAllAvailableCells(grid, color) {
    const res = [];
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 10; c++)
            if (grid[r][c] === 0 && !isNearToAShooter(grid, r, c) && !isNearToYourKing(grid, r, c, color))
                res.push({ row: r, col: c });
    return res;
}

function generateMoves(piece, grid) {
    if (getCooldown(piece.value) > 0 || getPiece(piece.value) === PIECE.SHOOTER || getPiece(piece.value) === PIECE.KING) return [];
    const moves = [];
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const r = piece.row+dr, c = piece.col+dc;
        if (r >= 0 && r < 10 && c >= 0 && c < 10 && grid[r][c] === 0)
            moves.push(`MOVE/${piece.row}${piece.col},${r}${c}`);
    }
    return moves;
}

function generateRotates(coords) {
    return [
        `ROTATE/${coords.row}${coords.col},${ROTATION_DIRECTION.CLOCK_WISE}`,
        `ROTATE/${coords.row}${coords.col},${ROTATION_DIRECTION.ANTI_CLOCK_WISE}`,
    ];
}

function generatePlaces(coords) {
    return DIRECTION_ORDER.map(d => `PLACE/${coords.row}${coords.col},${d}`);
}

function generateSwaps(mirror, grid) {
    return getSwappableCells(grid, mirror.row, mirror.col)
        .map(c => `SWAP/${mirror.row}${mirror.col},${c.row}${c.col}`);
}

function getSwappableCells(grid, row, col) {
    const color = getColor(grid[row][col]);
    const res = [];
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 10; c++) {
            const p = grid[r][c];
            if (p && getColor(p) === color && getCooldown(p) === 0 &&
                (getPiece(p) === PIECE.KING || getPiece(p) === PIECE.SHOOTER))
                res.push({ row: r, col: c });
        }
    return res;
}

function getAllMoves(game) {
    return getPlayerPieces(game.board.grid, game.colorTurn).flatMap(p => generateMoves(p, game.board.grid));
}

function getAllPlaces(game) {
    const player = game.getPlayerByColor(game.colorTurn);
    if (!checkPlayerCanPlace(player)) return [];
    return getAllAvailableCells(game.board.grid, player.color).flatMap(c => generatePlaces(c));
}

function getAllRotations(game) {
    return getPlayerPieces(game.board.grid, game.colorTurn)
        .filter(p => getPiece(p.value) !== PIECE.KING)
        .flatMap(p => generateRotates(p));
}

function getAllSwaps(game) {
    const mirror = getPlayerPieces(game.board.grid, game.colorTurn).find(p => getPiece(p.value) === PIECE.FULL_MIRROR);
    if (!mirror) return [];
    return generateSwaps(mirror, game.board.grid);
}

function getAllActions(game) {
    return [...getAllMoves(game), ...getAllPlaces(game), ...getAllSwaps(game), ...getAllRotations(game)];
}


function stringToMove(s) {
    const [, payload] = s.split("/");
    const [a, b] = payload.split(",");
    return { oldRow: +a[0], oldCol: +a[1], newRow: +b[0], newCol: +b[1] };
}

function stringToPlace(s) {
    const [, payload] = s.split("/");
    const [coords, dir] = payload.split(",");
    return { row: +coords[0], col: +coords[1], direction: +dir };
}

function stringToSwap(s) {
    const [, payload] = s.split("/");
    const [a, b] = payload.split(",");
    return { firstPieceRow: +a[0], firstPieceCol: +a[1], secondPieceRow: +b[0], secondPieceCol: +b[1] };
}

function stringToRotate(s) {
    const [, payload] = s.split("/");
    const [coords, dir] = payload.split(",");
    return { row: +coords[0], col: +coords[1], direction: +dir };
}

function findKing(grid, color) {
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 10; c++) {
            const cell = grid[r][c];
            if (getPiece(cell) === PIECE.KING && getColor(cell) === color)
                return { row: r, col: c };
        }
    return null;
}

function kingProximityScore(grid, aiColor, oppColor) {
    let score = 0;
    const aiKing  = findKing(grid, aiColor);
    const oppKing = findKing(grid, oppColor);
    if (!aiKing || !oppKing) return score;

    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
        const r = oppKing.row+dr, c = oppKing.col+dc;
        if (r >= 0 && r < 10 && c >= 0 && c < 10) {
            const cell = grid[r][c];
            if (cell && getColor(cell) === aiColor) score += 8;
        }
    }

    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const r = aiKing.row+dr, c = aiKing.col+dc;
        if (r >= 0 && r < 10 && c >= 0 && c < 10) {
            const cell = grid[r][c];
            if (cell && getColor(cell) === aiColor && getPiece(cell) === PIECE.PROTECTOR)
                score += 15;
        }
    }

    return score;
}

function evaluate(game, aiColor) {
    const oppColor = aiColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    const ai  = game.getPlayerByColor(aiColor);
    const opp = game.getPlayerByColor(oppColor);

    if (!ai.hasKingAlive())  return -Infinity;
    if (!opp.hasKingAlive()) return  Infinity;

    let score = 0;

    score += ai.inventory.filter(v => v !== 0).length  * 30;
    score -= opp.inventory.filter(v => v !== 0).length * 30;

    const aiPieces  = getPlayerPieces(game.board.grid, aiColor);
    const oppPieces = getPlayerPieces(game.board.grid, oppColor);

    const pieceValue = {
        [PIECE.TRIANGLE]:    10,
        [PIECE.FULL_MIRROR]: 25,
        [PIECE.PROTECTOR]:   20,
        [PIECE.SHOOTER]:     50,
        [PIECE.KING]:        200,
    };

    for (const p of aiPieces)  score += pieceValue[getPiece(p.value)] ?? 0;
    for (const p of oppPieces) score -= pieceValue[getPiece(p.value)] ?? 0;

    const aiMoves = getAllActions(game).length;
    const oppGame = game.clone();
    oppGame.colorTurn = oppColor;
    const oppMoves = getAllActions(oppGame).length;
    score += (aiMoves - oppMoves) * 2;

    for (const p of aiPieces)  if (getCooldown(p.value) > 0) score -= 5 * getCooldown(p.value);
    for (const p of oppPieces) if (getCooldown(p.value) > 0) score += 5 * getCooldown(p.value);

    score += kingProximityScore(game.board.grid, aiColor, oppColor);

    return score;
}

let transpositionTable = new Map();

function hashGame(game) {
    return game.board.grid.map(r => r.join('')).join('|') + '_' + game.colorTurn;
}

function applyActionInternal(simGame, action) {
    decrementPiecesCD(simGame);
    placeAction(simGame, action, simGame.colorTurn);
}

function scoreAction(game, action, aiColor) {
    const bonus = { MOVE: 0, ROTATE: 5, SWAP: 10, PLACE: 15 }[action.split("/")[0]] ?? 0;
    const sim = game.clone();
    applyActionInternal(sim, action);
    return evaluate(sim, aiColor) + bonus;
}

function orderActions(game, actions, aiColor, depth = Infinity) {
    if (depth <= 1) return actions;
    return actions
        .map(a => ({ a, s: scoreAction(game, a, aiColor) }))
        .sort((x, y) => y.s - x.s)
        .map(e => e.a);
}

function minimax(game, depth, alpha, beta, isMax, aiColor, deadline) {
    if (performance.now() > deadline) throw new Error('TIMEOUT');

    const ai  = game.getPlayerByColor(aiColor);
    const opp = game.getPlayerByColor(aiColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE);

    if (!ai.hasKingAlive() || !opp.hasKingAlive()) return evaluate(game, aiColor);

    const key = hashGame(game);
    const cached = transpositionTable.get(key);
    if (cached && cached.depth >= depth) return cached.score;

    if (depth === 0) {
        const score = evaluate(game, aiColor);
        transpositionTable.set(key, { score, depth });
        return score;
    }

    const actions = orderActions(game, getAllActions(game), aiColor, depth);
    let score;

    if (isMax) {
        let best = -Infinity;
        for (const action of actions) {
            const sim = game.clone();
            applyActionInternal(sim, action);
            const s = minimax(sim, depth-1, alpha, beta, false, aiColor, deadline);
            best = Math.max(best, s);
            alpha = Math.max(alpha, s);
            if (beta <= alpha) break;
        }
        score = best;
    } else {
        let best = Infinity;
        for (const action of [...actions].reverse()) {
            const sim = game.clone();
            applyActionInternal(sim, action);
            const s = minimax(sim, depth-1, alpha, beta, true, aiColor, deadline);
            best = Math.min(best, s);
            beta = Math.min(beta, s);
            if (beta <= alpha) break;
        }
        score = best;
    }

    transpositionTable.set(key, { score, depth });
    return score;
}

let currentBestMove = null;

function getBestActionWithDeadline(game, deadline) {
    transpositionTable = new Map();
    const aiColor = game.colorTurn;
    const actions = orderActions(game, getAllActions(game), aiColor);

    if (actions.length === 0) return null;

    currentBestMove = actions[0];

    for (let depth = 1; depth <= 10; depth++) {
        try {
            let bestAction = null;
            let bestScore  = -Infinity;

            for (const action of actions) {
                if (performance.now() > deadline) throw new Error('TIMEOUT');

                const sim = game.clone();
                applyActionInternal(sim, action);
                const score = minimax(sim, depth-1, -Infinity, Infinity, false, aiColor, deadline);

                if (score > bestScore) {
                    bestScore  = score;
                    bestAction = action;
                }
            }

            currentBestMove = bestAction;
        } catch (e) {
            if (e.message === 'TIMEOUT') {
                console.log(`[AI SERVICE] Timeout at depth ${depth}, using best from depth ${depth-1}`);
                break;
            }
            throw e;
        }
    }

    return currentBestMove;
}


function cellToRowCol(cell) {
    return { row: Math.floor(cell / 10), col: cell % 10 };
}

function rowColToCell(row, col) {
    return row * 10 + col;
}

function orientationToDirection(orientation) {
    const map = { 0: DIRECTIONS.NORTH, 9: DIRECTIONS.EAST, 90: DIRECTIONS.SOUTH, 99: DIRECTIONS.WEST };
    return map[orientation] ?? DIRECTIONS.NORTH;
}

function directionToOrientation(direction) {
    const map = {
        [DIRECTIONS.NORTH]: 0,
        [DIRECTIONS.EAST]:  9,
        [DIRECTIONS.SOUTH]: 90,
        [DIRECTIONS.WEST]:  99
    };
    return map[direction] ?? 0;
}

function externalToEngine(action) {
    const { row: r, col: c } = cellToRowCol(action.cell);

    switch (action.action) {
        case 'ROTATE': {
            const dir = action.result === 'CLOCKWISE'
                ? ROTATION_DIRECTION.CLOCK_WISE
                : ROTATION_DIRECTION.ANTI_CLOCK_WISE;
            return `ROTATE/${r}${c},${dir}`;
        }
        case 'MOVE': {
            const { row: tr, col: tc } = cellToRowCol(action.result);
            return `MOVE/${r}${c},${tr}${tc}`;
        }
        case 'PLACE': {
            const { destination, orientation } = action.result;
            const { row: dr, col: dc } = cellToRowCol(destination);
            const dir = orientationToDirection(orientation);
            return `PLACE/${dr}${dc},${dir}`;
        }
        case 'EXCHANGE': {
            const { row: tr, col: tc } = cellToRowCol(action.result);
            return `SWAP/${r}${c},${tr}${tc}`;
        }
    }
}


function engineToExternal(engineAction) {
    const [type, coords] = engineAction.split('/');

    switch (type) {
        case 'ROTATE': {
            const [posStr, dirStr] = coords.split(',');
            return {
                action: 'ROTATE',
                cell:   rowColToCell(+posStr[0], +posStr[1]),
                result: +dirStr === ROTATION_DIRECTION.CLOCK_WISE ? 'CLOCKWISE' : 'ANTICLOCKWISE'
            };
        }
        case 'MOVE': {
            const [fromStr, toStr] = coords.split(',');
            return {
                action: 'MOVE',
                cell:   rowColToCell(+fromStr[0], +fromStr[1]),
                result: rowColToCell(+toStr[0], +toStr[1])
            };
        }
        case 'PLACE': {
            const [posStr, dirStr] = coords.split(',');
            return {
                action: 'PLACE',
                cell:   -1,
                result: {
                    destination: rowColToCell(+posStr[0], +posStr[1]),
                    orientation: directionToOrientation(+dirStr)
                }
            };
        }
        case 'SWAP': {
            const [fromStr, toStr] = coords.split(',');
            return {
                action: 'EXCHANGE',
                cell:   rowColToCell(+fromStr[0], +fromStr[1]),
                result: rowColToCell(+toStr[0], +toStr[1])
            };
        }
    }
}


function buildInitialGame(initialPositions, isFirstPlayer) {
    const board    = new Board();
    const myColor  = isFirstPlayer ? COLORS.WHITE : COLORS.BLACK;
    const oppColor = isFirstPlayer ? COLORS.BLACK : COLORS.WHITE;

    const { row: sr, col: sc } = cellToRowCol(initialPositions.sphinx);
    const sphinxDir = sc < 5 ? DIRECTIONS.EAST : DIRECTIONS.WEST;
    board.setSlot(sr, sc, createPiece(PIECE.SHOOTER, myColor, sphinxDir));

    const { row: pr, col: pc } = cellToRowCol(initialPositions.pharaoh);
    board.setSlot(pr, pc, createPiece(PIECE.KING, myColor, DIRECTIONS.NORTH));

    const { position: scarabPos, orientation: scarabOri } = initialPositions.scarab;
    const { row: scr, col: scc } = cellToRowCol(scarabPos);
    board.setSlot(scr, scc, createPiece(PIECE.FULL_MIRROR, myColor, orientationToDirection(scarabOri)));

    const myAnubisDir = isFirstPlayer ? DIRECTIONS.NORTH : DIRECTIONS.SOUTH;
    board.setSlot(4, pc, createPiece(PIECE.PROTECTOR, myColor, myAnubisDir));

    const oppSphinxCol = 9 - sc;
    board.setSlot(2, oppSphinxCol, createPiece(PIECE.PROTECTOR, myColor, myAnubisDir));

    const mirror = (r, c) => [9 - r, 9 - c];
    const oppAnubisDir = isFirstPlayer ? DIRECTIONS.SOUTH : DIRECTIONS.NORTH;
    const oppSphinxDir = sc < 5 ? DIRECTIONS.WEST : DIRECTIONS.EAST;

    board.setSlot(...mirror(sr, sc),  createPiece(PIECE.SHOOTER,    oppColor, oppSphinxDir));
    board.setSlot(...mirror(pr, pc),  createPiece(PIECE.KING,       oppColor, DIRECTIONS.SOUTH));
    board.setSlot(...mirror(scr, scc),createPiece(PIECE.FULL_MIRROR,oppColor, orientationToDirection(scarabOri === 0 ? 90 : 0)));
    board.setSlot(...mirror(4, pc),   createPiece(PIECE.PROTECTOR,  oppColor, oppAnubisDir));
    board.setSlot(...mirror(2, oppSphinxCol), createPiece(PIECE.PROTECTOR, oppColor, oppAnubisDir));

    const game = new Game(board);
    game.colorTurn = myColor;
    return game;
}


let game;
let myColor;

export async function setup(initialPositions, isFirstPlayer) {
    myColor      = isFirstPlayer ? COLORS.WHITE : COLORS.BLACK;
    game         = buildInitialGame(initialPositions, isFirstPlayer);
    currentBestMove = null;
    return true;
}

export async function nextMove(opponentAction) {
    if (opponentAction) {
        const engineAction = externalToEngine(opponentAction);
        decrementPiecesCD(game);
        placeAction(game, engineAction, game.colorTurn);
    }

    const deadline = performance.now() + 200;
    const best = getBestActionWithDeadline(game, deadline);

    decrementPiecesCD(game);
    placeAction(game, best, game.colorTurn);

    return engineToExternal(best);
}