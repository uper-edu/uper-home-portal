# Pin the tested Node major/minor. Image availability and Linux execution are checked before deployment.
FROM node:24.19.0-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY runtime ./runtime
COPY web ./web
ENV NODE_ENV=production
USER node
CMD ["node", "runtime/server.mjs"]
