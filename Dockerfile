FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data
COPY package*.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev -w server
COPY server server
COPY --from=build /app/client/dist client/dist
VOLUME /data
EXPOSE 8080
CMD ["node", "server/src/index.js"]
