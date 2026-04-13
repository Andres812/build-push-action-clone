# syntax=docker/dockerfile:1
# Define la versión de la sintaxis del Dockerfile

FROM alpine
# Usa Alpine como imagen base (ligera y eficiente)

RUN apk add --no-cache curl net-tools
# Instala herramientas necesarias:
# curl → para hacer solicitudes HTTP
# net-tools → incluye comandos como netstat

ARG HTTP_PROXY
ARG HTTPS_PROXY
# Define variables de argumento para proxies (se pasan al construir la imagen)

RUN printenv HTTP_PROXY
# Muestra el valor de la variable HTTP_PROXY

RUN printenv HTTPS_PROXY
# Muestra el valor de la variable HTTPS_PROXY

RUN netstat -aptn
# Muestra conexiones de red activas y puertos en uso dentro del contenedor

RUN curl --retry 5 --retry-all-errors --retry-delay 0 --connect-timeout 5 \
    --proxy $HTTP_PROXY -v --insecure --head https://www.google.com
# Realiza una petición HTTP a Google usando curl:
# --retry 5 → reintenta hasta 5 veces si falla
# --retry-all-errors → reintenta ante cualquier error
# --retry-delay 0 → sin espera entre intentos
# --connect-timeout 5 → timeout de conexión de 5 segundos
# --proxy → usa el proxy definido
# -v → modo verbose (detallado)
# --insecure → ignora errores de certificados SSL
# --head → solo obtiene encabezados de la respuesta