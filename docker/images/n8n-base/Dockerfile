# Pinned to a multi-arch index digest (linux/amd64 + linux/arm64) for reproducible builds.
# The tag is the human-readable version; Docker resolves by the digest. Bump the tag and
# digest together when updating the base image.
FROM node:24.18.1-alpine3.24@sha256:f70403e87646dc51b45295f4b8b70cdad0b63d2297c4c9899119b03f7af7a6b3

# Install all dependencies in a single layer to minimize image size
RUN apk add --no-cache busybox-binsh && \
    # Install fonts
    apk --no-cache add --virtual .build-deps-fonts msttcorefonts-installer fontconfig && \
    update-ms-fonts && \
    fc-cache -f && \
    apk del .build-deps-fonts && \
    find /usr/share/fonts/truetype/msttcorefonts/ -type l -exec unlink {} \; && \
    # Install OS dependencies. No blanket `apk upgrade` — it floats the whole
    # world off the Alpine repos at build time and defeats the pinned base;
    # patched bytes come from bumping the pinned base digest instead. openssl
    # omitted: the base already provides the libssl3/libcrypto3 libs Node uses
    # (the openssl CLI binary isn't needed at runtime).
    apk add --no-cache \
        git \
        openssh \
        graphicsmagick \
        tini \
        tzdata \
        ca-certificates \
        libc6-compat && \
    # Cleanup
    rm -rf /tmp/* /root/.npm /root/.cache/node /opt/yarn* && \
    apk del apk-tools

WORKDIR /home/node
# This base image installs global npm modules under /usr/local; set NODE_PATH
# so packages added via `npm install -g` are require()-able at runtime.
ENV NODE_PATH=/usr/local/lib/node_modules
EXPOSE 5678/tcp
