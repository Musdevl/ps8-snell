import * as adminApi from "./api/adminApi.js"

const PORT = 8007;
const server = adminApi.startHttpServer(PORT);
