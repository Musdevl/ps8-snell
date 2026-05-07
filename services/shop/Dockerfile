FROM node:22.18-slim

WORKDIR /app

COPY helpers ./helpers
WORKDIR /app/shop
COPY shop/package*.json ./

RUN npm install

COPY shop/ .


EXPOSE 8005
CMD ["node", "index.js"]