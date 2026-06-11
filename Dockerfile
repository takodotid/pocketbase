# Use Alpine as base
FROM docker.io/library/alpine:3.24.0@sha256:a2d49ea686c2adfe3c992e47dc3b5e7fa6e6b5055609400dc2acaeb241c829f4 AS base

# Install dependencies
RUN apk add --no-cache \
    tini \
    unzip \
    ca-certificates

# Download PocketBase
FROM base AS pocketbase

ARG PB_VERSION=0.39.3

# Download and unzip PocketBase (only upstream supported platforms for now)
RUN ARCH=$(case "$(uname -m)" in \
      x86_64) echo "amd64" ;; \
      aarch64) echo "arm64" ;; \
      armv7l) echo "armv7" ;; \
      ppc64le) echo "ppc64le" ;; \
      s390x) echo "s390x" ;; \
      *) echo "unknown" ;; \
    esac) && \
    wget https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip -O /tmp/pb.zip && \
    unzip /tmp/pb.zip -d /pb && \
    rm /tmp/pb.zip && \
    chmod +x /pb/pocketbase

# Vanilla image
FROM base AS vanilla

# Copy the PocketBase installation from the previous stage
COPY --from=pocketbase /pb/* ./pb/

# Start PocketBase
ENTRYPOINT [ "tini" ]
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080"]

# Tako's extended image
FROM vanilla AS tako

# COPY Tako's pb_hooks
COPY ./pb_hooks /pb/pb_hooks
