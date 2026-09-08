import os from 'node:os';

// Perfs de la machine hôte. Le container partage le /proc de l'hôte : les
// chiffres décrivent bien le serveur, pas le container admin.
export function getSystemStats() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const cpuCount = os.cpus().length;

    // La charge est cumulée sur 1, 5 et 15 minutes. Rapportée au nombre de
    // coeurs, 1 = machine pleine, au-dessus ça commence à faire la queue.
    const [load1, load5, load15] = os.loadavg();

    return {
        uptime: Math.round(os.uptime()),
        cpus: cpuCount,
        load: {
            '1m': round(load1),
            '5m': round(load5),
            '15m': round(load15),
            percent: round((load1 / cpuCount) * 100),
        },
        memory: {
            total: totalMemory,
            free: freeMemory,
            used: totalMemory - freeMemory,
            percent: round(((totalMemory - freeMemory) / totalMemory) * 100),
        },
    };
}

function round(value) {
    return Math.round(value * 100) / 100;
}
