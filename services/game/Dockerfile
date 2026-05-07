FROM node:22.18-slim

WORKDIR /app

COPY helpers ./helpers
WORKDIR /app/game
COPY game/package*.json ./

RUN npm install

COPY game/ .

EXPOSE 8002
CMD ["node", "src/index.js"]