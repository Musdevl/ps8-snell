import { PIECE } from "../enum/Pieces.js";
import * as PieceService from "./PieceService.js";
import * as BoardService from "./BoardService.js";
import * as PlayerService from "./PlayerService.js";
import * as gameService from "./GameService.js";
import { COLORS } from "../enum/Colors.js";
import * as ActionSerializer from "../serializer/ActionSerializer.js";
import { DIRECTION_ORDER, ROTATION_DIRECTION } from "../enum/Directions.js";

// ============================================================
// CONFIGURATION
// ============================================================

const DEFAULT_TIME_BUDGET_MS = 5000;
const MAX_DEPTH = 6;
const TT_MAX_SIZE = 100000;
const MAX_PLACE_ACTIONS = 100000; // limite le branching des PLACE

class TimeoutError extends Error {
    constructor() {
        super("AI_TIMEOUT");
        this.name = "TimeoutError";
    }
}

// ============================================================
// GÉNÉRATION D'ACTIONS (inchangé pour l'essentiel)
// ============================================================

export function get_all_rotations(game) {
    const available_rotates = [];
    const player_pieces = BoardService.get_player_pieces(game.board.grid, game.colorTurn);
    player_pieces.forEach((piece) => {
        if (PieceService.getPiece(piece.value) !== PIECE.KING) {
            generate_rotates(piece).forEach(r => available_rotates.push(r));
        }
    });
    return available_rotates;
}

export function get_all_available_places(game) {
    const available_places = [];
    const player = game.getPlayerByColor(game.colorTurn);

    if (PlayerService.checkPlayerCanPlace(player)) {
        const available_cells = BoardService.get_all_available_cells(game.board.grid, player.color);
        available_cells.forEach((cell) => {
            generate_places(cell).forEach((p) => available_places.push(p));
        });
    }

    return available_places;
}

export function get_all_available_moves(game) {
    const available_moves = [];
    const player_pieces = BoardService.get_player_pieces(game.board.grid, game.colorTurn);

    player_pieces.forEach((piece) => {
        generate_moves(piece, game.board.grid).forEach(m => available_moves.push(m));
    });

    return available_moves;
}

export function get_all_available_swaps(game) {
    const available_swaps = [];
    const player_full_mirror = BoardService.get_player_pieces(game.board.grid, game.colorTurn)
        .find(p => PieceService.getPiece(p.value) === PIECE.FULL_MIRROR);

    if (!player_full_mirror) return available_swaps;

    generate_swaps(player_full_mirror, game.board.grid).forEach(s => available_swaps.push(s));
    return available_swaps;
}

function generate_places(coords) {
    const places = [];
    for (let i = 0; i < 4; i++) {
        places.push(`PLACE/${coords.row}${coords.col},${DIRECTION_ORDER[i]}`);
    }
    return places;
}

function generate_rotates(coords) {
    return [
        `ROTATE/${coords.row}${coords.col},${ROTATION_DIRECTION.CLOCK_WISE}`,
        `ROTATE/${coords.row}${coords.col},${ROTATION_DIRECTION.ANTI_CLOCK_WISE}`,
    ];
}

function generate_moves(piece, grid) {
    const moves = [];

    if (PieceService.getCooldown(piece.value) > 0
        || PieceService.getPiece(piece.value) === PIECE.SHOOTER
        || PieceService.getPiece(piece.value) === PIECE.KING) {
        return moves;
    }

    if (piece.row < 9 && grid[piece.row + 1][piece.col] === 0) {
        moves.push(`MOVE/${piece.row}${piece.col},${piece.row + 1}${piece.col}`);
    }
    if (piece.col < 9 && grid[piece.row][piece.col + 1] === 0) {
        moves.push(`MOVE/${piece.row}${piece.col},${piece.row}${piece.col + 1}`);
    }
    if (piece.row > 0 && grid[piece.row - 1][piece.col] === 0) {
        moves.push(`MOVE/${piece.row}${piece.col},${piece.row - 1}${piece.col}`);
    }
    if (piece.col > 0 && grid[piece.row][piece.col - 1] === 0) {
        moves.push(`MOVE/${piece.row}${piece.col},${piece.row}${piece.col - 1}`);
    }

    return moves;
}

function generate_swaps(full_mirror, grid) {
    const available_swaps = [];
    const near_cells = BoardService.get_swapable_cells(grid, full_mirror.row, full_mirror.col);
    near_cells.forEach(c => {
        available_swaps.push(`SWAP/${full_mirror.row}${full_mirror.col},${c.row}${c.col}`);
    });
    return available_swaps;
}

function getAllActions(game) {
    return [
        ...get_all_available_moves(game),
        ...getSmartPlaces(game),
        ...get_all_available_swaps(game),
        ...get_all_rotations(game),
    ];
}

// ============================================================
// ACTION ALÉATOIRE (fallback)
// ============================================================

export function getRandomAction(game) {
    const actions = getAllActions(game);
    if (actions.length === 0) {
        throw new Error("[AI] No actions available");
    }
    return actions[Math.floor(Math.random() * actions.length)];
}

