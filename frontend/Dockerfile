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
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- Production Build ----
FROM base AS build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm ci
COPY . .
RUN npm run build

# ---- Production (serve with nginx) ----
FROM nginx:1.29.5-alpine3.23-slim AS production
# Pin zlib to fix CVE: Out-of-bounds Write + Improper Validation (zlib < 1.3.2-r0)
RUN apk add --no-cache 'zlib=1.3.2-r0'
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8081
CMD ["nginx", "-g", "daemon off;"]
