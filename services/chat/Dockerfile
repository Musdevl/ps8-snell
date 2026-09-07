FROM node:22.18-slim

WORKDIR /app

COPY helpers ./helpers
WORKDIR /app/chat
COPY chat/package*.json ./

RUN npm install

COPY chat/ .

EXPOSE 8010

ENTRYPOINT ["bash", "/app/helpers/entrypoint.sh"]
CMD ["node", "index.js"]