// ============================================================
// MAKE / UNMAKE
// ============================================================
// On sauvegarde un snapshot minimal avant chaque coup : grille,
// colorTurn, inventaires, laser, etc. À l'unmake on le restaure.
// Pas de clone complet du Game -> mémoire O(depth) au lieu de O(b^d).

function snapshot(game) {
    const white = game.getPlayerByColor(COLORS.WHITE);
    const black = game.getPlayerByColor(COLORS.BLACK);

    return {
        grid: game.board.grid.map(row => new Uint8Array(row)),
        colorTurn: game.colorTurn,
        whiteInventory: white.inventory.slice(),
        blackInventory: black.inventory.slice(),
        whiteKingAlive: white.kingAlive,
        blackKingAlive: black.kingAlive,
        lastAction: game.lastAction,
        laserBeam: game.laserBeam ? [...game.laserBeam] : [],
        killedPiecePos: game.killedPiecePos ? [...game.killedPiecePos] : [],
        turnCount: game.turnCount,
        isGameOver: game.isGameOver,
    };
}

function restore(game, snap) {
    for (let i = 0; i < snap.grid.length; i++) {
        game.board.grid[i] = new Uint8Array(snap.grid[i]);
    }
    game.colorTurn = snap.colorTurn;

    const white = game.getPlayerByColor(COLORS.WHITE);
    const black = game.getPlayerByColor(COLORS.BLACK);
    white.inventory = snap.whiteInventory.slice();
    black.inventory = snap.blackInventory.slice();
    white.kingAlive = snap.whiteKingAlive;
    black.kingAlive = snap.blackKingAlive;

    game.lastAction = snap.lastAction;
    game.laserBeam = [...snap.laserBeam];
    game.killedPiecePos = [...snap.killedPiecePos];
    game.turnCount = snap.turnCount;  // ← "turnCount" et pas "count"
    game.isGameOver = snap.isGameOver;
}

function makeAction(game, action) {
    const snap = snapshot(game);
    const wasReview = game.isReview;
    game.isReview = true;
    try {
        gameService.decrementPiecesCD(game);
        gameService.placeAction(game, action, game.colorTurn);
        return snap;
    } catch (e) {
        restore(game, snap);
        throw e;
    } finally {
        game.isReview = wasReview;
    }
}

function unmakeAction(game, snap) {
    restore(game, snap);
}

// ============================================================
// TABLE DE TRANSPOSITION
// ============================================================

let transpositionTable = new Map();

function hashGame(game) {
    const grid = game.board.grid.map(row => row.join('')).join('|');
    return `${grid}_${game.colorTurn}`;
}

function ttStore(key, entry) {
    if (transpositionTable.size >= TT_MAX_SIZE) {
        transpositionTable.clear();
    }
    transpositionTable.set(key, entry);
}

// ============================================================
// RECHERCHE : ITERATIVE DEEPENING + MINIMAX ALPHA-BETA
// ============================================================

export function getBestAction(game, timeBudgetMs = DEFAULT_TIME_BUDGET_MS) {
    transpositionTable = new Map();
    const aiColor = game.colorTurn;
    const deadline = Date.now() + timeBudgetMs;

    const rootActions = getAllActions(game);
    if (rootActions.length === 0) {
        throw new Error("[AI] No actions available");
    }

    // Fallback : on a au moins un coup aléatoire sous la main
    let bestAction = rootActions[0];
    let bestActionByDepth = bestAction;

    // Iterative deepening
    for (let depth = 1; depth <= MAX_DEPTH; depth++) {
        try {
            const result = searchRoot(game, depth, aiColor, deadline, bestActionByDepth);
            bestActionByDepth = result.action;
            if (result.action !== null) {
                bestAction = result.action;
            }
            // Si on a trouvé une victoire certaine, inutile de chercher plus profond
            if (result.score === Infinity) break;
        } catch (e) {
            if (e instanceof TimeoutError) break;
            throw e;
        }
    }

    return bestAction;
}

function searchRoot(game, depth, aiColor, deadline, previousBest) {
    let bestAction = null;
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    let actions = orderActions(game, getAllActions(game), depth);

    if (previousBest) {
        actions = [previousBest, ...actions.filter(a => a !== previousBest)];
    }

    for (const action of actions) {
        checkDeadline(deadline);

        const snap = makeAction(game, action);
        let score;
        try {
            score = minimax(game, depth - 1, alpha, beta, aiColor, deadline);
        } finally {
            unmakeAction(game, snap);
        }

        if (score > bestScore) {
            bestScore = score;
            bestAction = action;
        }
        alpha = Math.max(alpha, score);
    }

    return { action: bestAction, score: bestScore };
}

