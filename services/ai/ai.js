import * as engine from './engine.js';

export function getRandomAction(game) {
    const actions = engine.getAllActions(game);

    if (!actions.length) throw new Error("No actions available");
    return actions[Math.floor(Math.random() * actions.length)];
}


let total = 0
let nb = 0


export function evaluate(game, aiColor) {
    const oppColor = aiColor === engine.COLORS.WHITE ? engine.COLORS.BLACK : engine.COLORS.WHITE;
    const ai = game.getPlayerByColor(aiColor);
    const opp = game.getPlayerByColor(oppColor);

    if (!ai.hasKingAlive()) return -Infinity;
    if (!opp.hasKingAlive()) return Infinity;

    let score = 0;

    // Triangles en inventaire
    let aiInv = 0, oppInv = 0;
    for (const v of ai.inventory) if (v !== 0) aiInv++;
    for (const v of opp.inventory) if (v !== 0) oppInv++;
    score += (aiInv - oppInv) * 30;

    // Valeur des pièces sur le board
    const aiPieces = engine.getPlayerPieces(game.board, aiColor);
    const oppPieces = engine.getPlayerPieces(game.board, oppColor);

    const pieceValue = {
        [engine.PIECE.TRIANGLE]: 10,
        [engine.PIECE.FULL_MIRROR]: 25,
        [engine.PIECE.PROTECTOR]: 20,
        [engine.PIECE.SHOOTER]: 50,
    };

    for (const p of aiPieces) score += pieceValue[engine.getPiece(p.value)] ?? 0;
    for (const p of oppPieces) score -= pieceValue[engine.getPiece(p.value)] ?? 0;

    // Mobilité différentielle
    const aiMoves = engine.getAllActions(game, aiColor).length;
    const oppMoves = engine.getAllActions(game, oppColor).length;
    score += (aiMoves - oppMoves) * 2;

    // Pression sur les rois
    score += kingProximityScore(game.board, aiColor, oppColor);

    return score;
}


function kingProximityScore(board, aiColor, oppColor) {
    let score = 0;
    const aiKing = findKing(board, aiColor);
    const oppKing = findKing(board, oppColor);
    if (!aiKing || !oppKing) return score;

    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const r = oppKing.row + dr, c = oppKing.col + dc;
        if (r >= 0 && r < 10 && c >= 0 && c < 10) {
            const cell = board.getSlot(r, c);
            if (cell && engine.getColor(cell) === aiColor) score += 8;
        }
    }

    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const r = aiKing.row + dr, c = aiKing.col + dc;
        if (r >= 0 && r < 10 && c >= 0 && c < 10) {
            const cell = board.getSlot(r, c);
            if (cell && engine.getColor(cell) === aiColor && engine.getPiece(cell) === engine.PIECE.PROTECTOR)
                score += 15;
        }
    }

    return score;
}

function findKing(board, color) {
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 10; c++) {
            const cell = board.getSlot(r, c);
            if (engine.getPiece(cell) === engine.PIECE.KING && engine.getColor(cell) === color)
                return { row: r, col: c };
        }
    return null;
}

const DEPTH = 2; // Ajuste selon les perfs

export function getBestAction(game) {
    const start = performance.now();

    const actions = engine.getAllActions(game);
    if (!actions.length) throw new Error("No actions available");

    const aiColor = game.colorTurn;
    let bestAction = null;
    let bestScore = -Infinity;

    for (const action of actions) {
        const cloned = game.clone();
        engine.placeAction(cloned, action, aiColor);

        const score = minimax(cloned, DEPTH - 1, -Infinity, Infinity, false, aiColor);

        if (score > bestScore) {
            bestScore = score;
            bestAction = action;
        }
    }

    const elapsed = performance.now() - start;
    console.log(`[AI SERVICE] Score: ${bestScore} | Temps: ${elapsed.toFixed(2)} ms`);

    return bestAction;
}


function minimax(game, depth, alpha, beta, isMaxing, aiColor) {
    const oppColor = aiColor === engine.COLORS.WHITE ? engine.COLORS.BLACK : engine.COLORS.WHITE;

    // --- Cas terminaux ---
    const ai = game.getPlayerByColor(aiColor);
    const opp = game.getPlayerByColor(oppColor);
    if (!ai.hasKingAlive()) return -Infinity;
    if (!opp.hasKingAlive()) return Infinity;
    if (depth === 0) return evaluate(game, aiColor);

    const actions = engine.getAllActions(game);

    // Pas de coups disponibles = partie bloquée, évalue la position
    if (!actions.length) return evaluate(game, aiColor);

    if (isMaxing) {
        let best = -Infinity;

        for (const action of actions) {
            const cloned = game.clone();
            engine.placeAction(cloned, action, aiColor);

            const score = minimax(cloned, depth - 1, alpha, beta, false, aiColor);
            best = Math.max(best, score);
            alpha = Math.max(alpha, best);

            if (alpha >= beta) break; // Coupe beta
        }

        return best;
    } else {
        let best = Infinity;

        for (const action of actions) {
            const cloned = game.clone();
            engine.placeAction(cloned, action, oppColor);

            const score = minimax(cloned, depth - 1, alpha, beta, true, aiColor);
            best = Math.min(best, score);
            beta = Math.min(beta, best);

            if (alpha >= beta) break; // Coupe alpha
        }

        return best;
    }
}