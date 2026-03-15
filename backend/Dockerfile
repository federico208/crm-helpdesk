FROM node:20-alpine AS builder

WORKDIR /app

# OpenSSL needed by Prisma on Alpine
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

RUN npx prisma generate
RUN npm run build

# ─── Production image ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# OpenSSL needed by Prisma on Alpine
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
