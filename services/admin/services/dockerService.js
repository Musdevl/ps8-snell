// ADMIN SERVICE
import http from 'node:http';

const CONTAINER_PREFIX = 'snell';
const SOCKET_PATH = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';

// L'API Docker parle HTTP sur une socket unix
function dockerRequest(path) {
    return new Promise((resolve, reject) => {
        const req = http.request({ socketPath: SOCKET_PATH, path, method: 'GET' }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    return reject(new Error(`Docker API ${res.statusCode}: ${body}`));
                }
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(new Error(`Réponse Docker illisible: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => reject(new Error(`Socket Docker injoignable (${SOCKET_PATH}): ${error.message}`)));
        req.end();
    });
}

// Retourne les containers dont le nom commence par "snell", qu'ils tournent ou non.
export async function getSnellContainers() {
    // all=true : sans ça, Docker ne renvoie que les containers en cours d'exécution.
    const containers = await dockerRequest('/containers/json?all=true');

    return containers
        .map((container) => {
            // Docker préfixe les noms d'un "/" et peut en exposer plusieurs (alias réseau).
            const name = (container.Names?.[0] || '').replace(/^\//, '');

            return {
                id: container.Id.slice(0, 12),
                name,
                image: container.Image,
                state: container.State,     // running, exited, created, restarting...
                status: container.Status,   // libellé humain, ex: "Up 3 minutes"
                running: container.State === 'running'
            };
        })
        .filter((container) => container.name.startsWith(CONTAINER_PREFIX))
        .sort((a, b) => a.name.localeCompare(b.name));
}

// Consommation d'un container. stream=false : Docker renvoie un seul relevé au
// lieu d'un flux continu, mais met ~1s à répondre (il lui faut deux mesures).
export async function getContainerStats(id) {
    const stats = await dockerRequest(`/containers/${id}/stats?stream=false`);

    return {
        id: stats.id?.slice(0, 12) || id,
        name: (stats.name || '').replace(/^\//, ''),
        cpu: { percent: cpuPercent(stats) },
        memory: memoryUsage(stats),
    };
}

// Consommation de tous les containers snell qui tournent, en parallèle.
export async function getSnellContainersStats() {
    const containers = await getSnellContainers();
    const running = containers.filter((container) => container.running);

    return await Promise.all(running.map((container) => getContainerStats(container.id)));
}

// Docker donne des compteurs cumulés : le pourcentage se déduit de l'écart
// entre le relevé courant (cpu_stats) et le précédent (precpu_stats).
function cpuPercent(stats) {
    const cpuDelta = stats.cpu_stats?.cpu_usage?.total_usage - stats.precpu_stats?.cpu_usage?.total_usage;
    const systemDelta = stats.cpu_stats?.system_cpu_usage - stats.precpu_stats?.system_cpu_usage;
    const cpus = stats.cpu_stats?.online_cpus || 1;

    if (!cpuDelta || !systemDelta || systemDelta <= 0) return 0;

    return round((cpuDelta / systemDelta) * cpus * 100);
}

function memoryUsage(stats) {
    const limit = stats.memory_stats?.limit || 0;
    // Le cache disque est compté dans usage alors qu'il est récupérable : on le
    // retire pour rester proche de ce qu'affiche "docker stats". Le champ change
    // de nom entre cgroup v2 (inactive_file) et v1 (total_inactive_file).
    const cache = stats.memory_stats?.stats?.inactive_file
        ?? stats.memory_stats?.stats?.total_inactive_file
        ?? 0;
    const usage = (stats.memory_stats?.usage || 0) - cache;

    return {
        usage,
        limit,
        percent: limit ? round((usage / limit) * 100) : 0,
    };
}

function round(value) {
    return Math.round(value * 100) / 100;
}