function minimax(game, depth, alpha, beta, aiColor, deadline) {
    checkDeadline(deadline);

    // isMaximizing dérivé du colorTurn, pas d'un paramètre fixe
    const isMaximizing = game.colorTurn === aiColor;

    const aiPlayer = game.getPlayerByColor(aiColor);
    const opponentColor = aiColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    const opponentPlayer = game.getPlayerByColor(opponentColor);

    if (!aiPlayer.hasKingAlive() || !opponentPlayer.hasKingAlive()) {
        return evaluate(game, aiColor);
    }

    const key = hashGame(game);
    const cached = transpositionTable.get(key);
    if (cached && cached.depth >= depth) return cached.score;

    if (depth === 0) {
        const score = evaluate(game, aiColor);
        ttStore(key, { score, depth });
        return score;
    }

    const actions = orderActions(game, getAllActions(game), depth);

    let score;
    if (isMaximizing) {
        let maxScore = -Infinity;
        for (const action of actions) {
            let snap;
            try {
                snap = makeAction(game, action);
            } catch (_) { continue; }
            const s = minimax(game, depth - 1, alpha, beta, aiColor, deadline);
            unmakeAction(game, snap);
            maxScore = Math.max(maxScore, s);
            alpha = Math.max(alpha, s);
            if (beta <= alpha) break;
        }
        score = maxScore;
    } else {
        let minScore = Infinity;
        for (const action of actions) {
            let snap;
            try {
                snap = makeAction(game, action);
            } catch (_) { continue; }
            const s = minimax(game, depth - 1, alpha, beta, aiColor, deadline);
            unmakeAction(game, snap);
            minScore = Math.min(minScore, s);
            beta = Math.min(beta, s);
            if (beta <= alpha) break;
        }
        score = minScore;
    }

    ttStore(key, { score, depth });
    return score;
}

function checkDeadline(deadline) {
    if (Date.now() > deadline) throw new TimeoutError();
}

// ============================================================
// ÉVALUATION
// ============================================================

function evaluate(game, aiColor) {
    const opponentColor = aiColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    const aiPlayer = game.getPlayerByColor(aiColor);
    const opponentPlayer = game.getPlayerByColor(opponentColor);

    if (!aiPlayer.hasKingAlive()) return -Infinity;
    if (!opponentPlayer.hasKingAlive()) return Infinity;

    let score = 0;

    // Pièces sur le board
    const aiPieces = BoardService.get_player_pieces(game.board.grid, aiColor);
    const opPieces = BoardService.get_player_pieces(game.board.grid, opponentColor);
    score += aiPieces.length * 10;
    score -= opPieces.length * 10;

    // Triangles capturés
    score += aiPlayer.inventory.filter(v => v !== 0).length * 50;
    score -= opponentPlayer.inventory.filter(v => v !== 0).length * 50;

    // Bonus : pièces adverses sur le chemin du laser actuel
    const laserPath = game.laserBeam || [];
    for (const cell of laserPath) {
        const piece = game.board.grid[cell.row]?.[cell.col];
        if (!piece) continue;
        if (PieceService.getColor(piece) === opponentColor) score += 30; // laser menace l'adversaire
        if (PieceService.getColor(piece) === aiColor) score -= 30;       // laser nous menace
    }

    // Pièces adverses en cooldown = vulnérables
    for (const p of opPieces) {
        if (PieceService.getCooldown(p.value) > 0) score += 20;
    }
    for (const p of aiPieces) {
        if (PieceService.getCooldown(p.value) > 0) score -= 20;
    }

    return score;
}

// ============================================================
// ORDONNANCEMENT DES ACTIONS
// ============================================================

function scoreAction(game, action) {
    const type = action.split("/")[0];
    const base = { ROTATE: 10, SWAP: 8, MOVE: 5, PLACE: 3 };
    let score = base[type] ?? 0;

    const playingColor = game.colorTurn; // ← capturer AVANT makeAction

    let snap;
    try {
        snap = makeAction(game, action);
        score += evaluate(game, playingColor); // ← évalue depuis le joueur qui vient de jouer
        unmakeAction(game, snap);
    } catch (e) {
        if (snap) unmakeAction(game, snap);
    }

    return score;
}

function orderActions(game, actions, depth) {
    const places = [];
    const others = [];
    for (const a of actions) {
        if (a.startsWith("PLACE/")) places.push(a);
        else others.push(a);
    }
    const limitedPlaces = places.slice(0, MAX_PLACE_ACTIONS);
    const limited = [...others, ...limitedPlaces];

    if (depth <= 1) return limited;

    return limited
        .map(action => ({ action, score: scoreAction(game, action) }))  // ← ici
        .sort((a, b) => b.score - a.score)
        .map(entry => entry.action);
}

function getSmartPlaces(game) {
    const allPlaces = get_all_available_places(game);
    const myPieces = BoardService.get_player_pieces(game.board.grid, game.colorTurn);
    const opponentColor = game.colorTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    const opPieces = BoardService.get_player_pieces(game.board.grid, opponentColor);

    // Si pas de pièces de référence, retourner toutes les places
    if (myPieces.length + opPieces.length === 0) return allPlaces.slice(0, 30);

    const allRefs = [...myPieces, ...opPieces];

    return allPlaces.filter(place => {
        const parsed = ActionSerializer.stringToPlace(place);
        return allRefs.some(p =>
            Math.abs(p.row - parsed.row) <= 4 &&
            Math.abs(p.col - parsed.col) <= 4
        );
    }).slice(0, 30);
}