const DEFAULT_OPTIONS = {
    dim: 0.6,                       // opacité du voile appliqué au reste du plateau
    dimColor: '10, 12, 18',         // composantes RGB du voile
    outline: true,                  // liseré autour des cases mises en avant
    outlineColor: '255, 205, 80',
    pulse: true                     // le liseré respire, pour attirer l'œil
};

const PULSE_PERIOD_MS = 1400;

/**
 * Coup de projecteur sur une ou plusieurs cases : tout le plateau est
 * assombri, sauf celles qu'on passe en paramètre.
 *
 * Ce renderer a son propre canvas, et c'est volontaire : le canvas
 * d'interaction est remis à zéro à chaque sélection de pièce et à chaque
 * action (clearInteractions), ce qui effacerait le projecteur au premier clic.
 * Un calque séparé survit aux re-rendus de la grille, aux animations et au
 * laser, et ne capte aucun clic (pointer-events: none côté CSS).
 *
 * Les coordonnées reçues sont LOGIQUES, comme partout ailleurs : la
 * transformation d'orientation est posée sur le contexte par BoardRenderer.
 */
export class HighlightRenderer {
    #canvas;
    #animationId = null;
    #cells = [];
    #options = { ...DEFAULT_OPTIONS };

    constructor(canvas, cellSize) {
        this.#canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cellSize = cellSize;
    }

    /**
     * @param {Array} cells  [{row, col}] ou [[row, col]]
     * @param {Object} options  voir DEFAULT_OPTIONS
     */
    show(cells, options = {}) {
        const normalized = normalizeCells(cells);

        if (normalized.length === 0) {
            this.clear();
            return;
        }

        this.#cells = normalized;
        this.#options = { ...DEFAULT_OPTIONS, ...options };
        this.#start();
    }

    clear() {
        this.#stop();
        this.#cells = [];
        this.#clearCanvas();
    }

    /** Le contexte perd tout quand on réaffecte canvas.width : on redessine. */
    redraw() {
        if (this.#cells.length === 0) return;
        this.#start();
    }

    isActive() {
        return this.#cells.length > 0;
    }

    #start() {
        this.#stop();

        if (!this.#options.pulse) {
            this.#draw(1);
            return;
        }

        const frame = (now) => {
            // 0 → 1 → 0, sans à-coup
            const phase = (Math.sin((now / PULSE_PERIOD_MS) * Math.PI * 2) + 1) / 2;
            this.#draw(phase);
            this.#animationId = requestAnimationFrame(frame);
        };

        this.#animationId = requestAnimationFrame(frame);
    }

    #stop() {
        if (this.#animationId) {
            cancelAnimationFrame(this.#animationId);
            this.#animationId = null;
        }
    }

    #draw(phase) {
        const ctx = this.ctx;
        const { dim, dimColor, outline, outlineColor } = this.#options;
        const size = this.cellSize;

        this.#clearCanvas();

        // 1. Le voile, sur tout le plateau.
        ctx.save();
        ctx.fillStyle = `rgba(${dimColor}, ${dim})`;
        ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);

        // 2. On perce le voile à l'emplacement des cases mises en avant.
        ctx.globalCompositeOperation = 'destination-out';
        for (const { row, col } of this.#cells) {
            ctx.fillRect(col * size, row * size, size, size);
        }
        ctx.restore();

        if (!outline) return;

        // 3. Le liseré, par-dessus le trou.
        ctx.save();
        const alpha = 0.55 + 0.45 * phase;
        ctx.strokeStyle = `rgba(${outlineColor}, ${alpha})`;
        ctx.lineWidth = Math.max(2, size * 0.06);
        ctx.shadowColor = `rgba(${outlineColor}, ${alpha * 0.8})`;
        ctx.shadowBlur = size * 0.25;

        const inset = ctx.lineWidth / 2;
        for (const { row, col } of this.#cells) {
            ctx.strokeRect(
                col * size + inset,
                row * size + inset,
                size - ctx.lineWidth,
                size - ctx.lineWidth
            );
        }
        ctx.restore();
    }

    #clearCanvas() {
        this.ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    }

    getCanvas() {
        return this.#canvas;
    }
}

/** Accepte indifféremment [{row, col}] et [[row, col]]. */
function normalizeCells(cells) {
    if (!Array.isArray(cells)) return [];

    return cells
        .map(cell => Array.isArray(cell)
            ? { row: Number(cell[0]), col: Number(cell[1]) }
            : { row: Number(cell?.row), col: Number(cell?.col) })
        .filter(({ row, col }) => Number.isInteger(row) && Number.isInteger(col));
}
