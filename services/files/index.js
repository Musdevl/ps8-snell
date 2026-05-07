const http = require('http');

const fileQuery = require('./logic.js');

const PORT = 8001;

http.createServer(function (request, response) {
  fileQuery.manage(request, response);
// For the server to be listening to request, it needs a port, which is set thanks to the listen function.
}).listen(PORT, () => console.log(`File service listening on port ${PORT}!`));