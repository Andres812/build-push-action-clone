# syntax=docker/dockerfile:1
# Define la versión de la sintaxis del Dockerfile

FROM debian
# Especifica la imagen base del contenedor
# Debian es una distribución de Linux más completa y estable

RUN echo "Hello debian!"
# Ejecuta un comando durante la construcción de la imagen
# Imprime el mensaje "Hello debian!" en la consola