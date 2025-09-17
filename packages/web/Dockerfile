FROM node:slim AS base

WORKDIR /app

RUN apt-get update \
  && apt-get install -y \
  build-essential \
  curl \
  python3 \
  python3-dev \
  unzip \
  && rm -rf /var/lib/apt/lists/* \
  && apt-get clean

COPY package*.json ./
RUN npm install --legacy-peer-deps --frozen-lockfile

COPY . /app
RUN npm run build


FROM node:slim AS runner

WORKDIR /app

COPY --from=base /app/package*.json ./
COPY --from=base /app/node_modules /app/node_modules
COPY --from=base /app/dist /app/dist

EXPOSE 4321/tcp

ENTRYPOINT [ "sh", "-c", "node dist/server/entry.mjs" ]