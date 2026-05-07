import * as shopApi from "./api/shopApi.js"

const PORT = 8005;
const server = shopApi.startHttpServer(PORT);
