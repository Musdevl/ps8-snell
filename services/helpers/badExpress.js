import http from 'http';
import url from 'url';


export class badExpress {
    constructor() {
        this.routes = {
            GET: [],
            POST: [],
            PUT: [],
            DELETE: [],
        };
    }

    get(path, handler) {
        this.routes.GET.push({ path, handler });
        return this;
    }

    post(path, handler) {
        this.routes.POST.push({ path, handler });
        return this;
    }

    put(path, handler) {
        this.routes.PUT.push({ path, handler });
        return this;
    }

    delete(path, handler) {
        this.routes.DELETE.push({ path, handler });
        return this;
    }

    async parseBody(request) {
        return new Promise((resolve, reject) => {
            let body = '';
            request.on('data', (chunk) => {
                body += chunk.toString();
            });
            request.on('end', () => {
                resolve(body ? JSON.parse(body) : null);
            });
            request.on('error', (err) => {
                reject(err);
            });
        });
    }

    matchRoute(routePath, requestPath) {
        const routeParts = routePath.split('/').filter(p => p);
        const requestParts = requestPath.split('/').filter(p => p);

        if (routeParts.length !== requestParts.length) {
            return null;
        }

        const params = {};

        for (let i = 0; i < routeParts.length; i++) {
            // Param optionel par exemple /user/{id}
            if (routeParts[i].startsWith('{') && routeParts[i].endsWith('}')) {
                const paramName = routeParts[i].slice(1, -1);
                params[paramName] = requestParts[i];
            }

            // Param classique
            else if (routeParts[i] !== requestParts[i]) {
                return null;
            }
        }
        return params;
    }

    findRoute(method, pathname) {
        const routes = this.routes[method] || [];

        for (const route of routes) {
            const params = this.matchRoute(route.path, pathname);
            if (params !== null) {
                return { handler: route.handler, params };
            }
        }

        return null;
    }

    // Créer l'objet response avec des méthodes utiles
    createResponse(res) {

        res.json = (data, status = 200) => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
        };

        res.text = (text, status = 200) => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'text/plain');
            res.end(String(text));
        };

        res.cookie = (name, value, options = {}) => {
            let cookie = `${name}=${value}`;

            if (options.httpOnly) cookie += '; HttpOnly';
            if (options.secure) cookie += '; Secure';
            if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
            if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
            if (options.path) cookie += `; Path=${options.path}`;
            else cookie += '; Path=/';

            // getHeader pour ne pas écraser un cookie déjà set
            const existing = res.getHeader('Set-Cookie');
            if (existing) {
                res.setHeader('Set-Cookie', [...[].concat(existing), cookie]);
            } else {
                res.setHeader('Set-Cookie', cookie);
            }
        };

        res.clearCookie = (name, options = {}) => {
            let cookie = `${name}=`;

            if (options.httpOnly) cookie += '; HttpOnly';
            if (options.secure) cookie += '; Secure';
            if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
            cookie += '; Max-Age=0';
            if (options.path) cookie += `; Path=${options.path}`;
            else cookie += '; Path=/';

            const existing = res.getHeader('Set-Cookie');
            if (existing) {
                res.setHeader('Set-Cookie', [...[].concat(existing), cookie]);
            } else {
                res.setHeader('Set-Cookie', cookie);
            }
        };


        res.status = (code) => {
            res.statusCode = code;
        };

        return res;
    }

    async handleRequest(req, res) {
        this.createResponse(res);

        const parsedUrl = url.parse(req.url, true); // permet d'activer les query, qu'on utilise apres
        const pathname = parsedUrl.pathname;
        const method = req.method;

        // Set CORS headers to allow all origins
        const origin = req.headers['origin'];
        if (origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        // Handle preflight OPTIONS requests
        if (method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
        }


        req.params = {};
        req.query = parsedUrl.query; // On stocke toutes les query donc tout ce qui est après ? dans une requete

        try {
            if (['POST', 'PUT', 'PATCH'].includes(method)) {
                req.body = await this.parseBody(req);
            }

            const route = this.findRoute(method, pathname);

            if (route) {
                req.params = route.params;
                await route.handler(req, res); // on execute le code qu'on met quand on crée la route
            }
            else {
                res.json({ error: 'Route not found' }, 404)
            }
        }
        catch (error) {
            console.error('Error:', error);
            res.json({ error: 'Internal server error', message: error.message }, 500)
        }
    }

    listen(port, callback) {

        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        this.server.listen(port, () => {
            if (callback) callback();
        });

        return this.server;
    }

    close(callback) {
        if (this.server) {
            this.server.close((err) => {
                if (err) {
                    console.error('Error closing server:', err);
                }
                if (callback) callback(err);
            });
        }
    }


}
