import * as engine from './engine.js';

// ─── ACTION ALÉATOIRE ────────────────────────────────────────────────────────

export function getRandomAction(game) {
    const actions = engine.getAllActions(game);
    if (!actions.length) throw new Error("No actions available");
    return actions[Math.floor(Math.random() * actions.length)];
}

// ─── FONCTION D'ÉVALUATION ───────────────────────────────────────────────────

const PIECE_VALUE = {
    [engine.PIECE.TRIANGLE]: 10,
    [engine.PIECE.FULL_MIRROR]: 25,
    [engine.PIECE.PROTECTOR]: 20,
    [engine.PIECE.SHOOTER]: 50,
};

const CAPTURED_TRIANGLE_BONUS = 30; // triangle adverse détruit -> ajouté à notre inventaire
const MOBILITY_WEIGHT = 2;          // valeur d'un coup jouable de différence
const COOLDOWN_PENALTY = 5;         // par tour de cooldown restant, une pièce est inerte
const KING_PROXIMITY_BONUS = 8;     // une de nos pièces autour du roi adverse
const PROTECTOR_SHIELD_BONUS = 15;  // un protecteur qui garde notre roi
const KING_THREAT_BONUS = 300;      // le laser (tel qu'il est orienté MAINTENANT) atteint un roi
const PIECE_THREAT_RATIO = 0.5;     // le laser menace une pièce adverse (pas le roi)

const NEIGHBORS_4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const NEIGHBORS_8 = [...NEIGHBORS_4, [-1, -1], [-1, 1], [1, -1], [1, 1]];
const BEAM_DELTA = {
    [engine.DIRECTIONS.NORTH]: [-1, 0],
    [engine.DIRECTIONS.SOUTH]: [1, 0],
    [engine.DIRECTIONS.WEST]: [0, -1],
    [engine.DIRECTIONS.EAST]: [0, 1],
};

export function evaluate(game, aiColor) {
    const oppColor = opponentColor(aiColor);
    const ai = game.getPlayerByColor(aiColor);
    const opp = game.getPlayerByColor(oppColor);

    if (!ai.hasKingAlive()) return -Infinity;
    if (!opp.hasKingAlive()) return Infinity;

    // Un seul passage sur le plateau pour récupérer pièces/roi/tireur des
    // deux camps : evaluate() est appelée des dizaines de milliers de fois
    // par recherche, ça évite de reparcourir le plateau à chaque sous-score.
    const scan = scanBoard(game.board);
    const aiScan = scan[aiColor];
    const oppScan = scan[oppColor];

    let score = 0;
    score += (countCaptured(ai) - countCaptured(opp)) * CAPTURED_TRIANGLE_BONUS;
    score += materialScore(aiScan.pieces) - materialScore(oppScan.pieces);
    score += (countActions(game, aiColor) - countActions(game, oppColor)) * MOBILITY_WEIGHT;
    score -= cooldownPenalty(aiScan.pieces);
    score += cooldownPenalty(oppScan.pieces);
    score += kingSafetyScore(game.board, aiScan, oppScan, aiColor);
    score += threatScore(game.board, aiScan, oppScan, aiColor, oppColor);

    return score;
}

function scanBoard(board) {
    const scan = {
        [engine.COLORS.WHITE]: { pieces: [], king: null, shooter: null },
        [engine.COLORS.BLACK]: { pieces: [], king: null, shooter: null },
    };

    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const value = board.getSlot(r, c);
            if (!value) continue;

            const entry = scan[engine.getColor(value)];
            const piece = engine.getPiece(value);
            entry.pieces.push({ value, row: r, col: c });
            if (piece === engine.PIECE.KING) entry.king = { row: r, col: c };
            else if (piece === engine.PIECE.SHOOTER) entry.shooter = { value, row: r, col: c };
        }
    }

    return scan;
}

function countCaptured(player) {
    let count = 0;
    for (const v of player.inventory) if (v !== 0) count++;
    return count;
}

