# ⚡ Snell

> A multiplayer web reimagination of the board game **Khet**

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Services](#services)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Game Modes](#game-modes)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Contributors](#contributors)
- [License](#license)

---

## Overview

**Snell** is a full-stack, microservice-based online game platform built around a reimagination of [Khet](https://www.khet.com/), the laser board game. Players move and rotate pieces on a grid, fire laser beams, and try to eliminate the opponent's king.

The platform supports local play, multiplayer matchmaking, AI opponents, game review/replay, an in-game shop (with Stripe integration), achievements, chat, and an Android mobile client via Capacitor.

---

## Architecture

All services communicate through a central **API Gateway** over an internal Docker network. The frontend is served as static files and connects to the gateway via HTTPS.

```
                        ┌─────────────────┐
                        │   API Gateway   │  :8000 (HTTPS)
                        └────────┬────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │            │           │           │             │
   ┌────▼───┐  ┌─────▼──┐ ┌─────▼──┐ ┌─────▼──┐  ┌──────▼────┐
   │  User  │  │  Game  │ │  Chat  │ │  Shop  │  │Achievement│
   │ :8010  │  │ :8002  │ │ :8003  │ │ :8005  │  │  :8004    │
   └────────┘  └────────┘ └────────┘ └────────┘  └───────────┘
        │            │           │           │             │
        └────────────┴───────────┴───────────┴─────────────┘
                                 │
                          ┌──────▼──────┐     ┌─────────┐
                          │   MongoDB   │     │   AI    │
                          └─────────────┘     └─────────┘

   ┌──────────────┐        ┌──────────────┐
   │  Files (CDN) │        │     Mail     │  Called by User only, never routed
   └──────────────┘        │    :8006     │  through the gateway
   Static frontend +       └──────┬───────┘
   Android (Capacitor)            │
                             SMTP (Gmail)
```

---

## Services

| Service | Technology | Port | Description |
|---|---|---|---|
| `gateway` | Node.js / Express | `8000` | API Gateway, auth middleware, TLS termination (off by default) |
| `game` | Node.js / Socket.IO | `8002` | Game engine, matchmaking, AI, real-time state |
| `user` | Node.js / Express | `8010` | Auth, profiles, friends, Stripe payments |
| `files` | Node.js / Express | `8001` | Static frontend serving + Capacitor Android app |
| `chat` | Node.js / Socket.IO | `8003` | Global, game, and friend chat |
| `achievement` | Node.js / Express | `8004` | In-game achievement tracking |
| `shop` | Node.js / Express | `8005` | Themes, emotes, profile pictures |
| `ai` | Node.js | — | Heuristic AI opponent engine |
| `mail` | Node.js / Nodemailer | `8006` | Transactional emails (welcome, password reset) |
| `mongodb` | MongoDB | `27017` | Shared NoSQL database |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/) ≥ 2.20
- (For Stripe) A valid Stripe secret key

The stack runs from a single `docker-compose.yml`, shared between dev and prod.
What changes between environments is only the `.env` file loaded — see below.

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd ps8-26-snell/services
```

### 2. Configure your `.env`

Copy `.env.example` to `.env` and adjust the values:

```dotenv
ENV="dev"                        # "dev" or "prod"
STRIPE_SECRET_KEY="sk_test_..."
PUBLIC_URL="http://localhost:8000"
```

| Variable | Description |
|---|---|
| `ENV` | `dev` or `prod`. In `prod`, the gateway mounts and reads HTTPS certificates from `../../secrets/https`. In `dev`, that volume is mounted but ignored. |
| `PUBLIC_URL` | The URL written into the frontend and used by clients (including emails sent by `user`). **This URL runs in the visitor's browser** — if it points at `localhost` on a real deployment, every API call goes to the visitor's own machine and nothing works. |
| `STRIPE_SECRET_KEY` | Stripe secret key, forwarded to the `user` service. |

### 3. Launch the stack

```bash
./launch.sh
```

This script:
1. Reads `PUBLIC_URL` from your `.env` (or from an already-exported `PUBLIC_URL`, which takes priority — a warning is printed if so).
2. Regenerates `files/front/env.js` and `user/env.js` with that URL (these are plain JS files read directly by the browser, not part of any bundler build).
3. Exports `ENV` and `PUBLIC_URL` so Docker Compose can substitute them into `docker-compose.yml`.
4. Creates the external `proxy` Docker network if it doesn't already exist.
5. Runs `docker compose up`.

**Flags:**

| Flag | Effect |
|---|---|
| *(none)* | Prod mode, `.env` next to the script, no rebuild (`docker compose up -d`) |
| `--dev` | Dev mode |
| `--prod` | Prod mode (default, explicit) |
| `--build` | Rebuilds images (`docker compose up --build`), runs attached |
| `--env="path"` | Loads a custom `.env` file instead of the default one |

**Examples:**

```bash
./launch.sh                                # prod, no rebuild, detached
./launch.sh --build                        # prod, rebuild, attached (see logs)
./launch.sh --dev --build                  # dev, rebuild, attached
./launch.sh --dev --env=".env.dev"         # dev, using a specific .env file
```

> ⚠️ Without `--build`, the stack starts detached (`-d`) from whatever images
> already exist locally. Use `--build` after any code change.

### 4. Stop / restart / reset the stack

```bash
./stop-dockers.sh
```

| Flags | Effect |
|---|---|
| *(none)* | `docker compose down` — stops and removes containers, keeps volumes (DB data preserved) |
| `--restart` | Restarts existing containers in place (`docker compose restart`) |
| `--restart --build` | `docker compose down` then `docker compose up --build -d` |
| `--reset` | `docker compose down -v` — **removes containers AND volumes** (database wiped), does **not** restart anything |
| `--reset --restart` | `docker compose down -v` then `docker compose up -d` |
| `--reset --restart --build` | `docker compose down -v` then `docker compose up --build -d` |

`--reset` on its own only tears everything down — nothing comes back up until
`--restart` is also passed. This lets you wipe the database without immediately
relaunching the stack.

---

## Game Modes

| Mode | Description |
|---|---|
| **Local** | Two players on the same browser |
| **Multiplayer** | Real-time online matchmaking |
| **vs AI** | Play against the heuristic AI engine |
| **Tutorial** | Step-by-step introduction to the game rules |
| **Review** | Replay and analyze a past game move by move |

### How to play

Snell is based on Khet — a laser chess variant. Each player controls a set of pieces on a grid:

- **King** — must be protected at all costs
- **Shooter** — deflects lasers in one direction
- **Triangle** — deflects the laser 90°
- **Protector** — absorbs lasers on one side
- **Full Mirror** — deflects on both sides

On your turn, move or rotate a piece, then fire your laser. If the laser hits an unprotected side of a piece, it is eliminated. The player who eliminates the opponent's king wins.

---

## Project Structure

```
services/
├── gateway/        # API Gateway & auth middleware
├── game/           # Game engine, matchmaking, AI, tutorial
├── user/           # User accounts, friends, Stripe shop
├── files/          # Static frontend (HTML/CSS/JS) + Android
├── chat/           # Chat rooms (global, game, friend)
├── achievement/    # Achievement system
├── shop/           # In-game store (themes, emotes, avatars)
├── ai/             # Heuristic AI (snell_heuristique.js)
├── mail/           # Transactional emails (welcome, password reset)
├── helpers/        # Shared utilities (CORS, env, express helpers)
├── docker-compose.yml       # dev by default: `docker compose up`
├── docker-compose-dev.yml
├── docker-compose-prod.yml
└── compose-prod.sh
```

### Frontend (`files/front/`)

The frontend is a vanilla HTML/CSS/JS SPA organized by pages and components:

- `pages/` — auth, home, game modes, profile, shop
- `components/` — board renderer, chat, player info, notifications, social bar
- `assets/` — themes (default, red&blue, bizot&deyann), sounds, emotes, piece sprites

### Game Engine (`game/src/`)

- `service/` — BoardService, LaserService, PieceService, GameService, AI
- `model/` — Board, Game, Player
- `manager/` — GameManager (real-time), MatchmakingManager
- `initializer/` — Board and player setup

---

## Testing

Unit tests are available in the game service:

```bash
cd services/game
node src/test/TestRunner.js
```

Tests cover:

- Triangle piece movement and reflections
- Action serialization / deserialization
- Board service logic

---

## Contributors

| Name | GitHub |
|---|---|
| Driss | [@MkDriss](https://github.com/MkDriss) |
| Cyril | [@Musdevl](https://github.com/Musdevl) |

---

## License

This project is licensed under the terms of the [LICENSE](./LICENSE) file included in this repository.