# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22-bookworm-slim

FROM node:${NODE_VERSION} AS base
ENV npm_config_audit=false \
    npm_config_fund=false \
    npm_config_update_notifier=false
WORKDIR /app

FROM base AS deps
ENV NODE_ENV=development
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ pkg-config \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci || npm install

FROM deps AS build
COPY . ./
RUN npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force

FROM base AS production
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=1337 \
    DATABASE_CLIENT=sqlite \
    DATABASE_FILENAME=.tmp/data.db

RUN mkdir -p /app/.tmp /app/public/uploads \
    && chown -R node:node /app

COPY --from=build --chown=node:node /app ./

USER node
EXPOSE 1337
VOLUME ["/app/.tmp", "/app/public/uploads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 CMD ["node", "-e", "const http=require('node:http');const port=process.env.PORT||1337;const req=http.get('http://127.0.0.1:'+port+'/',res=>{const ok=res.statusCode<500;res.resume();process.exit(ok?0:1);});req.on('error',()=>process.exit(1));req.setTimeout(3000,()=>{req.destroy();process.exit(1);});"]

CMD ["sh", "-c", "case \"${DATABASE_CLIENT:-sqlite}:${DATABASE_FILENAME:-}\" in sqlite:|sqlite:/*) export DATABASE_FILENAME=.tmp/data.db ;; esac; npm run start"]
