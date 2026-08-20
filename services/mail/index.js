import * as mailApi from "./api/mailApi.js"

const PORT = 8006;
const server = mailApi.startHttpServer(PORT);
