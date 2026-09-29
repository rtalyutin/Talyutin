FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs db.mjs pg-db.mjs seed-works.mjs ./
COPY public ./public
ENV NODE_ENV=production PORT=4173 REQUIRE_DATABASE_URL=1
EXPOSE 4173
CMD ["node", "server.mjs"]
