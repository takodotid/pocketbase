FROM docker.io/golang:1.24.2-alpine AS build

WORKDIR /tmp/pb

# Install dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY *.go ./

# Build the application
RUN go build -o /pb/pocketbase

FROM alpine:3.21.3 AS final

# Install tini
RUN apk add --no-cache \
    tini \
    ca-certificates

# Copy the PocketBase installation from the previous stage
COPY --from=build /pb/* ./pb/

# Start PocketBase
ENTRYPOINT [ "tini" ]
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080"]
