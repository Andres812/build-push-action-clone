# syntax=docker/dockerfile:1
# Define la versión de la sintaxis del Dockerfile

FROM alpine
# Especifica la imagen base del contenedor
# Alpine es una distribución Linux ligera y eficiente

RUN cat /etc/*release
# Ejecuta un comando durante la construcción de la imagen
# Muestra el contenido de los archivos que contienen información de la versión del sistema