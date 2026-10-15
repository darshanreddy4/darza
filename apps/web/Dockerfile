# Build:  docker build -t shop-web --build-arg NEXT_PUBLIC_API_URL=https://api.example.com --build-arg NEXT_PUBLIC_SITE_URL=https://www.example.com apps/web
# The NEXT_PUBLIC_* values are written into the pages when they are built, so rebuild the image if they change.
FROM node:22-bookworm-slim AS build
# Only for networks that inspect https traffic with their own certificate: --build-arg NODE_TLS_REJECT_UNAUTHORIZED=0 --build-arg NPM_CONFIG_STRICT_SSL=false
ARG NODE_TLS_REJECT_UNAUTHORIZED
ARG NPM_CONFIG_STRICT_SSL
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BUSINESS_NAME
ARG NEXT_PUBLIC_LEGAL_NAME
ARG NEXT_PUBLIC_SUPPORT_EMAIL
ARG NEXT_PUBLIC_SUPPORT_PHONE
ARG NEXT_PUBLIC_BUSINESS_ADDRESS
ARG NEXT_PUBLIC_GSTIN
ARG NEXT_PUBLIC_GRIEVANCE_OFFICER
ARG NEXT_PUBLIC_GRIEVANCE_EMAIL
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
