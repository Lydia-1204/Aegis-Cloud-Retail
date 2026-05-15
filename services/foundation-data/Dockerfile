# build: docker build -t aegis-foundation-data -f services/foundation-data/Dockerfile .
FROM alpine:3.20 AS build
RUN apk add --no-cache ca-certificates git go
ENV GOTOOLCHAIN=go1.25.10+auto
WORKDIR /src
COPY services/foundation-data/go.mod ./
COPY services/foundation-data/go.sum ./
RUN go mod download
COPY services/foundation-data/ ./
RUN CGO_ENABLED=0 go build -mod=mod -o /out/server ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget
WORKDIR /app
COPY --from=build /out/server ./server
EXPOSE 8081 50054
ENTRYPOINT ["/app/server"]
