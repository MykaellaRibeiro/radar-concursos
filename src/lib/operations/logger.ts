type LogLevel = "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const sensitiveKey = /authorization|cookie|password|secret|token|service.?role|api.?key|database.?url/i;
const bearerValue = /bearer\s+[a-z0-9._~+/=-]+/gi;
const jwtValue = /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;

function sanitize(value: unknown, key = ""): unknown {
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (typeof value === "string") return value.replace(bearerValue, "Bearer [REDACTED]").replace(jwtValue, "[JWT REDACTED]").slice(0, 2000);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey)]));
  }
  return value;
}

export function operationalLog(level: LogLevel, event: string, context: LogContext = {}) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...sanitize(context) as LogContext });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export function errorContext(error: unknown) {
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; code?: unknown; name?: unknown };
    return {
      errorName: typeof candidate.name === "string" ? candidate.name : "Error",
      errorCode: typeof candidate.code === "string" ? candidate.code : undefined,
      errorMessage: typeof candidate.message === "string" ? candidate.message : "Falha operacional sem mensagem.",
    };
  }
  return { errorName: "Error", errorMessage: String(error) };
}
