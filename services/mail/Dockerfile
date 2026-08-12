FROM node:22.18-slim

WORKDIR /app/mail
COPY mail/package*.json ./

RUN npm install

COPY mail/ .

EXPOSE 8006
CMD ["node", "index.js"]
