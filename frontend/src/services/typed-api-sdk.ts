private async _request<T>(
  method: "GET" | "POST",
  path: string,
  body: unknown,
  requiresAuth: boolean,
  opts: ApiRequestOptions = {},
): Promise<ApiResult<T>> {
  const token = this._sessionStore?.getToken() ?? null;
  if (requiresAuth && token === null) {
    return { success: false, error: makeUnauthorizedError() };
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== null) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let requestSignal = opts.signal;

  if (opts.timeout !== undefined) {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort("timeout"), opts.timeout);

    if (requestSignal) {
      if ("any" in AbortSignal && typeof AbortSignal.any === "function") {
        requestSignal = (AbortSignal as any).any([requestSignal, controller.signal]);
      } else {
        requestSignal.addEventListener("abort", () => controller.abort(requestSignal?.reason));
        requestSignal = controller.signal;
      }
    } else {
      requestSignal = controller.signal;
    }
  }

  const url = `${this._baseUrl}${path}`;
  const traceId = `api-req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  let lastError: ApiClientError | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1));
    }

    const startTime = Date.now();
    dispatchApiTrace({
      traceId: attempt > 0 ? `${traceId}-retry-${attempt}` : traceId,
      source: "ApiClient",
      method,
      url,
      startTime,
      endTime: null,
      durationMs: null,
      status: "pending",
    });

    if (requestSignal?.aborted) {
      const isTimeout = requestSignal.reason === "timeout";
      return {
        success: false,
        error: normalizeApiClientError(
          {
            code: isTimeout ? "API_REQUEST_TIMEOUT" : "API_ABORTED",
            domain: ErrorDomain.API,
            severity: ErrorSeverity.TERMINAL,
            message: isTimeout
              ? `Request timed out after ${opts.timeout}ms`
              : "Request was cancelled by the user.",
          },
          {
            category: "network",
            originalMessage: String(requestSignal.reason || "Aborted"),
          },
        ),
      };
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: requestSignal,
      });
    } catch (networkErr: any) {
      const mappedNetErr = normalizeApiClientError(
        mapRpcError(networkErr, { url, attempt }),
        {
          category: "network",
          originalMessage: networkErr instanceof Error ? networkErr.message : String(networkErr),
        },
      );
      lastError = mappedNetErr;
      if (mappedNetErr.severity === ErrorSeverity.RETRYABLE) continue;
      return { success: false, error: mappedNetErr };
    }

    if (response.ok) {
      const data = (await response.json()) as T;
      dispatchApiTrace({
        traceId: attempt > 0 ? `${traceId}-retry-${attempt}` : traceId,
        source: "ApiClient",
        method,
        url,
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime,
        status: "success",
        statusCode: response.status,
      });
      return { success: true, data };
    }

    // Parse error body
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = { status: response.status };
    }

    const rawWithStatus =
      typeof errorBody === "object" && errorBody !== null
        ? { ...(errorBody as Record<string, unknown>), status: response.status }
        : { status: response.status };

    const mapped = normalizeApiClientError(
      mapApiError(rawWithStatus, { url, attempt, status: response.status }),
      {
        status: response.status,
        originalMessage:
          typeof errorBody === "object" &&
          errorBody !== null &&
          "message" in (errorBody as Record<string, unknown>) &&
          typeof (errorBody as Record<string, unknown>).message === "string"
            ? ((errorBody as Record<string, unknown>).message as string)
            : undefined,
      },
    );

    lastError = mapped;

    dispatchApiTrace({
      traceId: attempt > 0 ? `${traceId}-retry-${attempt}` : traceId,
      source: "ApiClient",
      method,
      url,
      startTime,
      endTime: Date.now(),
      durationMs: Date.now() - startTime,
      status: "error",
      statusCode: response.status,
      errorData: mapped,
    });

    if (mapped.severity !== ErrorSeverity.RETRYABLE) {
      return { success: false, error: mapped };
    }
  }

  return { success: false, error: lastError! };
}
