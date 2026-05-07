import * as achievementApi from "./api/achievementApi.js"

const PORT = 8004;
const server = achievementApi.startHttpServer(PORT);
