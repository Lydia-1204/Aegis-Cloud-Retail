# build: docker build -t aegis-foundation-data -f services/foundation-data/Dockerfile .
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY services/foundation-data/go.mod ./
RUN go mod download
COPY services/foundation-data/ ./
RUN CGO_ENABLED=0 go build -o /out/server ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/server ./server
EXPOSE 8081
ENTRYPOINT ["/app/server"]
