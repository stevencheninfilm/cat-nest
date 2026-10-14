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
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/scripts/court-archive.mjs ./scripts/court-archive.mjs
COPY --from=build /app/src/state.js ./src/state.js
COPY --from=build /app/src/pet-needs.js ./src/pet-needs.js
COPY --from=build /app/src/couple-profile.js ./src/couple-profile.js
COPY --from=build /app/src/mage-cat-config.js ./src/mage-cat-config.js
COPY --from=build /app/src/cat-collection.js ./src/cat-collection.js
RUN mkdir /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "server/index.mjs"]
