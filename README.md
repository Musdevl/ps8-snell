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

   ┌──────────────┐
   │  Files (CDN) │  Static frontend + Android (Capacitor)
   └──────────────┘
```

---

## Services

| Service | Technology | Port | Description |
|---|---|---|---|
| `gateway` | Node.js / Express | `8000` | API Gateway, auth middleware, HTTPS termination |
| `game` | Node.js / Socket.IO | `8002` | Game engine, matchmaking, AI, real-time state |
| `user` | Node.js / Express | `8010` | Auth, profiles, friends, Stripe payments |
| `files` | Node.js / Express | `8001` | Static frontend serving + Capacitor Android app |
| `chat` | Node.js / Socket.IO | `8003` | Global, game, and friend chat |
| `achievement` | Node.js / Express | `8004` | In-game achievement tracking |
| `shop` | Node.js / Express | `8005` | Themes, emotes, profile pictures |
| `ai` | Node.js | — | Heuristic AI opponent engine |
| `mongodb` | MongoDB | `27017` | Shared NoSQL database |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/) ≥ 2.x
- (For production/AWS) SSL certificates in `../../secrets/https`
- (For Stripe) A valid Stripe secret key

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd ps8-26-snell/services
```

### 2. Local development

```bash
./launch-dev-mode.sh
```

Or manually with the dev compose file:

```bash
./local_env_updater.sh
docker compose -f docker-compose-dev.yml up --build
```

### 3. Production / AWS deployment

```bash
./compose-prod.sh
```

This will update environment variables for AWS, build all images, and start the stack in detached mode.

### 4. Reset the database

```bash
./restart_db.sh
```

### 5. Stop all containers

```bash
./shutdown-dockers.sh
```

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
├── helpers/        # Shared utilities (CORS, env, express helpers)
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