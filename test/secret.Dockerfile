# syntax=docker/dockerfile:1
# Define la versión de la sintaxis del Dockerfile

FROM busybox
# Usa BusyBox como imagen base (ligera)

RUN --mount=type=secret,id=MYSECRET \
  echo "MYSECRET=$(cat /run/secrets/MYSECRET)"
# Usa una característica de Docker BuildKit para montar un secreto
# --mount=type=secret → permite usar información sensible sin guardarla en la imagen
# id=MYSECRET → identifica el secreto que se va a usar
# cat /run/secrets/MYSECRET → accede al contenido del secreto
# echo → imprime el valor del secreto (solo durante el build)