FROM node:22.18-slim

WORKDIR /app

COPY helpers ./helpers
WORKDIR /app/gateway
COPY gateway/package*.json ./

RUN npm install

COPY gateway/ .

EXPOSE 8000
CMD ["node", "index.js"]