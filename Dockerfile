FROM node@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e AS build

WORKDIR /src
RUN corepack enable
RUN corepack prepare pnpm@10.32.1 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ARG DEMO_BASE_PATH=/
ENV DEMO_BASE_PATH=$DEMO_BASE_PATH
RUN pnpm build:demo

FROM nginx@sha256:5b4900b042ccfa8b0a73df622c3a60f2322faeb2be800cbee5aa7b44d241649e

ENV NGINX_ENVSUBST_FILTER='^SHOWCASE_ORIGIN$'

COPY --from=build /src/dist-demo /usr/share/nginx/html
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 8080
