import type { AuthState } from "@/stores/requestStore";

export function extractErrorReason(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const maybeMessage =
      "message" in error && typeof error.message === "string"
        ? error.message
        : "error" in error && typeof error.error === "string"
          ? error.error
          : null;

    if (maybeMessage && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error";
    }
  }

  return "Unknown error";
}

export function buildRequestedUrlForDisplay(
  baseUrl: string,
  queryParams: Array<{ key: string; value: string; enabled: boolean }>,
  auth: AuthState,
): string {
  try {
    const parsedUrl = new URL(baseUrl);

    for (const param of queryParams) {
      if (param.enabled && param.key.trim().length > 0) {
        parsedUrl.searchParams.append(param.key, param.value);
      }
    }

    if (
      auth.type === "api-key" &&
      auth.in === "query" &&
      auth.key.trim().length > 0
    ) {
      parsedUrl.searchParams.append(auth.key, auth.value);
    }

    return parsedUrl.toString();
  } catch {
    return baseUrl;
  }
}

export function parseUrlWithFallback(rawUrl: string): URL | null {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    return new URL(trimmed);
  } catch {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
      return null;
    }

    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

export function stripQueryFromUrl(rawUrl: string): string {
  const parsedUrl = parseUrlWithFallback(rawUrl);
  if (!parsedUrl) {
    const hashIndex = rawUrl.indexOf("#");
    const beforeHash = hashIndex >= 0 ? rawUrl.slice(0, hashIndex) : rawUrl;
    const hash = hashIndex >= 0 ? rawUrl.slice(hashIndex) : "";
    const queryIndex = beforeHash.indexOf("?");
    const withoutQuery =
      queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
    return `${withoutQuery}${hash}`;
  }

  parsedUrl.search = "";
  return parsedUrl.toString();
}

export function buildUrlFromQueryParams(
  rawUrl: string,
  params: Array<{ key: string; value: string; enabled: boolean }>,
): string | null {
  const parsedUrl = parseUrlWithFallback(rawUrl);
  if (!parsedUrl) {
    return null;
  }

  parsedUrl.search = "";
  for (const param of params) {
    if (param.enabled && param.key.trim().length > 0) {
      parsedUrl.searchParams.append(param.key, param.value);
    }
  }

  return parsedUrl.toString();
}

export function areQueryParamsEqual(
  left: Array<{ key: string; value: string; enabled: boolean }>,
  right: Array<{ key: string; value: string; enabled: boolean }>,
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((row, index) => {
    const other = right[index];
    return (
      row.key === other.key &&
      row.value === other.value &&
      row.enabled === other.enabled
    );
  });
}

export function authStateToConfig(authState: AuthState): Record<string, string> {
  switch (authState.type) {
    case "bearer":
      return { token: authState.token };
    case "basic":
      return { username: authState.username, password: authState.password };
    case "api-key":
      return { key: authState.key, value: authState.value, in: authState.in };
    default:
      return {};
  }
}
