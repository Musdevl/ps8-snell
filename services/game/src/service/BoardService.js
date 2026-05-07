import * as PlayerService from "./PlayerService.js";
import * as ActionSerializer from "../serializer/ActionSerializer.js";
import * as BoardInitializer from "../initializer/BoardInitializer.js";
import * as PieceService from "./PieceService.js"
import { PIECE } from "../enum/Pieces.js";
import { ROTATION_DIRECTION } from "../enum/Directions.js"

export function move(board, action, colorTurn) {

    const move = ActionSerializer.stringToMove(action);

    let oldRow = move.oldRow;
    let oldCol = move.oldCol;

    const oldPiece = board.getSlot(oldRow, oldCol);

    let newRow = move.newRow;
    let newCol = move.newCol;

    const newPiece = board.getSlot(newRow, newCol);

    if (PieceService.getColor(oldPiece) !== colorTurn) {
        throw new Error(`[WS] Player ${colorTurn} cannot move this piece`);
    }

    if (PieceService.getPiece(oldPiece) === PIECE.SHOOTER ||
        PieceService.getPiece(oldPiece) === PIECE.KING) {
        throw new Error(`[WS] Player ${colorTurn} cannot move this piece`)
    }

    if (PieceService.getPiece(newPiece) === 0) {
        const piece = oldPiece;
        board.setSlot(newRow, newCol, piece);
        board.setSlot(oldRow, oldCol, 0)
    } else {
        throw new Error(`You are not allowed to move this piece here`)
    }
}

export function place(player, board, action, color) {

    PlayerService.checkPlayerCanPlace(player)
    const place = ActionSerializer.stringToPlace(action);

    let row = place.row
    let col = place.col
    let direction = place.direction

    const piece = PieceService.getPiece(board.getSlot(row, col))

    if (piece === 0 && !isNearToYourKing(board.grid, row, col, color) && !isNearToAShooter(board.grid, row, col)) {
        let triangle = PlayerService.takeLastAvailablePiece(player.getInventory());
        triangle = PieceService.setDirection(triangle, direction);
        board.setSlot(row, col, triangle)
    } else {
        throw new Error(`Player ${player.getUserId()} can't place a piece here`)
    }
}

export function swap(board, action, color) {

    // TO DO Add Cooldown to pieces

    const parsed_action = ActionSerializer.stringToSwap(action);

    const firstPieceRow = parsed_action.firstPieceRow;
    const firstPieceCol = parsed_action.firstPieceCol;

    const secondPieceRow = parsed_action.secondPieceRow;
    const secondPieceCol = parsed_action.secondPieceCol;

    const firstPiece = board.getSlot(firstPieceRow, firstPieceCol);
    const secondPiece = board.getSlot(secondPieceRow, secondPieceCol);

    if (firstPiece === 0 || secondPiece === 0) {
        throw new Error(`Can't swap with an empty slot`)
    }

    else if (PieceService.getCooldown(firstPiece) > 0) {
        throw new Error(`Can't swap ${firstPiece} with ${secondPiece} because ${firstPiece} still has an active cooldown`)
    }

    else if (PieceService.getCooldown(secondPiece) > 0) {
        throw new Error(`Can't swap ${firstPiece} with ${secondPiece} because ${secondPiece} still has an active cooldown`)
    }

    else if (PieceService.getColor(firstPiece) !== color && PieceService.getColor(secondPiece) !== color) {
        throw new Error(`Player ${color} can't swap those pieces`);
    }

    else if (PieceService.getColor(firstPiece) !== PieceService.getColor(secondPiece)) {
        throw new Error(`Can't swap ${firstPiece} with ${secondPiece} because the must have the same color`)
    }

    else if (PieceService.getPiece(firstPiece) !== PIECE.FULL_MIRROR) {
        throw new Error(`Can't swap with the piece ${firstPiece}`);
    }

    board.setSlot(firstPieceRow, firstPieceCol, PieceService.setCooldown(secondPiece, 2));
    board.setSlot(secondPieceRow, secondPieceCol, firstPiece);

    if (PieceService.getPiece(firstPiece) === PIECE.SHOOTER || PieceService.getPiece(secondPiece) === PIECE.SHOOTER) {
        return { allowed_to_shoot: false };
    }

    return { allowed_to_shoot: true };
}

export function rotate(board, action) {

    const rotate = ActionSerializer.stringToRotate(action);
    const direction = rotate.direction;

    const row = rotate.row
    const col = rotate.col

    let piece = board.getSlot(row, col);

    if (PieceService.getPiece(piece) === PIECE.KING) {
        throw new Error(`Invalid Rotate: can't rotate King`);
    }

    if (piece !== 0) {
        switch (direction) {
            case ROTATION_DIRECTION.CLOCK_WISE:
                piece = PieceService.rotateLeft(piece);
                board.setSlot(row, col, piece);
                break;
            case ROTATION_DIRECTION.ANTI_CLOCK_WISE:
                piece = PieceService.rotateRight(piece);
                board.setSlot(row, col, piece);
                break;
            default:
                throw new Error(`Unknown rotation direction: ${direction}`);
        }
    } else {
        throw new Error(`Invalid Cell Selected ${action}`);
    }
}

