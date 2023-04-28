FROM node:alpine AS build
ARG MONGO_URI
COPY web /workspace/web
WORKDIR /workspace
RUN cd web && yarn && MONGO_URI=$MONGO_URI yarn build

FROM node:alpine
ENV NODE_ENV=production
ENV HOST 0.0.0.0
EXPOSE 3000
COPY --from=build /workspace/web /workspace/web
WORKDIR /workspace/web
CMD node dist/server/entry.mjs