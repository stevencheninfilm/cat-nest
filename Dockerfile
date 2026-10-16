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
COPY --from=build /app/src/feature-unlocks.js ./src/feature-unlocks.js
COPY --from=build /app/src/home-bond.js ./src/home-bond.js
COPY --from=build /app/src/memory-journal.js ./src/memory-journal.js
COPY --from=build /app/src/couple-profile.js ./src/couple-profile.js
COPY --from=build /app/src/couple-care.js ./src/couple-care.js
COPY --from=build /app/src/mage-cat-config.js ./src/mage-cat-config.js
COPY --from=build /app/src/cat-collection.js ./src/cat-collection.js
COPY --from=build /app/src/catbook-reference-cats.js ./src/catbook-reference-cats.js
COPY --from=build /app/src/catbook-scenes.js ./src/catbook-scenes.js
COPY --from=build /app/src/catbook-achievement-sprites.js ./src/catbook-achievement-sprites.js
COPY --from=build /app/src/catbook-game-sprites.js ./src/catbook-game-sprites.js
COPY --from=build /app/src/catbook-reference-sprites.js ./src/catbook-reference-sprites.js
COPY --from=build /app/src/pet-needs.js ./src/pet-needs.js
COPY --from=build /app/src/minigames.js ./src/minigames.js
COPY --from=build /app/src/minigames-local-rules.js ./src/minigames-local-rules.js
COPY --from=build /app/src/minigames-computer.js ./src/minigames-computer.js
COPY --from=build /app/src/minigames-extra.js ./src/minigames-extra.js
COPY --from=build /app/src/minigames-arcade.js ./src/minigames-arcade.js
COPY --from=build /app/src/minigames-arcade-rules.js ./src/minigames-arcade-rules.js
COPY --from=build /app/src/minigames-touch-rules.js ./src/minigames-touch-rules.js
COPY --from=build /app/src/nest-decor.js ./src/nest-decor.js
COPY --from=build /app/src/world-layout.js ./src/world-layout.js
RUN mkdir /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "server/index.mjs"]