export function initBoard(board) {
    return BoardInitializer.initBoard(board);
}

export function initTutorialBoard(board) {
    return BoardInitializer.initTutorialBoard(board)
}

export function decrementBoardPieces(board, colorTurn) {
    for (let i = 0; i < board.grid.length; i++) {
        for (let j = 0; j < board.grid[0].length; j++) {
            const piece = board.grid[i][j];
            if (PieceService.getColor(piece) === colorTurn)
                board.setSlot(i, j, PieceService.decrementCD(piece));
        }
    }
}

export function get_all_available_cells(board, color) {
    let availableCells = [];
    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
            if (board[row][col] === 0 && !isNearToAShooter(board, row, col) && !isNearToYourKing(board, row, col, color)) {
                availableCells.push({ row, col });
            }
        }
    }

    return availableCells;
}

function isNearToYourKing(board, row, col, playerColor) {
    if (row > 0) {
        let upCell = board[row - 1][col];
        if (PieceService.getPiece(upCell) === PIECE.KING &&
            PieceService.getColor(upCell) === playerColor) return true;
    }
    if (row < board.length - 1) {
        let downCell = board[row + 1][col];
        if (PieceService.getPiece(downCell) === PIECE.KING &&
            PieceService.getColor(downCell) === playerColor) return true;
    }
    if (col > 0) {
        let leftCell = board[row][col - 1];
        if (PieceService.getPiece(leftCell) === PIECE.KING &&
            PieceService.getColor(leftCell) === playerColor) return true;
    }
    if (col < board[0].length - 1) {
        let rightCell = board[row][col + 1];
        if (PieceService.getPiece(rightCell) === PIECE.KING &&
            PieceService.getColor(rightCell) === playerColor) return true;
    }
    return false;
}

function isNearToAShooter(board, row, col) {

    if (row > 0) {
        let upPiece = PieceService.getPiece(board[row - 1][col]);
        if (upPiece === PIECE.SHOOTER) return true;
    }

    if (row < board.length - 1) {
        let downPiece = PieceService.getPiece(board[row + 1][col]);
        if (downPiece === PIECE.SHOOTER) return true;
    }

    if (col > 0) {
        let leftPiece = PieceService.getPiece(board[row][col - 1]);
        if (leftPiece === PIECE.SHOOTER) return true;
    }

    if (col < board[0].length - 1) {
        let rightPiece = PieceService.getPiece(board[row][col + 1]);
        if (rightPiece === PIECE.SHOOTER) return true;
    }
    return false;
}

export function get_player_pieces(grid, color) {

    let pieces_coords = []

    for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < grid[0].length; j++) {
            if (grid[i][j] !== 0 && PieceService.getColor(grid[i][j]) === color) {
                pieces_coords.push({ value: grid[i][j], row: i, col: j });
            }

        }
    }

    return pieces_coords;
}

export function get_near_cells(grid, row, col) {
    const near_pieces = [];

    if (row < 9) {
        near_pieces.push({ value: grid[row + 1][col], row: row + 1, col: col })
    }

    if (col < 9) {
        near_pieces.push({ value: grid[row][col + 1], row: row, col: col + 1 })
    }

    if (row > 0) {
        near_pieces.push({ value: grid[row - 1][col], row: row - 1, col: col })
    }

    if (col > 0) {
        near_pieces.push({ value: grid[row][col - 1], row: row, col: col - 1 })
    }

    return near_pieces;
}

export function get_swapable_cells(grid, row, col) {
    let swapable_cells = [];
    const my_king_piece = findMyPiece(grid, PieceService.getColor(grid[row][col]), PIECE.KING);

    if (my_king_piece && PieceService.getCooldown(my_king_piece.piece) === 0) {
        swapable_cells.push({ row: my_king_piece.row, col: my_king_piece.col });
    }

    const my_shooter_piece = findMyPiece(grid, PieceService.getColor(grid[row][col]), PIECE.SHOOTER);
    if (my_shooter_piece && PieceService.getCooldown(my_shooter_piece.piece) === 0) {
        swapable_cells.push({ value: my_shooter_piece.piece, row: my_shooter_piece.row, col: my_shooter_piece.col });
    }

    return swapable_cells;
}


function findMyPiece(grid, color, piece) {

    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            if (grid[row][col] && PieceService.getPiece(grid[row][col]) === piece && PieceService.getColor(grid[row][col]) === color) {

                return { piece: grid[row][col], row: row, col: col };
            };
        }
    }
}
