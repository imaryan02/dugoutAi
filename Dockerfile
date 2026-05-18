FROM node:22-slim AS build

WORKDIR /app

COPY package*.json ./
COPY apps/server/package*.json apps/server/
COPY apps/web/package*.json apps/web/
COPY packages/agents/package*.json packages/agents/
COPY packages/cricket/package*.json packages/cricket/
COPY packages/shared/package*.json packages/shared/

RUN npm ci

COPY . .

ENV VITE_SERVER_URL=
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages

CMD ["npm", "run", "start", "--workspace", "apps/server"]
