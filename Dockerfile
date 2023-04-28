FROM node:alpine AS build
COPY web /workspace/web
WORKDIR /workspace
COPY --from=deno /workspace/flora.json /workspace/flora.json
RUN cd web && yarn && yarn build

FROM node:alpine
ENV NODE_ENV=production
ENV HOST 0.0.0.0
EXPOSE 3000
COPY --from=build /workspace/web /workspace/web
WORKDIR /workspace/web
CMD node dist/server/entry.mjs