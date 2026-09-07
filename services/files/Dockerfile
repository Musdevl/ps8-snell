FROM node:22.18-slim

WORKDIR /app

COPY helpers ./helpers
WORKDIR /app/files
COPY files/package*.json ./

RUN npm install

COPY files/ .


EXPOSE 8001

ENTRYPOINT ["bash", "/app/helpers/entrypoint.sh"]
CMD ["node", "index.js"]