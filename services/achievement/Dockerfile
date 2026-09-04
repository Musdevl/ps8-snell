FROM node:22.18-slim

WORKDIR /app

COPY helpers ./helpers
WORKDIR /app/achievement
COPY achievement/package*.json ./

RUN npm install

COPY achievement/ .

EXPOSE 8004

ENTRYPOINT ["bash", "/app/helpers/entrypoint.sh"]
CMD ["node", "index.js"]