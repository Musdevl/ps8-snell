FROM node:22.18-slim

WORKDIR /app

COPY helpers ./helpers
WORKDIR /app/chat
COPY chat/package*.json ./

RUN npm install

COPY chat/ .

EXPOSE 8010
CMD ["node", "index.js"]