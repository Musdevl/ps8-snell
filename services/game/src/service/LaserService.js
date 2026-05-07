import { COLORS } from "../enum/Colors.js";
import { Logger } from "../utils/Logger.js";
import { MASK, PIECE } from "../enum/Pieces.js";
import * as PieceService from "../service/PieceService.js"
import { DIRECTIONS } from "../enum/Directions.js";




export function shootBeam(board, colorTurn, players = []) {
    let [shooter, position] = findShooter(board, colorTurn);
    let laserDirection = shooter & MASK.DIRECTION;
    let currentLaserPosition = [...position];
    let laserPath = [];
    let killedPiecePosition = [];
    let white_triangle_shooted = 0;
    let black_triange_shooted = 0;

    laserPath.push(position);

    const directionDelta = {
        0: [-1, 0],
        32: [1, 0],
        48: [0, -1],
        16: [0, 1]
    };


    while (true) {
        // Avancer le laser


        currentLaserPosition[0] += directionDelta[laserDirection][0]; // row
        currentLaserPosition[1] += directionDelta[laserDirection][1]; // col

        const row = currentLaserPosition[0];
        const col = currentLaserPosition[1];


        if (positionInvalid(row, col) || hasCycle(laserPath)) {
            Logger.debug("Invalid position or cycle");
            break;
        }

        laserPath.push([row, col]);

        const currentCase = board.getSlot(row, col);

        // Vérifier si on touche une pièce
        if (PieceService.getPiece(currentCase) === PIECE.NONE) {
            Logger.debug("Laser traverse le vide en " + row + " " + col);
        }

        else if (PieceService.getPiece(currentCase) === PIECE.TRIANGLE) {
            if (isTriangleVulnerable(currentCase, laserDirection)) {

                if (PieceService.getColor(currentCase) === COLORS.WHITE) white_triangle_shooted += 1;
                if (PieceService.getColor(currentCase) === COLORS.BLACK) black_triange_shooted += 1;

                board.killSlot(row, col);
                Logger.debug("Laser tue triangle en " + row + " " + col);
            }
            else {
                laserDirection = getTriangleBounceDirection(currentCase, laserDirection);
                Logger.debug("Laser reflechit dans triangle en " + row + " " + col);
            }
        }

        else if (PieceService.getPiece(currentCase) === PIECE.FULL_MIRROR) {
            laserDirection = getFullMirrorBounceDirection(currentCase, laserDirection);
            Logger.debug("Laser reflechie dans Full miroir en ", row, col)
        }

        else if (PieceService.getPiece(currentCase) === PIECE.KING) {
            const kingColor = currentCase & MASK.COLOR;

            // Pour savoir si un joueur a son roi en vie facilement
            players.forEach(player => {
                if (player.getColor() === kingColor) {
                    player.killKing();
                }
            });

            board.killSlot(row, col);
            killedPiecePosition.push([row, col]);

        }

        else if (PieceService.getPiece(currentCase) === PIECE.PROTECTOR) {
            if (isProtectorVulnerable(currentCase, laserDirection)) {
                board.killSlot(row, col);
                Logger.debug("Laser tue shield en ", row, col);
                killedPiecePosition.push([row, col])
            }
            else {
                Logger.debug("Laser bloqué par shield en ", row, col);
                break; // Le laser arrete son chemin
            }
        }

        else if (PieceService.getPiece(currentCase) === PIECE.SHOOTER) {
            Logger.debug("Laser bloqué par shooter en ", row, col);
            break; // Le laser arrete son chemin
        }

    }

    return { laserPath, white_triangle_shooted, black_triange_shooted, killedPiecePosition };

}

function hasCycle(laserPath) {
    const count = {};

    for (const coord of laserPath) {
        count[coord] = (count[coord] || 0) + 1;
        if (count[coord] > 2) {
            return true; // cycle détecté
        }
    }

    return false;
}


function positionInvalid(row, col) {
    if (row < 0 || row >= 10 || col < 0 || col >= 10) {
        Logger.debug("Laser sort du board !");
        return true;
    }
    return false;
}

function findShooter(board, color) {

    for (let col = 0; col < 10; col++) {
        for (let row = 0; row < 10; row++) {
            const currentCase = board.getSlot(row, col);
            const currentPiece = currentCase & MASK.PIECE;
            const currentColor = currentCase & MASK.COLOR;

            if (currentPiece === PIECE.SHOOTER && currentColor === color) {
                return [currentCase, [row, col]];
            }
        }
    }
    throw new Error("Unable to find shooter");
}

function isTriangleVulnerable(triangleCase, laserDirection) {
    const triangleDirection = triangleCase & MASK.DIRECTION;

    switch (triangleDirection) {
        case DIRECTIONS.SOUTH:
            return laserDirection === 48 || laserDirection === 32;

        case DIRECTIONS.WEST:
            return laserDirection === 0 || laserDirection === 48;

        case DIRECTIONS.NORTH:
            return laserDirection === 0 || laserDirection === 16;

        case DIRECTIONS.EAST:
            return laserDirection === 16 || laserDirection === 32;

        default:
            return false;
    }
}

function getTriangleBounceDirection(triangleCase, laserIncomingDirection) {
    const triangleFacing = triangleCase & MASK.DIRECTION;

    const bounceMap = {
        [DIRECTIONS.SOUTH]: {
            0: 48,
            16: 32
        },
        [DIRECTIONS.WEST]: {
            32: 48,
            16: 0
        },
        [DIRECTIONS.NORTH]: {
            32: 16,
            48: 0
        },
        [DIRECTIONS.EAST]: {
            0: 16,
            48: 32
        }
    };

    return bounceMap[triangleFacing]?.[laserIncomingDirection] ?? null;
}

function getFullMirrorBounceDirection(mirrorCase, laserIncomingDirection) {
    const mirrorFacing = mirrorCase & MASK.DIRECTION;

    const bounceMap = {
        [DIRECTIONS.SOUTH]: {
            0: 48,
            16: 32,
            32: 16,
            48: 0
        },
        [DIRECTIONS.WEST]: {
            0: 16,
            16: 0,
            32: 48,
            48: 32
        },
        [DIRECTIONS.NORTH]: {
            0: 48,
            16: 32,
            32: 16,
            48: 0
        },
        [DIRECTIONS.EAST]: {
            0: 16,
            16: 0,
            32: 48,
            48: 32
        }
    };

    return bounceMap[mirrorFacing]?.[laserIncomingDirection] ?? null;
}


function isProtectorVulnerable(protectorCase, laserDirection) {
    const protectorFacing = protectorCase & MASK.DIRECTION;

    switch (protectorFacing) {
        case DIRECTIONS.NORTH:
            return laserDirection !== 32;

        case DIRECTIONS.SOUTH:
            return laserDirection !== 0;

        case DIRECTIONS.WEST:
            return laserDirection !== 16;

        case DIRECTIONS.EAST:
            return laserDirection !== 48;

        default:
            return true;
    }
}
