# syntax=docker/dockerfile:1
# Define la versión de la sintaxis de Dockerfile que se va a usar

FROM busybox
# Indica la imagen base que se utilizará para construir el contenedor
# En este caso se usa "busybox", una imagen ligera con herramientas básicas de Linux

RUN cat /etc/hosts
# Ejecuta un comando dentro del contenedor durante el proceso de construcción
# Este comando muestra el contenido del archivo /etc/hosts