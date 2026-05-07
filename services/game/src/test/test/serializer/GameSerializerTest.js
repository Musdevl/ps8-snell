
import {test} from "../../Tester.js";
import {GameService} from "../../../service/GameService.js";
import {Player} from "../../../model/Player.js";
import {COLORS} from "../../../enum/Colors.js";
import {Triangle} from "../../../model/Piece/Triangle.js";
import {DIRECTIONS} from "../../../enum/Directions.js";


export function GameSerializerTest() {
    test('GameToFEN', () => {

        let gameService = new GameService();
        let game = gameService.createGame();
        let player1 = new Player(COLORS.WHITE);
        let player2 = new Player(COLORS.BLACK)
        game.addPlayer(player1);
        game.addPlayer(player2);
        player1.addPieceToInventory(new Triangle(DIRECTIONS.NORTH, COLORS.WHITE));
        
        let fen = GameToFEN(game);
    })

}
