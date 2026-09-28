FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/fayfort-server ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates \
    && adduser -D -u 10001 app \
    && mkdir -p /data && chown app:app /data
COPY --from=build /out/fayfort-server /usr/local/bin/fayfort-server
USER app
WORKDIR /data
EXPOSE 8080
CMD ["/usr/local/bin/fayfort-server", "-addr", "0.0.0.0:8080", "-db", "/data/fayfort.db"]