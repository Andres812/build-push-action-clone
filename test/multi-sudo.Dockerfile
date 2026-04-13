# syntax=docker/dockerfile:1
# Define la versión de la sintaxis del Dockerfile

# Etapa 1: build
FROM --platform=$BUILDPLATFORM alpine AS build
# Usa Alpine como imagen base y especifica la plataforma de construcción
# Se le asigna el nombre "build" a esta etapa

ARG TARGETPLATFORM
ARG BUILDPLATFORM
# Define variables que indican:
# - Plataforma destino (donde correrá la imagen)
# - Plataforma de construcción (donde se está construyendo)

RUN echo "I am running on $BUILDPLATFORM, building for $TARGETPLATFORM" > /log
# Crea un archivo /log con información de las plataformas

RUN apk --update --no-cache add \
    shadow \
    sudo \
  && addgroup -g 1200 buildx \
  && adduser -u 1200 -G buildx -s /sbin/nologin -D buildx \
  && echo 'buildx ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers \
  && rm -rf /tmp/* /var/cache/apk/*
# Instala paquetes necesarios (shadow y sudo)
# Crea un grupo y usuario llamado "buildx"
# Da permisos de sudo sin contraseña al usuario
# Limpia archivos temporales para reducir tamaño

USER buildx
# Cambia al usuario "buildx"

RUN sudo chown buildx: /log
# Cambia el propietario del archivo /log

USER root
# Regresa al usuario root

# Etapa 2: imagen final
FROM alpine
# Usa Alpine como imagen final

COPY --from=build /log /log
# Copia el archivo /log desde la etapa "build" a la imagen final

RUN ls -al /log
# Muestra información del archivo /log