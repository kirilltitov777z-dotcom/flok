FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV DATA_FILE=/data/flok.json

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY web ./web
COPY server ./server

RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8787

CMD ["node", "server/server.js"]
