FROM denoland/deno AS deno
ENV TEMPDIR /workspace/temp
ENV DWCA_URL "https://ipt.jbrj.gov.br/jbrj/archive.do?r=lista_especies_flora_brasil&v=393.372"
COPY src /workspace/src
WORKDIR /workspace
RUN mkdir temp
RUN mkdir .temp
RUN apt update
RUN apt install -y unzip
RUN deno run -A src/index.ts ${DWCA_URL}

FROM node:alpine AS node
COPY web /workspace/web
WORKDIR /workspace
RUN cd web && yarn && yarn build

FROM node:alpine
ENV NODE_ENV=production
ENV HOST 0.0.0.0
EXPOSE 3000
COPY --from=deno /workspace/flora.json /workspace/flora.json
COPY --from=node /workspace/web /workspace/web
WORKDIR /workspace/web
CMD node dist/server/entry.mjs