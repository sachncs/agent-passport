FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY sdk/package.json ./sdk/

RUN npm install -g pnpm@9.15.0 \
  && pnpm install --frozen-lockfile --ignore-scripts

COPY apps/web ./apps/web
COPY apps/web/tsconfig.json ./apps/web/
RUN pnpm --filter @agent-passport/web run build


FROM nginx:1.27-alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Run as non-root
RUN addgroup -g 1001 -S appgroup \
  && adduser -S appuser -u 1001 -G appgroup \
  && chown -R appuser:appgroup /usr/share/nginx /var/cache/nginx /var/log/nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

USER appuser

CMD ["nginx", "-g", "daemon off;"]