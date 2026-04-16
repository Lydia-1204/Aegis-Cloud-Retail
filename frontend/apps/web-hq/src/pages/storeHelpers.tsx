export function parseError(err: unknown): string {
  return err instanceof Error ? err.message : "请求失败";
}
