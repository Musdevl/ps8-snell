import { COLORS } from "../../../enum/Colors.js";
import { DIRECTIONS } from "../../../enum/Directions.js";
import { Board } from "../../../model/Board.js";
import { EmptySlot } from "../../../model/Piece/EmptySlot.js";
import { FullMirror } from "../../../model/Piece/FullMiror.js";
import { Triangle } from "../../../model/Piece/Triangle.js";
import { BoardService } from "../../../service/BoardService.js";
import { test, assertEqual, assert } from "../../Tester.js"
import { Player } from "../../../model/Player.js"

export function BoardServiceTest() {

    const board = new Board();
    const boardService = new BoardService();

    test('moveTest', () => {
        const fullMirror = new FullMirror(DIRECTIONS.NORTH, COLORS.WHITE);
        board.setSlot(0, 0, fullMirror);
        assertEqual(board.getSlot(0, 0), fullMirror)

        const moveAction = "MOVE/00,01";
        boardService.move(board, moveAction, COLORS.WHITE)
        assertEqual(board.getSlot(0, 1), fullMirror)
    });

    test('placeTest', () => {
        const placeAction = "PLACE/00,3";
        assert(board.getSlot(0, 0) instanceof EmptySlot);

        const player = new Player(COLORS.WHITE, -1, -1);

        const triangle = new Triangle(DIRECTIONS.NORTH, COLORS.WHITE)

        player.addPieceToInventory(triangle);

        boardService.place(player, board, placeAction);
        assertEqual(board.getSlot(0, 0), triangle)

        assert(player.getInventory().length === 0);
    });

    test('swapTest', () => {

    })

    test('rotateTest', () => {
        const fullMirror = new FullMirror(DIRECTIONS.NORTH, COLORS.WHITE);
        board.setSlot(0, 0, fullMirror);

        assertEqual(DIRECTIONS.NORTH, fullMirror.getFacing());

        let rotateAction = "ROTATE/00,0"

        boardService.rotate(board, rotateAction);
        assertEqual(board.getSlot(0, 0).getFacing(), DIRECTIONS.WEST)

        boardService.rotate(board, rotateAction);
        assertEqual(board.getSlot(0, 0).getFacing(), DIRECTIONS.SOUTH)

        boardService.rotate(board, rotateAction);
        assertEqual(board.getSlot(0, 0).getFacing(), DIRECTIONS.EAST)

        boardService.rotate(board, rotateAction);
        assertEqual(board.getSlot(0, 0).getFacing(), DIRECTIONS.NORTH)

        boardService.rotate(board, rotateAction);
        assertEqual(board.getSlot(0, 0).getFacing(), DIRECTIONS.WEST)

        rotateAction = "ROTATE/00,1";

        boardService.rotate(board, rotateAction);
        assertEqual(board.getSlot(0, 0).getFacing(), DIRECTIONS.NORTH);

        boardService.rotate(board, rotateAction);
        assertEqual(board.getSlot(0, 0).getFacing(), DIRECTIONS.EAST);

        boardService.rotate(board, rotateAction);
        assertEqual(board.getSlot(0, 0).getFacing(), DIRECTIONS.SOUTH);

        boardService.rotate(board, rotateAction);
        assertEqual(board.getSlot(0, 0).getFacing(), DIRECTIONS.WEST);

        boardService.rotate(board, rotateAction);
        assertEqual(board.getSlot(0, 0).getFacing(), DIRECTIONS.NORTH);
    });
}