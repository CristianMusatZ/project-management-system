# ---- Base ----
FROM node:20-alpine AS base
# Pin zlib to fix CVE: Out-of-bounds Write + Improper Validation (zlib < 1.3.2-r0)
RUN apk add --no-cache 'zlib=1.3.2-r0'
WORKDIR /app
COPY package*.json ./

# ---- Development ----
FROM base AS development
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

# ---- Production Build ----
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# ---- Production ----
FROM node:20-alpine AS production
# Pin zlib to fix CVE: Out-of-bounds Write + Improper Validation (zlib < 1.3.2-r0)
RUN apk add --no-cache 'zlib=1.3.2-r0'
WORKDIR /app
COPY --from=build /app/package*.json ./
RUN npm ci --only=production
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
EXPOSE 4000
USER node
CMD ["node", "dist/index.js"]
