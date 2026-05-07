import { GATEWAY_URL } from "../../../env.js";
import * as accountService from "../../../services/account-service.js";

export class LaserRenderer {
    #canvas;
    #animationId = null;

    constructor(canvas, cellSize) {
        this.#canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cellSize = cellSize;
        this.theme = accountService.getTheme()?.path ?? "default";
        this.explosionSound = new Audio(`${GATEWAY_URL}/assets/themes/${this.theme}/sounds/explosion.mp3`);

        this.explosionImg = new Image();
        this.explosionImg.src = `${GATEWAY_URL}/assets/themes/${this.theme}/animations/explosion.gif`;

        this.activeExplosions = [];

        this.explosionContainer = document.createElement('div');
        this.explosionContainer.style.cssText = `
        position: absolute; top: 0; left: 0;
        width: ${canvas.width}px; height: ${canvas.height}px;
        pointer-events: none;
    `;
        canvas.parentElement.style.position = 'relative';
        canvas.parentElement.appendChild(this.explosionContainer);
    }

    reset() {
        // 1. On dit au navigateur d'arrêter d'appeler la fonction d'animation
        if (this.#animationId) {
            cancelAnimationFrame(this.#animationId);
            this.#animationId = null;
        }
        // 2. On efface visuellement le laser
        this.activeExplosions = [];
        this.clear();
    }

    playSound() {
        const sound = new Audio(`${GATEWAY_URL}/assets/themes/${this.theme}/sounds/explosion.mp3`);
        sound.play().catch(() => { });
    }

    animate(positions, killedPositions = [], duration = 300, onComplete = null) {
        this.reset();
        if (positions.length < 2) {
            onComplete?.();
            return;
        }

        const numSegments = positions.length - 1;
        const startTime = performance.now();
        const holdDuration = 1000; // 2 secondes de maintien
        const fadeDuration = 400;  // 400ms de fade out
        const totalDuration = duration + holdDuration + fadeDuration;

        const killedTriggers = killedPositions.map(([kr, kc]) => {
            const idx = positions.findIndex(([r, c]) => r === kr && c === kc);
            return {
                row: kr, col: kc,
                triggerProgress: idx >= 0 ? idx / numSegments : 1,
                triggered: false
            };
        });

        const animateFrame = (currentTime) => {
            const elapsed = currentTime - startTime;
            const drawProgress = Math.min(elapsed / duration, 1);

            // Phase 1 : dessin progressif
            // Phase 2 : maintien (holdDuration)
            // Phase 3 : fade out
            let opacity = 1;
            if (elapsed > duration + holdDuration) {
                opacity = 1 - ((elapsed - duration - holdDuration) / fadeDuration);
                opacity = Math.max(0, opacity);
            }

            for (const kill of killedTriggers) {
                if (!kill.triggered && drawProgress >= kill.triggerProgress) {
                    kill.triggered = true;
                    this.playSound();
                    this.showExplosion(kill.row, kill.col);
                    this.#canvas.dispatchEvent(new CustomEvent('piece-killed', {
                        bubbles: true,
                        detail: { row: kill.row, col: kill.col }
                    }));
                }
            }

            this.drawProgressive(positions, drawProgress, opacity, currentTime);

            if (elapsed < totalDuration) {
                this.#animationId = requestAnimationFrame(animateFrame);
            } else {
                this.clear();
                onComplete?.();
            }
        };

        this.#animationId = requestAnimationFrame(animateFrame);
    }

    drawProgressive(positions, totalProgress, opacity = 1, currentTime = 0) {
        this.clear();
        const ctx = this.ctx;

        // Couche 1 — halo rouge large et diffus
        ctx.shadowColor = `rgba(255, 0, 0, ${opacity * 0.4})`;
        ctx.shadowBlur = 25;
        ctx.strokeStyle = `rgba(180, 0, 0, ${opacity})`;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        this.#drawPath(ctx, positions, totalProgress);

        // Couche 2 — rouge vif
        ctx.shadowBlur = 12;
        ctx.shadowColor = `rgba(255, 50, 50, ${opacity * 0.6})`;
        ctx.strokeStyle = `rgba(255, 40, 40, ${opacity})`;
        ctx.lineWidth = 4;
        this.#drawPath(ctx, positions, totalProgress);

        // Couche 3 — cœur blanc pur
        ctx.shadowBlur = 6;
        ctx.shadowColor = `rgba(255, 255, 255, ${opacity})`;
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = 1.5;
        this.#drawPath(ctx, positions, totalProgress);

        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }

    #drawPath(ctx, positions, totalProgress) {
        const numSegments = positions.length - 1;
        const currentProgressValue = totalProgress * numSegments;

        const rows = this.#canvas.height / this.cellSize;
        const cols = this.#canvas.width / this.cellSize;

        ctx.beginPath();

        const [r0, c0] = positions[0];
        const [r1, c1] = positions[1];

        const dxStart = c1 - c0;
        const dyStart = r1 - r0;

        let startX = c0 * this.cellSize + this.cellSize / 2;
        let startY = r0 * this.cellSize + this.cellSize / 2;

        if (dxStart === 1) startX += this.cellSize / 2.4;
        if (dxStart === -1) startX -= this.cellSize / 2.4;
        if (dyStart === 1) startY += this.cellSize / 2.4;
        if (dyStart === -1) startY -= this.cellSize / 2.4;

        ctx.moveTo(startX, startY);

        for (let i = 0; i < numSegments; i++) {
            const start = positions[i];
            const end = positions[i + 1];
            const isLastSegment = (i === numSegments - 1);

            const x1 = start[1] * this.cellSize + this.cellSize / 2;
            const y1 = start[0] * this.cellSize + this.cellSize / 2;
            const x2 = end[1] * this.cellSize + this.cellSize / 2;
            const y2 = end[0] * this.cellSize + this.cellSize / 2;

            let targetX = x2;
            let targetY = y2;

            if (isLastSegment) {
                const dx = end[1] - start[1];
                const dy = end[0] - start[0];

                const isAtBorder =
                    end[0] === 0 ||
                    end[1] === 0 ||
                    end[0] === rows - 1 ||
                    end[1] === cols - 1;

                if (isAtBorder) {
                    targetX += dx * this.cellSize * 0.6;
                    targetY += dy * this.cellSize * 0.6;
                } else {
                    targetX -= dx * this.cellSize * 0.3;
                    targetY -= dy * this.cellSize * 0.3;
                }
            }

            if (currentProgressValue > i + 1) {
                ctx.lineTo(targetX, targetY);
            } else if (currentProgressValue > i) {
                const segmentProgress = currentProgressValue - i;

                const partialX = x1 + (targetX - x1) * segmentProgress;
                const partialY = y1 + (targetY - y1) * segmentProgress;

                ctx.lineTo(partialX, partialY);
                break;
            }
        }

        ctx.stroke();
    }

    showExplosion(row, col, gifDuration = 1000) {
        const size = this.cellSize * 1;
        const x = col * this.cellSize + this.cellSize / 2 - size / 2;
        const y = row * this.cellSize + this.cellSize / 2 - size / 2;

        const img = document.createElement('img');
        img.src = `${GATEWAY_URL}/assets/themes/${this.theme}/animations/explosion.gif?t=${Date.now()}`;
        img.style.cssText = `
        position: absolute;
        left: ${x}px; top: ${y}px;
        width: ${size}px; height: ${size}px;
    `;
        this.explosionContainer.appendChild(img);

        setTimeout(() => img.remove(), gifDuration);
    }

    clear() {
        this.ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    }

    getCanvas() {
        return this.#canvas;
    }
}