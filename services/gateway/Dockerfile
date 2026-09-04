FROM node:22.18-slim

WORKDIR /app

COPY helpers ./helpers
WORKDIR /app/gateway
COPY gateway/package*.json ./

RUN npm install

COPY gateway/ .

EXPOSE 8000

ENTRYPOINT ["bash", "/app/helpers/entrypoint.sh"]
CMD ["node", "index.js"]