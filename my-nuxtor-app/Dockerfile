# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22-bookworm-slim

FROM node:${NODE_VERSION} AS base
ENV npm_config_audit=false \
    npm_config_fund=false \
    npm_config_update_notifier=false
WORKDIR /app

FROM base AS deps
ENV NODE_ENV=development
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts || npm install --ignore-scripts

FROM deps AS build
ARG NUXT_PUBLIC_STRAPI_URL=http://localhost:1337
ENV NUXT_PUBLIC_STRAPI_URL=${NUXT_PUBLIC_STRAPI_URL}
COPY . ./
RUN npm run postinstall \
    && npm run build \
    && npm cache clean --force

FROM base AS production
ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000 \
    NUXT_PUBLIC_STRAPI_URL=http://localhost:1337 \
    NUXT_BACK_SQLITE_PATH=/app/back/.tmp/data.db

RUN mkdir -p /app /app/back/.tmp \
    && chown -R node:node /app

COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 3000
VOLUME ["/app/back/.tmp"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "-e", "const http=require('node:http');const port=process.env.NITRO_PORT||3000;const req=http.get('http://127.0.0.1:'+port+'/',res=>{const ok=res.statusCode<500;res.resume();process.exit(ok?0:1);});req.on('error',()=>process.exit(1));req.setTimeout(3000,()=>{req.destroy();process.exit(1);});"]

CMD ["node", ".output/server/index.mjs"]
