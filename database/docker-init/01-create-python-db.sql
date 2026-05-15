-- 与 POSTGRES_DB（默认 aegis_go）同属一个 Postgres 实例；供两个 Python 微服务共用。
-- 不指定 OWNER，使用 Postgres 官方镜像执行初始化脚本时的 POSTGRES_USER 作为 owner。
CREATE DATABASE aegis_python;
