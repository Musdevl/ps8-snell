FROM node:22.18-slim

WORKDIR /app

COPY helpers ./helpers
WORKDIR /app/achievement
COPY achievement/package*.json ./

RUN npm install

COPY achievement/ .

EXPOSE 8004
CMD ["node", "index.js"]