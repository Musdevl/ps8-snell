FROM node:22.18-slim

WORKDIR /app
COPY helpers ./helpers

WORKDIR /app/mail
COPY mail/package*.json ./

RUN npm install

COPY mail/ .

EXPOSE 8006
ENTRYPOINT ["bash", "/app/helpers/entrypoint.sh"]
CMD ["node", "index.js"]
