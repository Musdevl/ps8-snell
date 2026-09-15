import * as friendChatRepo from './repositories/friend-chat-repository.js';
import * as globalChatRepo from './repositories/global-chat-repository.js';
import * as gameChatRepo from './repositories/game-chat-repository.js';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:8010";
const GAME_SERVICE_URL = process.env.GAME_SERVICE_URL || "http://localhost:8002";

export function addDateToMessage(message) {
    message.date = Date.now();
    return message;
}

export async function postFriendMessage(message) {

    const chat = await friendChatRepo.findChatById(message.chatId);
    if (!chat) throw new Error('Chat not found')

    message.date = Date.now();

    const users = await friendChatRepo.getUsersFromChat(message.chatId);

    try {
        const req = await fetch(`${USER_SERVICE_URL}/api/user/forward-message`, {
            method: "POST",
            body: JSON.stringify({ users, message }),
            headers: { "Content-Type": "application/json" },
        })

        message = await req.json();
        friendChatRepo.addMessageToChat(message.message);
    } catch (error) {
        throw new Error("Failed to send the message");
    }


}

export async function findChatById(chatId) {
    await friendChatRepo.findChatById(message.chatId);
}

export async function postGlobalMessage(message) {
    await globalChatRepo.addMessageToGlobalChat(message);
}

function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accents → e, é → e
        .replace(/[1!]/g, 'i')   // leet speak
        .replace(/[3]/g, 'e')
        .replace(/[4@]/g, 'a')
        .replace(/[0]/g, 'o')
        .replace(/[5]/g, 's')
        .replace(/[7]/g, 't')
        .replace(/[^a-z0-9]+/g, ' ') // tout ce qui n'est pas alphanumérique devient un espace
        .trim();
}


const BANNED_WORDS = [
    // Anglais - insultes courantes
    'fuck', 'fucker', 'fucking', 'motherfucker',
    'shit', 'bullshit',
    'bitch', 'bitches',
    'asshole', 'ass',
    'bastard',
    'damn', 'goddamn',
    'cunt',
    'dick', 'dickhead',
    'cock', 'cocksucker',
    'pussy',
    'whore', 'slut',
    'nigger', 'nigga',
    'faggot', 'fag',
    'retard',
    'idiot', 'moron', 'imbecile',
    'loser', 'noob',
    'ez',

    // Anglais - menaces / harcèlement
    'kys',        // kill yourself
    'kms',        // kill myself
    'die',
    'kill',
    'rape', 'raping',
    'suicide',
    'hang yourself',
    'sex',
    'gay',

    // Français - insultes courantes
    'merde', 'emmerde', 'merdique',
    'putain', 'pute',
    'connard', 'connasse', 'con',
    'salaud', 'salope',
    'batard', 'bâtard',
    'fdp',        // fils de pute
    'ntm',        // nique ta mère
    'tg',         // ta gueule
    'va te faire foutre',
    'enculer', 'enculé',
    'nique', 'niquer',
    'pd',
    'gouine',
    'baltringue',
    'bouffon',
    'tocard',
    'clochard',
    "sexe",

    // Français - menaces
    'je vais te tuer',
    'creve', 'crève',
    'va mourir',

    // Espagnol (fréquent dans les jeux en ligne)
    'puta', 'puto',
    'mierda',
    'cabron', 'cabrón',
    'pendejo',
    'chinga', 'chingada',
    'maricon',
    'culero',
    'hijo de puta',

    // Racisme / discrimination
    'nazi',
    'hitler',
    'kkk',
    'nègre',
    'youpin',
    'bougnoule',
    'raton',
    'feuj',
    'chintoque',
];

// Correspondance par mot entier (\b) pour ne pas bloquer "declarez" à cause de "ez",
// "computer" à cause de "pute", "technique" à cause de "nique", etc.
const BANNED_WORDS_REGEX = new RegExp(`\\b(${BANNED_WORDS.map(normalize).join('|')})\\b`);

export function filterMessage(msg) {
    const clean = normalize(msg.value);
    // Recolle les lettres épelées une par une ("p.u.t.e" → "p u t e" → "pute")
    const unspelled = clean.replace(/\b([a-z0-9]) (?=[a-z0-9]\b)/g, '$1');
    return BANNED_WORDS_REGEX.test(clean) || BANNED_WORDS_REGEX.test(unspelled);
}

export function isAsciiArt(msg) {
    if (msg.value.length > 200) return true;
    const nonAlpha = (msg.value.match(/[^a-zA-Z0-9 ]/g) || []).length;
    return nonAlpha / msg.value.length > 0.4;
}

export function isInvalidMessage(message) {
    return message.kind === "text" && filterMessage(message) || isAsciiArt(message);
}

export async function addMessageToGameChat(gameId, message) {

    await gameChatRepo.addMessageToChat(gameId, message);

    message.date = Date.now();

    await fetch(`${GAME_SERVICE_URL}/api/game/forward-message`, {
        method: "POST",
        body: JSON.stringify({ gameId, message }),
        headers: { 'Content-Type': 'application/json' },
    })
}