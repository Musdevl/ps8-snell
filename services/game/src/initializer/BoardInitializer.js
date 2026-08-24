import { DIRECTIONS, OPPOSITE_DIRECTIONS } from "../enum/Directions.js";
import { COLORS } from "../enum/Colors.js";
import { PIECE } from "../enum/Pieces.js"

import * as PieceService from "../service/PieceService.js"

export function initBoard(board) {
    const shooter_positions = placeShooters(board.getGrid());
    const king_positions = placeKings(board.getGrid(), shooter_positions);
    placeFirstProtectors(board.getGrid(), king_positions);
    placeSecondProtectors(board.getGrid(), shooter_positions);
    placeFullMirrors(board.getGrid());
    return board
}

export function initTutorialBoard(board) {

    const shooter_positions = placeShooters(board.getGrid(), 2);
    const king_positions = placeKings(board.getGrid(), shooter_positions, 3);
    placeFirstProtectors(board.getGrid(), king_positions);
    placeSecondProtectors(board.getGrid(), shooter_positions);
    placeFullMirrors(board.getGrid(), 3);
    return board;
}


export function placeShooters(board, column) {
    const width = board[0].length;

    if (column !== undefined && (column < 0 || column > width - 1)) {
        throw new Error(`[Board Init] Place ShootersI - column must be between 0 and ${width - 1}, got ${column}`);
    }

    const black_col = column ?? Math.floor(Math.random() * width);
    const white_col = width - 1 - black_col;

    const cellsToLeft = black_col;
    const cellsToRight = width - 1 - black_col;

    const black_direction = cellsToLeft > cellsToRight ? DIRECTIONS.WEST : DIRECTIONS.EAST;
    const white_direction = OPPOSITE_DIRECTIONS[black_direction];

    // Place the black's shooter
    board[0][black_col] = PieceService.createPiece(PIECE.SHOOTER, COLORS.BLACK, black_direction, 0);

    // Place the white's shooter
    board[board.length - 1][white_col] = PieceService.createPiece(PIECE.SHOOTER, COLORS.WHITE, white_direction, 0);

    return { black: { row: 0, col: black_col }, white: { row: board.length - 1, col: white_col } };
}



export function placeKings(board, shooter_positions, column) {
    const width = board[0].length;

    if (column !== undefined && (column < 0 || column > width - 1)) {
        throw new Error(`[Board Init] Place King - column must be between 0 and ${width - 1}, got ${column}`);
    }

    const all_positions = Array.from({ length: width }, (_, i) => i);

    const available_positions = all_positions.filter(
        col =>
            col !== 0 &&                           // Première colonne
            col !== width - 1 &&                   // Dernière colonne
            col !== shooter_positions.black.col && // Colonne sphinx blanc
            col !== shooter_positions.white.col    // Colonne sphinx noir
    );


    const kingIndex = column ?? Math.floor(Math.random() * available_positions.length);
    const black_col = available_positions[kingIndex];

    const white_col = width - 1 - black_col;

    // Place the black's King
    board[2][black_col] = PieceService.createPiece(PIECE.KING, COLORS.BLACK, DIRECTIONS.NORTH, 0)

    // Place the white's King
    board[board.length - 3][white_col] = PieceService.createPiece(PIECE.KING, COLORS.WHITE, DIRECTIONS.NORTH, 0)

    return {
        black: { row: 2, col: black_col },
        white: { row: board.length - 3, col: white_col }
    };
}

export function placeFirstProtectors(board, kings_positions) {
    // Place the white's first shield
    board[5][kings_positions.white.col] = PieceService.createPiece(PIECE.PROTECTOR, COLORS.WHITE, DIRECTIONS.NORTH, 0);

    // Place the black's first shield
    board[board.length - 6][kings_positions.black.col] = PieceService.createPiece(PIECE.PROTECTOR, COLORS.BLACK, DIRECTIONS.SOUTH, 0);
}

export function placeSecondProtectors(board, shooter_positions) {
    // Place the black's second shield
    board[3][shooter_positions.white.col] = PieceService.createPiece(PIECE.PROTECTOR, COLORS.BLACK, DIRECTIONS.SOUTH, 0)

    // Place the white's second shield
    board[board.length - 4][shooter_positions.black.col] = PieceService.createPiece(PIECE.PROTECTOR, COLORS.WHITE, DIRECTIONS.NORTH, 0)

}

export function placeFullMirrors(board, column) {
    const width = board[0].length;

    if (column !== undefined && (column < 0 || column > width - 1)) {
        throw new Error(`[Board Init] Place ShootersI - column must be between 0 and ${width - 1}, got ${column}`);
    }

    const black_col = column ?? findRandomColumnIndex(4, board);
    const white_col = width - 1 - black_col;

    const random_direction = getRandomDirection();
    const symmetric_random_direction = OPPOSITE_DIRECTIONS[random_direction];

    // Place the black's shooter
    board[4][black_col] = PieceService.createPiece(PIECE.FULL_MIRROR, COLORS.BLACK, symmetric_random_direction, 0)

    // Place the white's shooter
    board[board.length - 5][white_col] = PieceService.createPiece(PIECE.FULL_MIRROR, COLORS.WHITE, random_direction, 0)
}

function findRandomColumnIndex(row, board) {

    let col_index = -1;
    do {
        col_index = Math.floor(Math.random() * board[0].length - 1);
    } while (board[row][col_index] !== 0);

    return col_index;
}

export function getRandomDirection() {
    const values = Object.values(DIRECTIONS);
    return values[Math.floor(Math.random() * values.length)];
}
