const BEIJING_TIME_ZONE = "Asia/Shanghai";

function normalizeIsoDateTime(value: string): string {
  return value.trim().replace(/(\.\d{3})\d+([Zz]|[+-]\d{2}:?\d{2})$/, "$1$2");
}

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "00";
}

export function formatBeijingDateTime(raw: string | null | undefined): string {
  if (!raw) {
    return "-";
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return "-";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const date = new Date(normalizeIsoDateTime(trimmed));
  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: BEIJING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return `${partValue(parts, "year")}-${partValue(parts, "month")}-${partValue(parts, "day")} ${partValue(parts, "hour")}:${partValue(parts, "minute")}:${partValue(parts, "second")}`;
}
