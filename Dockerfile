# Etapa de build
FROM node:20-alpine AS build
WORKDIR /app

# Variables que Nuxt baked en el bundle de Nitro al compilar.
# nuxt.config.ts las lee con process.env, por eso deben existir en build-time.
ARG NUXT_PUBLIC_API_BASE
ARG NUXT_API_PROXY_TARGET
ENV NUXT_PUBLIC_API_BASE=$NUXT_PUBLIC_API_BASE \
    NUXT_API_PROXY_TARGET=$NUXT_API_PROXY_TARGET

# Cachea dependencias primero (ignora postinstall: nuxt prepare aún no tiene fuentes)
COPY package*.json ./
RUN npm install --ignore-scripts

# Copia el resto del código y compila para producción
COPY . .
RUN npm run build

# Etapa de runtime (imagen liviana)
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000

# Solo se necesita el output de Nuxt (Nitro server bundle)
COPY --from=build /app/.output ./.output

# Usuario no-root por seguridad
RUN addgroup -S nuxt && adduser -S nuxt -G nuxt \
    && chown -R nuxt:nuxt /app
USER nuxt

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
