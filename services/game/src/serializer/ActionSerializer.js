export function stringToMove(action_details) {
    // Exemple attendu : "MOVE/01,11"
    const parts = getParts(action_details)

    if (parts.length < 2 || parts[0] !== "MOVE") throw new Error("Invalid MOVE Format, excepted : MOVE/xy,zw but got:", action_details);

    const payload = parts[1].split(",");

    if (payload.length !== 2) throw new Error("[MOVE] - Invalid Coordinates, excepted : xy,zw but got: ", payload);

    const [oldCoords, newCoords] = payload;

    if (oldCoords.length !== 2 || newCoords.length !== 2) throw new Error("Each coordinates mus have a size of 2");

    return {
        oldRow: parseInt(oldCoords[0]),
        oldCol: parseInt(oldCoords[1]),
        newRow: parseInt(newCoords[0]),
        newCol: parseInt(newCoords[1])
    };
}

export function actionToString() {

}

export function stringToPlace(action_details) {
    // Exemple Place/01,4
    const parts = getParts(action_details)

    if (parts.length !== 2 || parts[0] !== "PLACE") throw new Error("Invalid PLACE Format, excepted : PLACE/xy,z")

    const payload = parts[1].split(",");

    if (payload.length !== 2) throw new Error("[PLACE] - Invalid Coordinates, excepted : xy,zw but got: ", payload);

    return {
        row: parseInt(payload[0][0]),
        col: parseInt(payload[0][1]),
        direction: parseInt(payload[1])
    }
}

function getParts(action_details) {
    if (typeof action_details !== "string") throw new Error("Action details must be a string");
    return action_details.split("/");
}

export function placeToString() { }

export function stringToSwap(action_details) {
    // Exemple attendu : SWAP/01,02
    const parts = getParts(action_details);

    if (parts.length !== 2 || parts[0] !== "SWAP") {
        throw new Error("Invalid SWAP Format, expected : SWAP/xy/zw");
    }

    const payload = parts[1].split(",");

    if (payload.length !== 2) {
        throw new Error("Invalid Coordinates, expected : xy,zw");
    }

    const [firstPieceCoords, secondPieceCoords] = payload;

    if (firstPieceCoords.length !== 2 || secondPieceCoords.length !== 2) {
        throw new Error("Each coordinate must contain exactly 2 characters");
    }

    return {
        firstPieceRow: parseInt(firstPieceCoords[0]),
        firstPieceCol: parseInt(firstPieceCoords[1]),
        secondPieceRow: parseInt(secondPieceCoords[0]),
        secondPieceCol: parseInt(secondPieceCoords[1])
    };
}

export function stringToRotate(action_details) {
    // Exemple attendu : ROTATE/01,0

    const parts = getParts(action_details);

    if (parts.length !== 2 || parts[0] !== "ROTATE") {
        throw new Error("Invalid ROTATE Format, expected : ROTATE/xy,z");
    }

    const payload = parts[1].split(",");

    if (payload.length !== 2) {
        throw new Error("Invalid ROTATE payload, expected : xy,z");
    }

    const [coords, direction] = payload;

    if (coords.length !== 2) {
        throw new Error("Invalid coordinates, expected : xy");
    }

    return {
        row: parseInt(coords[0]),
        col: parseInt(coords[1]),
        direction: parseInt(direction)
    };
}

