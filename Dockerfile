FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_COURT_API_URL
ENV VITE_COURT_API_URL=$VITE_COURT_API_URL
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787 COURT_DATA_FILE=/data/rooms.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
RUN mkdir /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "server/index.mjs"]
