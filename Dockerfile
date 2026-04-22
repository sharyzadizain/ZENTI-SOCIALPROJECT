# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22-bookworm-slim

FROM node:${NODE_VERSION} AS base
ENV npm_config_audit=false \
    npm_config_fund=false \
    npm_config_update_notifier=false
WORKDIR /app

FROM base AS backend-deps
ENV NODE_ENV=development
WORKDIR /app/back
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ pkg-config \
    && rm -rf /var/lib/apt/lists/*
COPY back/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci || npm install

FROM backend-deps AS backend-build
COPY back/ ./
RUN npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force

FROM base AS frontend-deps
ENV NODE_ENV=development
WORKDIR /app/frontend
COPY my-nuxtor-app/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts || npm install --ignore-scripts

FROM frontend-deps AS frontend-build
ARG NUXT_PUBLIC_STRAPI_URL=http://localhost:1337
ENV NUXT_PUBLIC_STRAPI_URL=${NUXT_PUBLIC_STRAPI_URL}
COPY my-nuxtor-app/ ./
RUN npm run postinstall \
    && npm run build \
    && npm cache clean --force

FROM base AS production
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=1337 \
    DATABASE_CLIENT=sqlite \
    DATABASE_FILENAME=.tmp/data.db \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000 \
    NUXT_BACK_SQLITE_PATH=/app/back/.tmp/data.db \
    NUXT_PUBLIC_STRAPI_URL=http://localhost:1337

WORKDIR /app
RUN mkdir -p /app/back/.tmp /app/frontend \
    && chown -R node:node /app

COPY --from=backend-build --chown=node:node /app/back /app/back
COPY --from=frontend-build --chown=node:node /app/frontend/.output /app/frontend/.output
COPY --from=frontend-build --chown=node:node /app/frontend/package.json /app/frontend/package.json

USER node
EXPOSE 1337 3000
VOLUME ["/app/back/.tmp", "/app/back/public/uploads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD ["node", "-e", "const http=require('node:http');const backendPort=process.env.PORT||1337;const frontendPort=process.env.NITRO_PORT||3000;const urls=['http://127.0.0.1:'+backendPort+'/','http://127.0.0.1:'+frontendPort+'/'];let left=urls.length;const fail=()=>process.exit(1);for(const url of urls){const req=http.get(url,res=>{const ok=res.statusCode<500;res.resume();if(!ok)fail();if(--left===0)process.exit(0);});req.on('error',fail);req.setTimeout(3000,()=>{req.destroy();fail();});}"]

CMD ["sh", "-c", "case \"${DATABASE_CLIENT:-sqlite}:${DATABASE_FILENAME:-}\" in sqlite:|sqlite:/*) export DATABASE_FILENAME=.tmp/data.db ;; esac; case \"${NUXT_BACK_SQLITE_PATH:-}\" in ''|'../back/.tmp/data.db') export NUXT_BACK_SQLITE_PATH=/app/back/.tmp/data.db ;; esac; cd /app/back && npm run start & backend_pid=$!; node /app/frontend/.output/server/index.mjs & frontend_pid=$!; trap 'kill $backend_pid $frontend_pid 2>/dev/null || true' INT TERM; while true; do if ! kill -0 $backend_pid 2>/dev/null; then wait $backend_pid; exit $?; fi; if ! kill -0 $frontend_pid 2>/dev/null; then wait $frontend_pid; exit $?; fi; sleep 2; done"]
