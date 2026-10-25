# Single-container deploy: the boardgame.io server serves the built client on
# one origin (OBK_STATIC_DIR) and keeps matches on a volume (OBK_DB_DIR).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx vite build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8000 OBK_STATIC_DIR=/app/dist OBK_DB_DIR=/data
# vite-node (a dev dependency) runs the TypeScript server directly, as `npm run serve` does.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json tsconfig.json ./
COPY src ./src
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 8000
VOLUME /data
CMD ["npx", "vite-node", "src/server/index.ts"]