function materialScore(pieces) {
    let total = 0;
    for (const p of pieces) total += PIECE_VALUE[engine.getPiece(p.value)] ?? 0;
    return total;
}

function cooldownPenalty(pieces) {
    let total = 0;
    for (const p of pieces) total += engine.getCooldown(p.value) * COOLDOWN_PENALTY;
    return total;
}

function countActions(game, color) {
    return engine.getAllActions(game, color).length;
}

function kingSafetyScore(board, aiScan, oppScan, aiColor) {
    if (!aiScan.king || !oppScan.king) return 0;

    let score = 0;
    for (const [dr, dc] of NEIGHBORS_8) {
        const r = oppScan.king.row + dr, c = oppScan.king.col + dc;
        if (isOnBoard(r, c) && engine.getColor(board.getSlot(r, c)) === aiColor) score += KING_PROXIMITY_BONUS;
    }
    for (const [dr, dc] of NEIGHBORS_4) {
        const r = aiScan.king.row + dr, c = aiScan.king.col + dc;
        if (!isOnBoard(r, c)) continue;
        const cell = board.getSlot(r, c);
        if (engine.getColor(cell) === aiColor && engine.getPiece(cell) === engine.PIECE.PROTECTOR) score += PROTECTOR_SHIELD_BONUS;
    }
    return score;
}

/**
 * Pression laser : comme chaque tour tire automatiquement le laser du
 * joueur qui vient de jouer, la trajectoire "telle qu'elle est là,
 * maintenant" est justement celle que le prochain tir de chaque camp
 * suivra tant que personne ne bouge un miroir dans son chemin. On peut
 * donc s'en servir comme alerte "je meurs au prochain coup" sans avoir
 * besoin d'aller chercher 2 coups plus loin dans le minimax.
 */
function threatScore(board, aiScan, oppScan, aiColor, oppColor) {
    return laserPressure(board, aiScan.shooter, oppColor) - laserPressure(board, oppScan.shooter, aiColor);
}

function laserPressure(board, shooter, targetColor) {
    if (!shooter) return 0;
    const shot = traceBeamPath(board, shooter);
    if (shot.hitsColor !== targetColor) return 0;
    if (shot.hitsPiece === engine.PIECE.KING) return KING_THREAT_BONUS;
    return Math.round((PIECE_VALUE[shot.hitsPiece] ?? 0) * PIECE_THREAT_RATIO);
}

// Reproduit exactement la trajectoire d'engine.shootBeam, mais en lecture
// seule (aucune pièce n'est détruite) : on veut juste savoir ce qui SERAIT
// touché si ce tireur tirait maintenant.
function traceBeamPath(board, shooter) {
    let dir = engine.getRotation(shooter.value);
    let r = shooter.row, c = shooter.col;
    const visited = new Set();

    while (true) {
        const [dr, dc] = BEAM_DELTA[dir];
        r += dr; c += dc;
        if (!isOnBoard(r, c)) return { hitsColor: null, hitsPiece: null };

        const key = r * 10 + c;
        if (visited.has(key)) return { hitsColor: null, hitsPiece: null };
        visited.add(key);

        const cell = board.getSlot(r, c);
        const piece = engine.getPiece(cell);
        if (piece === engine.PIECE.NONE) continue;

        if (piece === engine.PIECE.TRIANGLE) {
            if (engine.isTriangleVulnerable(cell, dir)) return { hitsColor: engine.getColor(cell), hitsPiece: piece };
            dir = engine.getTriangleBounceDirection(cell, dir) ?? dir;
            continue;
        }
        if (piece === engine.PIECE.FULL_MIRROR) {
            dir = engine.getFullMirrorBounceDirection(cell, dir);
            continue;
        }
        if (piece === engine.PIECE.PROTECTOR) {
            if (engine.isProtectorVulnerable(cell, dir)) return { hitsColor: engine.getColor(cell), hitsPiece: piece };
            return { hitsColor: null, hitsPiece: null };
        }
        if (piece === engine.PIECE.SHOOTER) return { hitsColor: null, hitsPiece: null };

        return { hitsColor: engine.getColor(cell), hitsPiece: piece }; // ROI
    }
}

