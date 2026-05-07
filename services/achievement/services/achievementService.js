import { in_game_achievements, blank_achievemnets } from "../achivements/in_game_achievements.js";
import { COLORS } from "../enum/Colors.js"

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:8010"

function findCurrentUserId(game_state) {
    switch (game_state.colorTurn) {
        case COLORS.WHITE:
            return game_state.white;
        case COLORS.BLACK:
            return game_state.black;
        default:
            throw new Error("Invalid color turn")
    }
}


// Pass through all in game achievements
export async function searchInGameAchievements(previous_game_state, next_game_state) {
    let current_userId = findCurrentUserId(previous_game_state);
    in_game_achievements.forEach(async (achievement) => {
        if (achievement.check(previous_game_state, next_game_state) && current_userId) {
            await achievementComplete(current_userId, achievement.content);
        }
    })
}


async function achievementComplete(userId, achievement) {
    console.log("[ACHIEVEMENT SERVICE]", userId, " completed the achievement ", achievement.name);
    try {
        await fetch(`${USER_SERVICE_URL}/api/user/achievement`,
            {
                method: "POST",
                body: JSON.stringify({
                    userId, achievement: achievement
                }),
                headers: { "Content-Type": "application/json" }
            }
        )

    } catch (error) {
        console.log(error)
    }
}

export function getBlankAchievements() { return blank_achievemnets; }
