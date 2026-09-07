FROM node:22.18-slim

WORKDIR /app

COPY helpers ./helpers
WORKDIR /app/ai
COPY ai/package*.json ./

RUN npm install

COPY ai/ .


EXPOSE 8020
ENTRYPOINT ["bash", "/app/helpers/entrypoint.sh"]
CMD ["node", "index.js"]