function isOnBoard(r, c) {
    return r >= 0 && r < 10 && c >= 0 && c < 10;
}

function opponentColor(color) {
    return color === engine.COLORS.WHITE ? engine.COLORS.BLACK : engine.COLORS.WHITE;
}

// ─── GÉNÉRATION DES COUPS EXPLORÉS PAR LA RECHERCHE ─────────────────────────

const MAX_PLACE_ACTIONS = 120;     // filet de sécurité seulement : on ne coupe qu'au-delà de ce volume
const PLACE_RELEVANCE_RADIUS = 4;  // on garde seulement les cases proches d'une pièce existante

/**
 * Les coups réellement légaux viennent de engine.getAllActions (jamais
 * altéré ici). On ne réduit que ce que la RECHERCHE explore, et seulement
 * dans le cas extrême où le nombre de PLACE dépasse largement ce qu'un
 * plateau normal produit : on garde alors ceux proches d'une pièce déjà en
 * jeu (même principe que getSmartPlaces côté service game), pour atteindre
 * une profondeur utile dans le budget temps. La plupart des positions ont
 * bien moins de MAX_PLACE_ACTIONS coups possibles et ne sont donc jamais
 * filtrées. La vérification anti-mort-en-un-coup (pickSafeAction plus bas)
 * n'utilise volontairement jamais ce plafond.
 */
function getSearchActions(game, color = game.colorTurn) {
    const actions = engine.getAllActions(game, color);
    const places = actions.filter(a => a.startsWith("PLACE/"));
    if (places.length <= MAX_PLACE_ACTIONS) return actions;

    const others = actions.filter(a => !a.startsWith("PLACE/"));
    return [...others, ...pickRelevantPlaces(game, places, color)];
}

function pickRelevantPlaces(game, places, color) {
    const oppColor = opponentColor(color);
    const references = [
        ...engine.getPlayerPieces(game.board, color),
        ...engine.getPlayerPieces(game.board, oppColor),
    ];
    if (!references.length) return places.slice(0, MAX_PLACE_ACTIONS);

    const relevant = places
        .map(place => {
            const { row, col } = engine.stringToPlace(place);
            return { place, row, col };
        })
        .filter(({ row, col }) => references.some(p =>
            Math.abs(p.row - row) <= PLACE_RELEVANCE_RADIUS && Math.abs(p.col - col) <= PLACE_RELEVANCE_RADIUS
        ));

    if (!relevant.length) return places.slice(0, MAX_PLACE_ACTIONS);

    // Sans ça, un tronquage aveugle par ordre de parcours du plateau peut
    // couper les cases collées au roi adverse juste parce qu'elles arrivent
    // tard dans le balayage (r,c croissants) : l'IA "ne verrait" jamais ces
    // coups sur un plateau chargé. On ne peut pas placer près de son PROPRE
    // roi (interdit par les règles, cf. isNearToYourKing dans engine.js),
    // donc seule la case du roi adverse mérite cette priorité.
    const { king: oppKing } = scanKing(game.board, oppColor);
    relevant.sort((a, b) => placePriority(b, oppKing) - placePriority(a, oppKing));

    return relevant.slice(0, MAX_PLACE_ACTIONS).map(e => e.place);
}

function scanKing(board, color) {
    for (let r = 0; r < 10; r++)
        for (let c = 0; c < 10; c++) {
            const cell = board.getSlot(r, c);
            if (engine.getPiece(cell) === engine.PIECE.KING && engine.getColor(cell) === color) return { king: { row: r, col: c } };
        }
    return { king: null };
}

function placePriority(candidate, oppKing) {
    return oppKing && chebyshevDistance(candidate, oppKing) <= 1 ? 1 : 0;
}

