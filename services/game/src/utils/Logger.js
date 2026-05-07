export class Logger {
    static level = 1;

    static debug(msg) {
        if (Logger.level >= 3) console.log(`[DEBUG] ${msg}`);
    }

    static log(msg) {
        if (Logger.level >= 2) console.log(`[LOG] ${msg}`);
    }

    static error(msg) {
        if (Logger.level >= 1) console.log(`[ERROR] ${msg}`);
    }

    static setLevel(level) {
        Logger.level = level;
    }
}

// export default Logger;