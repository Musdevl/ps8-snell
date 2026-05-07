import { PIECE_NAME } from "../enum/Pieces.js";

export function getNearCases(board, row, col) {

    let currentCell = board[row][col]
    let nearCases = []

    if (currentCell.pieceName === PIECE_NAME[5] || currentCell.pieceName === PIECE_NAME[3]) return nearCases;

    if (row > 0 && (board[row - 1][col] === null))
        nearCases.push({ row: row - 1, col: col, isPiece: false });
    if (row < 9 && (board[row + 1][col] === null))
        nearCases.push({ row: row + 1, col: col, isPiece: false });
    if (col > 0 && (board[row][col - 1] === null))
        nearCases.push({ row: row, col: col - 1, isPiece: false });
    if (col < 9 && (board[row][col + 1] === null))
        nearCases.push({ row: row, col: col + 1, isPiece: false });

    if (currentCell.pieceName === PIECE_NAME[2]) {                  // PIECE_NAME[5] = 'king'
        const my_king_piece = findMyPiece(board, currentCell.color, PIECE_NAME[5]);
        if (my_king_piece.piece.cooldown === 0) {
            nearCases.push({ row: my_king_piece.row, col: my_king_piece.col, isPiece: true });
        }                                                           // PIECE_NAME[3] = 'shooter'
        const my_shooter_piece = findMyPiece(board, currentCell.color, PIECE_NAME[3]);
        if (my_shooter_piece.piece.cooldown === 0) {
            nearCases.push({ row: my_shooter_piece.row, col: my_shooter_piece.col, isPiece: true });
        }
    }

    return nearCases;
}

function findMyPiece(board, color, pieceName) {
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            if (board[row][col] && board[row][col].pieceName === pieceName && board[row][col].color === color) {
                return { piece: board[row][col], row: row, col: col };
            };
        }
    }
}

export function createEmptyBoard() {
    const board = [];
    for (let row = 0; row < 10; row++) {
        board[row] = [];
        for (let col = 0; col < 10; col++) {
            board[row][col] = null;
        }
    }
    return board;
}

export function initCellCanvas(canvas, size) {
    canvas.width = size;
    canvas.height = size;
}

export function getClickPosition(event, cellSize) {

    const x = event.offsetX;
    const y = event.offsetY;

    return {
        row: Math.floor(y / cellSize),
        col: Math.floor(x / cellSize)
    };
}


export function getAvailableCells(grid, playerColor) {
    let availableCells = [];
    let unavailableCells = [];

    for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
            if (grid[row][col] === null && !isNearToAShooter(grid, row, col) && !isNearToYourKing(grid, row, col, playerColor)) {
                availableCells.push({ row, col });
            } else if (grid[row][col] === null) {
                unavailableCells.push({ row, col });
            }
        }
    }

    return { availableCells, unavailableCells };
}


function isNearToYourKing(grid, row, col, playerColor) {
    if (row > 0) {
        let upCell = grid[row - 1][col];
        if (upCell !== null && upCell.pieceName === PIECE_NAME[5] &&
            upCell.color === playerColor) return true;
    }
    if (row < grid.length - 1) {
        let downCell = grid[row + 1][col];
        if (downCell !== null && downCell.pieceName === PIECE_NAME[5] &&
            downCell.color === playerColor) return true;
    }
    if (col > 0) {
        let leftCell = grid[row][col - 1];
        if (leftCell !== null && leftCell.pieceName === PIECE_NAME[5] &&
            leftCell.color === playerColor) return true;
    }
    if (col < grid[0].length - 1) {
        let rightCell = grid[row][col + 1];
        if (rightCell !== null && rightCell.pieceName === PIECE_NAME[5] &&
            rightCell.color === playerColor) return true;
    }
    return false;
}

function isNearToAShooter(grid, row, col) {

    if (row > 0) {
        let upPiece = grid[row - 1][col];
        if (upPiece !== null && upPiece.pieceName === PIECE_NAME[3]) return true;
    }

    if (row < grid.length - 1) {
        let downPiece = grid[row + 1][col];
        if (downPiece !== null && downPiece.pieceName === PIECE_NAME[3]) return true;
    }

    if (col > 0) {
        let leftPiece = grid[row][col - 1];
        if (leftPiece !== null && leftPiece.pieceName === PIECE_NAME[3]) return true;
    }

    if (col < grid[0].length - 1) {
        let rightPiece = grid[row][col + 1];
        if (rightPiece !== null && rightPiece.pieceName === PIECE_NAME[3]) return true;
    }
    return false;
}



const MOBILE_MQ = window.matchMedia('(max-width: 64em)');

export function getCellSize() {
    if (MOBILE_MQ.matches) {
        return Math.floor((window.innerWidth - 16) / 10);
    }
    return 75;
}