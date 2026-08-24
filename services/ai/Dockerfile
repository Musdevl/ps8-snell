FROM node:22.18-slim

WORKDIR /app

COPY helpers ./helpers
WORKDIR /app/ai
COPY ai/package*.json ./

RUN npm install

COPY ai/ .


EXPOSE 8020
CMD ["node", "index.js"]