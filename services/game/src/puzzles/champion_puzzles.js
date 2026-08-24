import * as pieceService from "../service/PieceService.js";
import { Board } from "../model/Board.js";
import { COLORS } from "../enum/Colors.js";
import { Game } from "../model/Game.js";
import { Puzzle } from "../model/Puzzle.js";
import { PIECE } from "../enum/Pieces.js";
import { DIRECTIONS } from "../enum/Directions.js";
import { Player } from "../model/Player.js";
import * as PlayerInitializer from "../initializer/PlayerInitializer.js";
import { PUZZLE_DIFFICULTY } from "../enum/PuzzleDifficulty.js";


const puzzle_13 =
{
    initPuzzle: () => {

        const playerColor = COLORS.WHITE

        const puzzle_steps = [
            "PLACE/91,0",  // WHITE
        ];

        const board = new Board();

        const white_shooter = pieceService.createPiece(PIECE.SHOOTER, COLORS.WHITE, DIRECTIONS.WEST)
        const white_king = pieceService.createPiece(PIECE.KING, COLORS.WHITE, DIRECTIONS.NORTH)
        const white_first_protector = pieceService.createPiece(PIECE.PROTECTOR, COLORS.WHITE, DIRECTIONS.SOUTH)
        const white_second_protector = pieceService.createPiece(PIECE.PROTECTOR, COLORS.WHITE, DIRECTIONS.SOUTH)
        const white_full_mirror = pieceService.createPiece(PIECE.FULL_MIRROR, COLORS.WHITE, DIRECTIONS.NORTH)
        const white_triangle = pieceService.createPiece(PIECE.TRIANGLE, COLORS.WHITE, DIRECTIONS.EAST)

        const black_shooter = pieceService.createPiece(PIECE.SHOOTER, COLORS.BLACK, DIRECTIONS.EAST)
        const black_king = pieceService.createPiece(PIECE.KING, COLORS.BLACK, DIRECTIONS.NORTH)
        const black_first_protector = pieceService.createPiece(PIECE.PROTECTOR, COLORS.BLACK, DIRECTIONS.SOUTH)
        const black_second_protector = pieceService.createPiece(PIECE.PROTECTOR, COLORS.BLACK, DIRECTIONS.SOUTH)
        const black_full_mirror = pieceService.createPiece(PIECE.FULL_MIRROR, COLORS.BLACK, DIRECTIONS.NORTH)

        board.setSlot(9, 7, white_shooter)
        board.setSlot(7, 4, white_king)
        board.setSlot(6, 2, white_first_protector)
        board.setSlot(5, 4, white_second_protector)
        board.setSlot(5, 6, white_full_mirror)
        board.setSlot(2, 1, white_triangle);

        board.setSlot(0, 2, black_shooter)
        board.setSlot(2, 5, black_king)
        board.setSlot(3, 7, black_first_protector)
        board.setSlot(4, 5, black_second_protector)
        board.setSlot(4, 3, black_full_mirror)

        const white_player = PlayerInitializer.initPlayer(new Player(COLORS.WHITE, undefined, undefined), 6);
        const black_player = PlayerInitializer.initPlayer(new Player(COLORS.BLACK, undefined, undefined), 7);

        const game = new Game(board, "LOCAL", true);

        game.addPlayer(white_player);
        game.addPlayer(black_player);

        return new Puzzle(13, "No Name", game, puzzle_steps, PUZZLE_DIFFICULTY.CHAMPION, playerColor);
    }
}

const puzzle_14 =
{
    initPuzzle: () => {
        const playerColor = COLORS.WHITE

        const puzzle_steps = [
            "ROTATE/97,48", // WHITE
        ];

        const board = new Board();

        const white_shooter = pieceService.createPiece(PIECE.SHOOTER, COLORS.WHITE, DIRECTIONS.WEST)
        const white_king = pieceService.createPiece(PIECE.KING, COLORS.WHITE, DIRECTIONS.NORTH)
        const white_second_protector = pieceService.createPiece(PIECE.PROTECTOR, COLORS.WHITE, DIRECTIONS.SOUTH)
        const white_full_mirror = pieceService.createPiece(PIECE.FULL_MIRROR, COLORS.WHITE, DIRECTIONS.EAST);
        const white_triangle_1 = pieceService.createPiece(PIECE.TRIANGLE, COLORS.WHITE, DIRECTIONS.WEST)
        const white_triangle_2 = pieceService.createPiece(PIECE.TRIANGLE, COLORS.WHITE, DIRECTIONS.SOUTH);

        const black_shooter = pieceService.createPiece(PIECE.SHOOTER, COLORS.BLACK, DIRECTIONS.SOUTH)
        const black_king = pieceService.createPiece(PIECE.KING, COLORS.BLACK, DIRECTIONS.NORTH)
        const black_first_protector = pieceService.createPiece(PIECE.PROTECTOR, COLORS.BLACK, DIRECTIONS.SOUTH)
        const black_second_protector = pieceService.createPiece(PIECE.PROTECTOR, COLORS.BLACK, DIRECTIONS.SOUTH)
        const black_full_mirror = pieceService.createPiece(PIECE.FULL_MIRROR, COLORS.BLACK, DIRECTIONS.NORTH)
        const black_triangle = pieceService.createPiece(PIECE.TRIANGLE, COLORS.BLACK, DIRECTIONS.SOUTH);

        board.setSlot(9, 7, white_shooter)
        board.setSlot(7, 4, white_king)
        board.setSlot(5, 4, white_second_protector)
        board.setSlot(5, 7, white_full_mirror)
        board.setSlot(5, 9, white_triangle_1);
        board.setSlot(2, 9, white_triangle_2);

        board.setSlot(0, 2, black_shooter)
        board.setSlot(2, 5, black_king)
        board.setSlot(3, 7, black_first_protector)
        board.setSlot(5, 5, black_second_protector)
        board.setSlot(4, 3, black_full_mirror)
        board.setSlot(0, 8, black_triangle);

        const white_player = PlayerInitializer.initPlayer(new Player(COLORS.WHITE, undefined, undefined), 5);
        const black_player = PlayerInitializer.initPlayer(new Player(COLORS.BLACK, undefined, undefined), 6);

        const game = new Game(board, "LOCAL", true);

        game.addPlayer(white_player);
        game.addPlayer(black_player);

        return new Puzzle(14, "No Name", game, puzzle_steps, PUZZLE_DIFFICULTY.CHAMPION, playerColor);
    }
}



export const champion_puzzles = [
    puzzle_13.initPuzzle(),
    puzzle_14.initPuzzle()
];