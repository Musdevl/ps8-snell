FROM node:22.18-slim

WORKDIR /app

COPY helpers ./helpers
WORKDIR /app/AI
COPY AI/package*.json ./

RUN npm install

COPY AI/ .


EXPOSE 8020
CMD ["node", "index.js"]