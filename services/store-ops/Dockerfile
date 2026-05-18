FROM golang:1.25-alpine AS build
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories \
    && apk add --no-cache ca-certificates git
ENV GOPROXY=https://goproxy.cn,direct
WORKDIR /src
COPY services/store-ops/go.mod ./
COPY services/store-ops/go.sum ./
RUN go mod download
COPY services/store-ops/ ./
RUN CGO_ENABLED=0 go build -mod=mod -o /out/server ./cmd/server

FROM alpine:3.20
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories \
    && apk add --no-cache ca-certificates wget
WORKDIR /app
COPY --from=build /out/server ./server
EXPOSE 8082 50055
ENTRYPOINT ["/app/server"]
