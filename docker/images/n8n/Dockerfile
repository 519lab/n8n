ARG NODE_VERSION=24.22.1
ARG N8N_VERSION=snapshot

# Builder stage exists because the runtime base image has no toolchain.
# Pinned to multi-arch index digest (linux/amd64 + linux/arm64) for reproducible builds.
# Bump the digest together with the tag when updating the base image.
# Digest pins to node:24.22.1-alpine3.24 (Node 24.22.1, Alpine 3.24).
FROM node:24.22.1-alpine3.24@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS builder
COPY ./compiled /usr/local/lib/node_modules/n8n
RUN apk add --no-cache python3 make g++ && \
    cd /usr/local/lib/node_modules/n8n && \
    npm rebuild sqlite3 && \
    # Rebuild isolated-vm from source. node-gyp-build's musl detection relies
    # on /etc/alpine-release which DHI Alpine omits, so the bundled prebuilt
    # loader picks the glibc binary and segfaults in musl pthread paths.
    # Removing prebuilds and invoking node-gyp directly avoids npm rebuild's
    # double-build behavior (built-in node-gyp + install-script node-gyp)
    # which races on dep-file state.
    # Use npm's bundled node-gyp rather than `npx node-gyp` so the toolchain
    # version is fixed by the pinned image digest instead of being fetched
    # from the registry at build time.
    rm -rf node_modules/isolated-vm/prebuilds && \
    cd node_modules/isolated-vm && \
    node /usr/local/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js rebuild --release -j max

# Pinned to multi-arch index digest (linux/amd64 + linux/arm64) for reproducible builds.
# ghcr.io/519lab/base is republished by build-base-image.yml (docker/images/n8n-base)
# on every base change, so a base rebuild does not reach this image until the digest
# is manually re-pinned here. Bump the digest together with the tag whenever the base
# image is intentionally updated.
# Digest pins to ghcr.io/519lab/base:24.22.1 (Node 24.22.1, Alpine 3.24; CVE-2026-111497).
FROM ghcr.io/519lab/base:24.22.1@sha256:f181cc2f998f16d49765f3168410b32d91360b2b3362fd2921f4293d0e969dba

ARG N8N_VERSION
ARG N8N_RELEASE_TYPE=dev
ENV NODE_ENV=production
ENV N8N_RELEASE_TYPE=${N8N_RELEASE_TYPE}
ENV SHELL=/bin/sh

WORKDIR /home/node

COPY --from=builder /usr/local/lib/node_modules/n8n /usr/local/lib/node_modules/n8n
COPY docker/images/n8n/docker-entrypoint.sh /

# The Alpine 3.24 base has no /usr/local/bin (node lives in /usr/bin); create it for the symlink.
RUN mkdir -p /usr/local/bin && \
    ln -s /usr/local/lib/node_modules/n8n/bin/n8n /usr/local/bin/n8n && \
    mkdir -p /home/node/.n8n && \
    chown -R node:node /home/node && \
    rm -rf /root/.npm /tmp/*

EXPOSE 5678/tcp
USER node
ENTRYPOINT ["tini", "--", "/docker-entrypoint.sh"]

LABEL org.opencontainers.image.title="n8n" \
      org.opencontainers.image.description="Workflow Automation Tool" \
      org.opencontainers.image.source="https://github.com/n8n-io/n8n" \
      org.opencontainers.image.url="https://n8n.io" \
      org.opencontainers.image.version=${N8N_VERSION}