function chebyshevDistance(a, b) {
    return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

// ─── MINIMAX (IDS + ALPHA-BETA + TABLE DE TRANSPOSITION) ────────────────────

const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_TIME_BUDGET_MS = 1000;
const TRANSPOSITION_TABLE_MAX_SIZE = 200_000;
const ORDERING_MIN_DEPTH = 2; // en dessous, trier les coups coûte plus qu'il ne rapporte
const ACTION_TYPE_ORDER_BONUS = { PLACE: 15, SWAP: 10, ROTATE: 5, MOVE: 0 };

class SearchTimeout extends Error {}

/**
 * Recherche du meilleur coup par "iterative deepening" : on augmente la
 * profondeur tant qu'il reste du temps, et on garde toujours le résultat
 * de la dernière profondeur terminée. C'est ce qui sert de garde-fou :
 * quelle que soit la profondeur demandée, on retourne toujours un coup
 * valide avant la deadline. depthReached permet d'afficher/logger la
 * profondeur réellement atteinte.
 *
 * Le coup renvoyé par minimax passe ensuite par pickSafeAction : une
 * vérification finale, non plafonnée, qui garantit qu'on ne choisit jamais
 * un coup qui laisse l'adversaire tuer notre roi au tour suivant (voir
 * plus bas pourquoi la seule évaluation ne suffit pas à le garantir).
 */
export function findBestAction(game, { maxDepth = DEFAULT_MAX_DEPTH, timeBudgetMs = DEFAULT_TIME_BUDGET_MS } = {}) {
    const aiColor = game.colorTurn;
    const start = performance.now();
    const deadline = start + timeBudgetMs;
    const rootActions = getSearchActions(game, aiColor);
    if (!rootActions.length) throw new Error("No actions available");

    const transpositionTable = new Map();
    let ranked = rootActions.map(action => ({ action, score: 0 }));
    let depthReached = 0;

    for (let depth = 1; depth <= maxDepth; depth++) {
        try {
            ranked = searchRoot(game, depth, aiColor, deadline, transpositionTable);
            depthReached = depth;
        } catch (e) {
            if (e instanceof SearchTimeout) break;
            throw e;
        }
    }

    const bestAction = pickSafeAction(game, ranked, aiColor);
    return { action: bestAction, depthReached, elapsedMs: performance.now() - start };
}

// Retourne tous les coups racine triés du meilleur au moins bon (pas
// seulement le premier) : pickSafeAction en a besoin pour pouvoir
// descendre dans le classement si le meilleur coup s'avère être un piège.
function searchRoot(game, depth, aiColor, deadline, tt) {
    const actions = orderActions(game, getSearchActions(game, aiColor), aiColor, depth);
    const ranked = [];
    let alpha = -Infinity;

    for (const action of actions) {
        checkDeadline(deadline);
        const child = simulateAction(game, action);
        const score = minimax(child, depth - 1, alpha, Infinity, aiColor, deadline, tt);
        ranked.push({ action, score });
        alpha = Math.max(alpha, score);
    }

    return ranked.sort((a, b) => b.score - a.score);
}

/**
 * La pression laser dans evaluate() détecte une menace déjà en place, mais
 * pas un adversaire qui CRÉE la menace ce tour-ci (un nouveau miroir posé,
 * une rotation qui redirige son tir). La seule façon de garantir "je ne
 * meurs pas au prochain coup" est de vérifier, sans aucun plafonnage,
 * toutes les réponses adverses réellement légales après notre coup.
 * On part du meilleur coup selon minimax et on ne redescend dans le
 * classement que si nécessaire : dans l'immense majorité des positions,
 * le meilleur coup est déjà sûr et un seul passage suffit.
 */
function pickSafeAction(game, ranked, aiColor) {
    for (const { action } of ranked) {
        if (!opponentCanKillKingNextTurn(game, action, aiColor)) return action;
    }
    return ranked[0]?.action; // tous les coups perdent : autant jouer le meilleur quand même
}

function opponentCanKillKingNextTurn(game, action, aiColor) {
    const oppColor = opponentColor(aiColor);
    const afterMyMove = simulateAction(game, action);
    if (!afterMyMove.getPlayerByColor(aiColor).hasKingAlive()) return true;  // coup qui se tue tout seul
    if (!afterMyMove.getPlayerByColor(oppColor).hasKingAlive()) return false; // on a déjà gagné, pas de "tour suivant" à craindre

    for (const oppAction of engine.getAllActions(afterMyMove)) {
        const afterOpponentMove = simulateAction(afterMyMove, oppAction);
        if (!afterOpponentMove.getPlayerByColor(aiColor).hasKingAlive()) return true;
    }
    return false;
}

function minimax(game, depth, alpha, beta, aiColor, deadline, tt) {
    checkDeadline(deadline);

    const ai = game.getPlayerByColor(aiColor);
    const opp = game.getPlayerByColor(opponentColor(aiColor));
    if (!ai.hasKingAlive() || !opp.hasKingAlive()) return evaluate(game, aiColor);

    const key = hashGame(game);
    const cached = tt.get(key);
    if (cached && cached.depth >= depth) return cached.score;

    if (depth === 0) {
        const score = evaluate(game, aiColor);
        storeInTable(tt, key, { score, depth });
        return score;
    }

    const actions = getSearchActions(game);
    if (!actions.length) return evaluate(game, aiColor); // plus aucun coup jouable

    // Le camp qui joue à ce noeud est déterminé par colorTurn, pas par un
    // paramètre séparé : ça évite tout risque de désynchronisation.
    const isMaximizing = game.colorTurn === aiColor;
    const ordered = orderActions(game, actions, aiColor, depth);

    let score;
    if (isMaximizing) {
        let best = -Infinity;
        for (const action of ordered) {
            const child = simulateAction(game, action);
            const s = minimax(child, depth - 1, alpha, beta, aiColor, deadline, tt);
            best = Math.max(best, s);
            alpha = Math.max(alpha, s);
            if (beta <= alpha) break;
        }
        score = best;
    } else {
        // Le tri met les coups les meilleurs pour aiColor en premier ; côté
        // minimisant on veut l'inverse (les coups qui lui font le plus mal
        // en premier) pour couper plus vite avec alpha-bêta.
        let best = Infinity;
        for (const action of [...ordered].reverse()) {
            const child = simulateAction(game, action);
            const s = minimax(child, depth - 1, alpha, beta, aiColor, deadline, tt);
            best = Math.min(best, s);
            beta = Math.min(beta, s);
            if (beta <= alpha) break;
        }
        score = best;
    }

    storeInTable(tt, key, { score, depth });
    return score;
}

function simulateAction(game, action) {
    const next = game.clone();
    engine.decrementPiecesCD(next);
    engine.placeAction(next, action, next.colorTurn);
    return next;
}

function orderActions(game, actions, aiColor, depth) {
    if (depth < ORDERING_MIN_DEPTH) return actions;

    return actions
        .map(action => ({ action, score: estimateActionScore(game, action, aiColor) }))
        .sort((a, b) => b.score - a.score)
        .map(entry => entry.action);
}

function estimateActionScore(game, action, aiColor) {
    const type = action.split("/")[0];
    const child = simulateAction(game, action);
    return evaluate(child, aiColor) + (ACTION_TYPE_ORDER_BONUS[type] ?? 0);
}

function hashGame(game) {
    const white = game.getPlayerByColor(engine.COLORS.WHITE);
    const black = game.getPlayerByColor(engine.COLORS.BLACK);
    return `${game.board.grid}_${game.colorTurn}_${white.inventory}_${black.inventory}`;
}

function storeInTable(tt, key, entry) {
    if (tt.size >= TRANSPOSITION_TABLE_MAX_SIZE) tt.clear();
    tt.set(key, entry);
}

function checkDeadline(deadline) {
    if (performance.now() > deadline) throw new SearchTimeout();
}
