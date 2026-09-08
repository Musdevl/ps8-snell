FROM node:22.18-slim

WORKDIR /app

COPY helpers ./helpers
WORKDIR /app/admin
COPY admin/package*.json ./

RUN npm install

COPY admin/ .

EXPOSE 8007
ENTRYPOINT ["bash", "/app/helpers/entrypoint.sh"]
CMD ["node", "index.js"]
