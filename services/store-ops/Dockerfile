FROM alpine:3.20 AS build
RUN apk add --no-cache ca-certificates git go
ENV GOTOOLCHAIN=go1.25.10+auto
WORKDIR /src
COPY services/store-ops/go.mod ./
COPY services/store-ops/go.sum ./
RUN go mod download
COPY services/store-ops/ ./
RUN CGO_ENABLED=0 go build -mod=mod -o /out/server ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget
WORKDIR /app
COPY --from=build /out/server ./server
EXPOSE 8082 50055
ENTRYPOINT ["/app/server"]
