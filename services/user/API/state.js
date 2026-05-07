export const userId_socketId_Map = new Map();
export const socketId_userId_Map = new Map();
export let ioClient = null;
export const setIoClient = (client) => { ioClient = client; };