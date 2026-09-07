FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache tini \
  && addgroup -g 1001 -S appgroup \
  && adduser -S appuser -u 1001 -G appgroup

ENV NODE_OPTIONS="--max-old-space-size=512 --enable-source-maps"

ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist

# data/ is the only writable directory at runtime.
RUN mkdir -p /app/data && chown -R appuser:appgroup /app
VOLUME ["/app/data"]

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ready || exit 1

# tini reaps zombies and forwards signals to node — required for graceful
# shutdown under PID 1 (H8). --max-old-space-size is the heap canary (H10).
CMD ["/sbin/tini", "--", "node", "dist/index.js"]