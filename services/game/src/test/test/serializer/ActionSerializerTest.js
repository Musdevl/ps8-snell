import { DIRECTIONS } from "../../../enum/Directions.js";
import * as ActionSerializer from "../../../serializer/ActionSerializer.js"
import { assertEqual, test } from "../../Tester.js";


export function ActionSerializerTest() {

    test('stringToMoveTest', () => {
        let move = "MOVE/01,11";
        const parsed_move = ActionSerializer.stringToMove(move);

        assertEqual(parsed_move.oldRow, 0);
        assertEqual(parsed_move.oldCol, 1);
        assertEqual(parsed_move.newRow, 1);
        assertEqual(parsed_move.newCol, 1)
    });

    test('stringToPlaceTest', () => {
        let place = "PLACE/01,3";
        const parsed_place = ActionSerializer.stringToPlace(place);

        assertEqual(parsed_place.row, 0);
        assertEqual(parsed_place.col, 1);
        assertEqual(parsed_place.facing, DIRECTIONS.WEST);
    });

    test('stringToSwapTest', () => {
        let swap = "SWAP/01,02";
        const parsed_swap = ActionSerializer.stringToSwap(swap);

        assertEqual(parsed_swap.firstPieceRow, 0);
        assertEqual(parsed_swap.firstPieceCol, 1);
        assertEqual(parsed_swap.secondPieceRow, 0);
        assertEqual(parsed_swap.secondPieceCol, 2);
    })
}