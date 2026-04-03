/**
 * 总部端与门店端共享：API 路径常量、DTO 类型、工具函数等。
 * 避免两前端各自复制一份导致与《Aegis接口设计文档》漂移。
 */

/** 本地默认基址；各应用在 Vite `define` 或运行时配置中覆盖即可 */
export const DEFAULT_API_BASES = {
  foundationData: "http://localhost:8081",
  storeOps: "http://localhost:8082",
  trafficSense: "http://localhost:8083",
  aiAssistant: "http://localhost:8084",
} as const;
