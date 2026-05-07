import {Board} from "../../../model/Board.js";
import {Shooter} from "../../../model/Piece/Shooter.js";
import {Triangle} from "../../../model/Piece/Triangle.js";
import {LaserService} from "../../../service/LaserService.js";
import {DIRECTIONS} from "../../../enum/Directions.js";
import {COLORS} from "../../../enum/Colors.js";
import {test, assertEqual, assert, runTests} from '../../Tester.js';
import {EmptySlot} from "../../../model/Piece/EmptySlot.js";
import * as PieceService from "../../../service/PieceService.js";
import {PIECE} from "../../../enum/Pieces.js";

export function TriangleTest() {



    test('Vulnérabilité des triangles', () => {
        const board = new Board();
        const laserService = new LaserService();
        let grid = board.getGrid()

        grid[0][0] = PieceService.createPiece(PIECE.SHOOTER, COLORS.WHITE, DIRECTIONS.SOUTH, 0);
        grid[3][0] = PieceService.createPiece(PIECE.TRIANGLE, COLORS.WHITE, DIRECTIONS.SOUTH, 0);
        grid[6][0] = PieceService.createPiece(PIECE.TRIANGLE, COLORS.WHITE, DIRECTIONS.SOUTH, 0);

        laserService.shootBeam(board, COLORS.WHITE);

        assertEqual(grid[3][0], 0);
        assertEqual(grid[6][0], 0);


        grid[3][0] = PieceService.createPiece(PIECE.TRIANGLE, COLORS.WHITE, DIRECTIONS.NORTH, 0);
        grid[6][0] = PieceService.createPiece(PIECE.TRIANGLE, COLORS.WHITE, DIRECTIONS.SOUTH, 0);

        laserService.shootBeam(board, COLORS.WHITE);
        assertEqual(grid[3][0], 1);
        assertEqual(grid[6][0], 33);


        grid[3][0] = PieceService.createPiece(PIECE.TRIANGLE, COLORS.WHITE, DIRECTIONS.SOUTH, 0);
        grid[6][0] = PieceService.createPiece(PIECE.TRIANGLE, COLORS.WHITE, DIRECTIONS.NORTH, 0);

        laserService.shootBeam(board, COLORS.WHITE);
        assertEqual(grid[3][0], 0);
        assertEqual(grid[6][0], 1);
    });


    test('Le laser rebondi correctement les triangles', () => {
        const board = new Board();
        let grid = board.getGrid()

        grid[0][0] = PieceService.createPiece(PIECE.SHOOTER, COLORS.WHITE, DIRECTIONS.SOUTH, 0);
        grid[3][0] = PieceService.createPiece(PIECE.TRIANGLE, COLORS.WHITE, DIRECTIONS.NORTH, 0);
        grid[3][3] = PieceService.createPiece(PIECE.TRIANGLE, COLORS.WHITE, DIRECTIONS.WEST, 0);



        const laserService = new LaserService();
        const result = laserService.shootBeam(board, COLORS.WHITE);

        let expectedResult = [
            [ 1, 0 ], [ 2, 0 ],
            [ 3, 0 ], [ 3, 1 ],
            [ 3, 2 ], [ 3, 3 ],
            [ 2, 3 ], [ 1, 3 ],
            [ 0, 3 ]
        ]

        assertEqual(result, expectedResult);
    });
}