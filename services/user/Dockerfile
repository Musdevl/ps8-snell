FROM node:22.18-slim

WORKDIR /app

COPY helpers ./helpers
WORKDIR /app/user
COPY user/package*.json ./

RUN npm install

COPY user/ .

EXPOSE 8010
CMD ["node", "index.js"]