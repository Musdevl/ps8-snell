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


const puzzle_7 =
{
    initPuzzle: () => {

        const puzzle_steps = [
            "PLACE/91,0",  // WHITE
            "PLACE/71,16",  // BLACK
            "ROTATE/97,48", // WHITE
            "PLACE/61,16",  // BLACK
            "PLACE/67,32",  // WHITE
            "ROTATE/02,48", // BLACK
            "SWAP/56,74",   // WHITE
            "PLACE/64,0",  // BLACK
            "MOVE/54,53",   // WHITE
            "ROTATE/02,16",  // BLACK
            "PLACE/34,16"   // WHITE
        ];

        const board = new Board();

        const white_shooter = pieceService.createPiece(PIECE.SHOOTER, COLORS.WHITE, DIRECTIONS.WEST)
        const white_king = pieceService.createPiece(PIECE.KING, COLORS.WHITE, DIRECTIONS.NORTH)
        const white_first_protector = pieceService.createPiece(PIECE.PROTECTOR, COLORS.WHITE, DIRECTIONS.SOUTH)
        const white_second_protector = pieceService.createPiece(PIECE.PROTECTOR, COLORS.WHITE, DIRECTIONS.SOUTH)
        const white_full_mirror = pieceService.createPiece(PIECE.FULL_MIRROR, COLORS.WHITE, DIRECTIONS.NORTH)

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

        board.setSlot(0, 2, black_shooter)
        board.setSlot(2, 5, black_king)
        board.setSlot(3, 7, black_first_protector)
        board.setSlot(4, 5, black_second_protector)
        board.setSlot(4, 3, black_full_mirror)

        const white_player = PlayerInitializer.initPlayer(new Player(COLORS.WHITE, undefined, undefined), 7);
        const black_player = PlayerInitializer.initPlayer(new Player(COLORS.BLACK, undefined, undefined), 7);

        const game = new Game(board, "LOCAL", true);

        game.addPlayer(white_player);
        game.addPlayer(black_player);

        return new Puzzle(7, "Miroir piégé", game, puzzle_steps, PUZZLE_DIFFICULTY.SILVER);
    }
}

const puzzle_8 =
{
    initPuzzle: () => {

        const puzzle_steps = [
            "PLACE/91,0",  // WHITE
            "PLACE/71,16",  // BLACK
            "ROTATE/97,48", // WHITE
            "PLACE/61,16",  // BLACK
            "PLACE/67,32",  // WHITE
            "ROTATE/02,48", // BLACK
            "SWAP/56,74",   // WHITE
            "PLACE/64,0",  // BLACK
            "MOVE/54,53",   // WHITE
            "ROTATE/02,16",  // BLACK
            "PLACE/34,16"   // WHITE
        ];

        const board = new Board();

        const white_shooter = pieceService.createPiece(PIECE.SHOOTER, COLORS.WHITE, DIRECTIONS.WEST)
        const white_king = pieceService.createPiece(PIECE.KING, COLORS.WHITE, DIRECTIONS.NORTH)
        const white_first_protector = pieceService.createPiece(PIECE.PROTECTOR, COLORS.WHITE, DIRECTIONS.SOUTH)
        const white_second_protector = pieceService.createPiece(PIECE.PROTECTOR, COLORS.WHITE, DIRECTIONS.SOUTH)
        const white_full_mirror = pieceService.createPiece(PIECE.FULL_MIRROR, COLORS.WHITE, DIRECTIONS.NORTH)

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

        board.setSlot(0, 2, black_shooter)
        board.setSlot(2, 5, black_king)
        board.setSlot(3, 7, black_first_protector)
        board.setSlot(4, 5, black_second_protector)
        board.setSlot(4, 3, black_full_mirror)

        const white_player = PlayerInitializer.initPlayer(new Player(COLORS.WHITE, undefined, undefined), 7);
        const black_player = PlayerInitializer.initPlayer(new Player(COLORS.BLACK, undefined, undefined), 7);

        const game = new Game(board, "LOCAL", true);

        game.addPlayer(white_player);
        game.addPlayer(black_player);

        return new Puzzle(8, "Déviation", game, puzzle_steps, PUZZLE_DIFFICULTY.SILVER);
    }
}


export const silver_puzzles = [
    puzzle_7.initPuzzle(),
    puzzle_8.initPuzzle(),
]