# Ubuntu 24.04 com tudo o que a Vitrola para Linux usa, mais Xvfb e D-Bus
# para rodar o app sem tela. Usado por linux/test/smoke.sh.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        gjs \
        gir1.2-gtk-4.0 \
        gir1.2-webkit-6.0 \
        gstreamer1.0-plugins-good \
        gstreamer1.0-plugins-bad \
        gstreamer1.0-libav \
        pulseaudio-utils \
        xvfb \
        xauth \
        dbus-x11 \
        fonts-dejavu-core \
        libglib2.0-bin \
        playerctl \
        pulseaudio \
        imagemagick \
        adwaita-icon-theme \
        xdotool \
    && rm -rf /var/lib/apt/lists/*

# Sem GPU no contêiner: desenho por software. O sandbox do WebKit (bubblewrap) não
# roda dentro do Docker, então só aqui, no ambiente de teste, ele fica desligado.
ENV GSK_RENDERER=cairo \
    GTK_A11Y=none \
    LIBGL_ALWAYS_SOFTWARE=1 \
    WEBKIT_DISABLE_DMABUF_RENDERER=1 \
    WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1

WORKDIR /vitrola
