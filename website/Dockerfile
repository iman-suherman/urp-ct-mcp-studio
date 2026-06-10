FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_REGISTRY_API_URL=https://ct-mcp-registry.suherman.net
ARG NEXT_PUBLIC_PLUGIN_ID=ct-mcp-studio
ARG NEXT_PUBLIC_DOWNLOAD_BASE_URL=https://storage.googleapis.com/personal-suherman-ct-mcp-studio/extensions
ENV NEXT_PUBLIC_REGISTRY_API_URL=$NEXT_PUBLIC_REGISTRY_API_URL
ENV NEXT_PUBLIC_PLUGIN_ID=$NEXT_PUBLIC_PLUGIN_ID
ENV NEXT_PUBLIC_DOWNLOAD_BASE_URL=$NEXT_PUBLIC_DOWNLOAD_BASE_URL

RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 8080
CMD ["node", "server.js"]
