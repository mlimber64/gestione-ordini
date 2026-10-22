# Immagine del frontend: build Angular e poi nginx che serve i file statici e instrada /api ai servizi.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.30-alpine
# openssl serve solo allo script che crea il certificato autofirmato all'avvio
RUN apk add --no-cache openssl
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY app.conf /etc/nginx/snippets/app.conf
COPY --chmod=755 40-certificato.sh /docker-entrypoint.d/40-certificato.sh
COPY --from=build /app/dist/web/browser /usr/share/nginx/html
EXPOSE 80 443
