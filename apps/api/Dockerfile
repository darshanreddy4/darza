# Build:  docker build -t shop-api apps/api
FROM node:22-bookworm-slim AS build
# Only for networks that inspect https traffic with their own certificate: --build-arg NODE_TLS_REJECT_UNAUTHORIZED=0 --build-arg NPM_CONFIG_STRICT_SSL=false
ARG NODE_TLS_REJECT_UNAUTHORIZED
ARG NPM_CONFIG_STRICT_SSL
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim
ARG NODE_TLS_REJECT_UNAUTHORIZED
ARG NPM_CONFIG_STRICT_SSL
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# The Prisma command line is needed at start-up to apply database migrations.
RUN npm ci --omit=dev && npm install --no-save prisma@6.19.3
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
