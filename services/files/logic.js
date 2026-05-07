const url = require('url');
const fs = require('fs');
const path = require('path');

const baseFrontPath = '/front';
const defaultFileIfFolder = "index.html";

const mimeTypes = {
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.md': 'text/plain',
    'default': 'application/octet-stream'
};

const routes = {
    '/': '/index.html',
    '/play/local': '/pages/game/game.html',
};

function manageRequest(request, response) {
    const pathname = url.parse(request.url).pathname;

    // On vérifie que c'est bien /profile/{username} et pas un fichier statique (.js, .css...)
    // const isProfileRoute = pathname.startsWith('/pages/profile/') && !path.extname(pathname);

    // if (isProfileRoute) {
    //     const filePath = './front/pages/profile/index.html';
    //     fs.readFile(filePath, (err, data) => {
    //         if (err) { send404(filePath, response); return; }
    //         response.setHeader('Content-type', 'text/html');
    //         response.end(data);
    //     });
    //     return;
    // }

    const isGameReviewRoute = pathname.startsWith('/pages/game/review') && !path.extname(pathname);

    if (isGameReviewRoute) {
        const filePath = './front/pages/game/review/index.html';
        fs.readFile(filePath, (err, data) => {
            if (err) { send404(filePath, response); return; }
            response.setHeader('Content-type', 'text/html');
            response.end(data);
        });
        return;
    }



    const parsedUrl = url.parse(baseFrontPath + request.url);
    let pathName = `.${parsedUrl.pathname}`;

    if (pathName === "./front/" 
        || pathName === "./front/pages/home/play" 
        || pathName === "./front/pages/home/shop" 
        || pathName === "./front/pages/home/social") {
        pathName = "./front/pages/home/";
    }

    let extension = path.parse(pathName).ext;

    fs.exists(pathName, async function (exist) {
        if (!exist) {
            send404(pathName, response);
            return;
        }

        if (fs.statSync(pathName).isDirectory()) {
            pathName += `/${defaultFileIfFolder}`;
            extension = `.${defaultFileIfFolder.split(".")[1]}`;
        }

        fs.readFile(pathName, function (error, data) {
            if (error) {
                console.log(`Error getting the file: ${pathName}: ${error}`);
                send404(pathName, response);
            } else {
                response.setHeader('Content-type', mimeTypes[extension] || mimeTypes['default']);
                response.end(data);
            }
        });
    });
}

function send404(path, response) {
    response.statusCode = 404;
    response.end(`File ${path} not found!`);
}

exports.manage = manageRequest;