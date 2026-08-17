export class AbstractAi {

    id;
    name;
    path;
    elo;

    constructor(id, name, elo, path) {
        this.id = id;
        this.name = name;
        this.elo = elo;
        this.path = path;
    }

    getId() { return this.id; }

    getName() { return this.name; }

    getPath() { return this.path; }

    getNextAction(game) {
        throw new Error('You must implement this function');
    }

    toDto() {
        return {
            id: this.id,
            name: this.name,
            elo: this.elo,
            path: this.path
        };
    }
}