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
RUN curl -fsSL https://bun.sh/install | bash


COPY . /app
RUN $HOME/.bun/bin/bun i
RUN $HOME/.bun/bin/bun run build


FROM oven/bun:alpine AS runner

WORKDIR /app

COPY --from=base /app/package.json /app/bun.lock /app/
COPY --from=base /app/dist /app/dist

EXPOSE 4321/tcp

ENTRYPOINT [ "sh", "-c", "bun install && bun run dist/server/entry.mjs" ]