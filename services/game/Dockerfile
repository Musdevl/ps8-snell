FROM node:22.18-slim

WORKDIR /app

COPY helpers ./helpers
WORKDIR /app/game
COPY game/package*.json ./

RUN npm install

COPY game/ .

EXPOSE 8002
ENTRYPOINT ["bash", "/app/helpers/entrypoint.sh"]
CMD ["node", "src/index.js"]