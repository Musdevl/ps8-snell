export class Player {

    userId; // int
    webSocketId; //int
    elo;
    kingAlive;
    time;
    color;
    inventory;
    connected;

    constructor(color, websockerId, userId) {
        this.kingAlive = true;
        this.connected = true;
        this.time = 600;
        this.color = color;
        this.inventory = new Uint8Array(14);
        this.webSocketId = websockerId;
        this.userName = "None"; //ToDo Change this
        this.userId = userId;
    }

    hasKingAlive() {
        return this.kingAlive;
    }

    killKing() {
        this.kingAlive = false;
    }

    getUserName() {
        return this.userName;
    }

    getWebSocketId() {
        return this.webSocketId;
    }

    getElo() {
        return this.elo;
    }

    getUserId() {
        return this.userId;
    }

    getColor() {
        return this.color;
    }

    getInventory() {
        return this.inventory;
    }

    getTime() {
        return this.time;
    }

    addTriangle(triangle) {
        for (let i = 0; i < this.inventory.length; i++) {
            if (this.inventory[i] === 0) {
                this.inventory[i] = triangle;
                break;
            }
        }
    }

    clone() {
        const cloned = new Player(this.color, this.webSocketId, this.userId);
        cloned.kingAlive = this.kingAlive;
        cloned.connected = this.connected;
        cloned.time = this.time;
        cloned.inventory = new Uint8Array(this.inventory); // Uint8Array → copie binaire
        cloned.userName = this.userName;
        cloned.elo = this.elo;
        return cloned;
    }

}