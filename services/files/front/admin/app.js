import { GATEWAY_URL } from '../env.js';

// Les stats containers coûtent ~1s côté Docker : on rafraîchit doucement.
const REFRESH_MS = 3000;

// Dernières valeurs connues : le bandeau se redessine d'un bloc, mais ses
// compteurs viennent de deux routes qui ne répondent pas en même temps.
const kpis = { online: null, games: null, total: null, today: null, load: null, memory: null };

// Les modes viennent du gameType du service game ; libellés lisibles côté page.
const GAME_MODES = { MULTI: 'multijoueur', AI: 'contre IA', LOCAL: 'local' };

async function get(path) {
    const res = await fetch(`${GATEWAY_URL}/api/admin${path}`);
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    return await res.json();
}

function render(id, html) {
    document.getElementById(id).innerHTML = html;
}

function fail(id, error) {
    render(id, `<span class="error">indisponible — ${error.message}</span>`);
}

function mo(bytes) {
    return `${Math.round(bytes / 1024 / 1024)} Mo`;
}

// Vert / ambre / rouge : un taux d'occupation est un état, pas une identité.
function level(percent) {
    if (percent >= 85) return 'crit';
    if (percent >= 70) return 'warn';
    return '';
}

function gauge(name, percent, reading) {
    return `<div class="gauge">
        <span class="name">${name}</span>
        <span class="track"><span class="fill ${level(percent)}" style="width:${Math.min(percent, 100)}%"></span></span>
        <span class="read dim">${reading}</span>
    </div>`;
}

function renderKpis() {
    const cells = [
        { label: 'users connectés', value: kpis.online },
        { label: 'parties en cours', value: kpis.games },
        { label: 'inscrits', value: kpis.total },
        { label: "inscrits aujourd'hui", value: kpis.today },
        { label: 'charge cpu', value: kpis.load, unit: '%' },
        { label: 'mémoire', value: kpis.memory, unit: '%' },
    ];

    render('kpis', cells.map(cell => `
        <div class="kpi">
            <div class="label">${cell.label}</div>
            <div class="value">${cell.value ?? '—'}${cell.unit && cell.value !== null ? `<span class="unit">${cell.unit}</span>` : ''}</div>
        </div>`).join(''));
}

function renderSeries(data) {
    // Hauteur relative au pic de la période : sans référence commune, deux
    // barres de même hauteur ne voudraient pas dire la même chose.
    const peak = Math.max(...data.perDay.map(day => day.count), 1);

    render('registrations', `
        <div class="series">
            ${data.perDay.map(day => `
                <div class="day" title="${day.date} — ${day.count} inscription(s)">
                    <div class="top">${day.count || ''}</div>
                    <div class="col ${day.count ? '' : 'empty'}" style="height:${(day.count / peak) * 100}%"></div>
                </div>`).join('')}
        </div>
        <div class="series-axis">
            ${data.perDay.map(day => `<span>${day.date.slice(8)}/${day.date.slice(5, 7)}</span>`).join('')}
        </div>
        <div class="legend">
            total ${data.total} &middot; période ${data.period} &middot; pic ${peak}/jour
        </div>`);
}

function renderGames(data) {
    // Un mode sans partie n'apparaît pas dans la réponse : on part de la liste
    // connue pour que les lignes ne dansent pas d'un rafraîchissement à l'autre.
    const modes = Object.keys(GAME_MODES);
    const extra = Object.keys(data.byMode).filter(mode => !modes.includes(mode));

    render('games', `
        <table>
            <tbody>
                ${[...modes, ...extra].map(mode => `
                    <tr>
                        <td class="dim">${GAME_MODES[mode] || mode}</td>
                        <td class="num">${data.byMode[mode] || 0}</td>
                    </tr>`).join('')}
                <tr>
                    <td class="dim">file d'attente</td>
                    <td class="num">${data.queue}</td>
                </tr>
            </tbody>
        </table>
        <div class="legend">${data.total} partie(s) en cours</div>`);
}

function renderSystem(data) {
    render('system', `
        ${gauge('cpu', data.load.percent, `${data.load.percent}% de ${data.cpus} coeurs`)}
        ${gauge('ram', data.memory.percent, `${mo(data.memory.used)} / ${mo(data.memory.total)}`)}
        <table style="margin-top:14px">
            <tbody>
                <tr><td class="dim">uptime</td><td>${Math.floor(data.uptime / 86400)}j ${Math.floor(data.uptime % 86400 / 3600)}h</td></tr>
                <tr><td class="dim">load avg</td><td>${data.load['1m']} &middot; ${data.load['5m']} &middot; ${data.load['15m']} <span class="mute">(1/5/15 min)</span></td></tr>
            </tbody>
        </table>`);
}

function renderContainers(list, stats) {
    const byId = new Map(stats.containers.map(container => [container.id, container]));

    render('containers', `
        <table>
            <thead>
                <tr>
                    <th>service</th>
                    <th>état</th>
                    <th class="num">cpu</th>
                    <th>&nbsp;</th>
                    <th class="num">ram</th>
                    <th>image</th>
                </tr>
            </thead>
            <tbody>
                ${list.containers.map(container => {
                    const stat = byId.get(container.id);
                    const cpu = stat ? stat.cpu.percent : null;

                    return `<tr>
                        <td><span class="dot ${container.running ? 'up' : 'down'}"></span>${container.name}</td>
                        <td class="${container.running ? 'dim' : 'error'}">${container.status}</td>
                        <td class="num">${cpu === null ? '<span class="mute">—</span>' : cpu + ' %'}</td>
                        <td><span class="bar"><i style="width:${Math.min(cpu || 0, 100)}%"></i></span></td>
                        <td class="num">${stat ? mo(stat.memory.usage) : '<span class="mute">—</span>'}</td>
                        <td class="mute">${container.image}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`);
}

// Chaque bloc a son propre catch : un service en panne n'emporte pas la page.
function refresh() {
    get('/online')
        .then(data => { kpis.online = data.count; renderKpis(); })
        .catch(() => { kpis.online = null; renderKpis(); });

    get('/games')
        .then(data => {
            kpis.games = data.total;
            renderKpis();
            renderGames(data);
        })
        .catch(error => { kpis.games = null; renderKpis(); fail('games', error); });

    get('/registrations?days=7')
        .then(data => {
            kpis.total = data.total;
            kpis.today = data.today;
            renderKpis();
            renderSeries(data);
        })
        .catch(error => fail('registrations', error));

    get('/system')
        .then(data => {
            kpis.load = data.load.percent;
            kpis.memory = data.memory.percent;
            renderKpis();
            renderSystem(data);
        })
        .catch(error => fail('system', error));

    // Deux routes séparées : la liste est instantanée, les stats non.
    Promise.all([get('/containers'), get('/containers/stats')])
        .then(([list, stats]) => renderContainers(list, stats))
        .catch(error => fail('containers', error));
}

renderKpis();
refresh();
setInterval(refresh, REFRESH_MS);
