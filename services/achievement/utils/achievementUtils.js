export function findCurrentUserId(game_state) {
    switch (game_state.colorTurn) {
        case COLORS.WHITE:
            return game_state.white;
        case COLORS.BLACK:
            return game_state.black;
        default:
            throw new Error("Invalid color turn")
    }
}


