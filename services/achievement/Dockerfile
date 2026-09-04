FROM node:22.18-slim

WORKDIR /app

COPY helpers ./helpers
WORKDIR /app/achievement
COPY achievement/package*.json ./

RUN npm install

COPY achievement/ .
COPY achievement/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8004
<<<<<<< HEAD
ENTRYPOINT ["/entrypoint.sh"]
=======

ENTRYPOINT ["bash", "/app/helpers/entrypoint.sh"]
>>>>>>> 5acbf1e (style: backend logs updated)
CMD ["node", "index.js"]