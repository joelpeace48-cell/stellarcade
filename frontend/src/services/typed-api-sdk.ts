import {
  ApiErrorCategory,
  type ApiClientError,
  type ApiRequestOptions,
  type ApiResult,
  type CreateProfileRequest,
  type CreateProfileResponse,
  type DepositResponse,
  type Game,
  type GetGameByIdResponse,
  type GetGamesResponse,
  type GetProfileResponse,
  type PlayGameRequest,
  type PlayGameResponse,
  type UpdateProfileRequest,
  type UpdateProfileResponse,
  type WalletAmountRequest,
  type WithdrawResponse,
} from '../types/api-client';
import { ErrorDomain, ErrorSeverity, type ApiErrorCode } from '../types/errors';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 300;

interface SessionStore {
  getToken(): string | null;
}

interface ApiClientConfig {
  baseUrl?: string;
  sessionStore?: SessionStore;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeClientError(params: {
  code: ApiErrorCode;
  message: string;
  category: (typeof ApiErrorCategory)[keyof typeof ApiErrorCategory];
  severity: (typeof ErrorSeverity)[keyof typeof ErrorSeverity];
  status?: number;
  originalMessage?: string;
}): ApiClientError {
  return {
    code: params.code,
    message: params.message,
    category: params.category,
    severity: params.severity,
    domain: ErrorDomain.API,
    status: params.status,
    originalMessage: params.originalMessage,
  };
}

function makeUnauthorizedError(): ApiClientError {
  return makeClientError({
    code: 'API_UNAUTHORIZED',
    message: 'Authentication required.',
    category: ApiErrorCategory.AUTH,
    severity: ErrorSeverity.TERMINAL,
    status: 401,
  });
}

function mapApiError(status: number, body: Record<string, unknown>): ApiClientError {
  const nestedError = (body.error ?? {}) as Record<string, unknown>;
  const message =
    (typeof nestedError.message === 'string' && nestedError.message) ||
    (typeof body.message === 'string' && body.message) ||
    `Request failed with status ${status}`;

  if (status === 400) {
    return makeClientError({
      code: 'API_VALIDATION_ERROR',
      message: 'Validation failed.',
      category: ApiErrorCategory.VALIDATION,
      severity: ErrorSeverity.TERMINAL,
      status,
      originalMessage: message,
    });
  }

  if (status === 401) {
    return makeClientError({
      code: 'API_UNAUTHORIZED',
      message: 'Authentication required.',
      category: ApiErrorCategory.AUTH,
      severity: ErrorSeverity.TERMINAL,
      status,
      originalMessage: message,
    });
  }

  if (status === 403) {
    return makeClientError({
      code: 'API_FORBIDDEN',
      message: 'You are not allowed to perform this action.',
      category: ApiErrorCategory.AUTH,
      severity: ErrorSeverity.TERMINAL,
      status,
      originalMessage: message,
    });
  }

  if (status === 404) {
    return makeClientError({
      code: 'API_NOT_FOUND',
      message: 'Requested resource was not found.',
      category: ApiErrorCategory.UNKNOWN,
      severity: ErrorSeverity.TERMINAL,
      status,
      originalMessage: message,
    });
  }

  if (status === 429) {
    return makeClientError({
      code: 'API_RATE_LIMITED',
      message: 'Too many requests. Please try again.',
      category: ApiErrorCategory.SERVER,
      severity: ErrorSeverity.RETRYABLE,
      status,
      originalMessage: message,
    });
  }

  if (status >= 500) {
    return makeClientError({
      code: 'API_SERVER_ERROR',
      message: 'Server error. Please try again.',
      category: ApiErrorCategory.SERVER,
      severity: ErrorSeverity.RETRYABLE,
      status,
      originalMessage: message,
    });
  }

  return makeClientError({
    code: 'API_UNKNOWN',
    message,
    category: ApiErrorCategory.UNKNOWN,
    severity: ErrorSeverity.TERMINAL,
    status,
    originalMessage: message,
  });
}

function mapRpcError(err: unknown, timedOut: boolean): ApiClientError {
  if (timedOut) {
    return makeClientError({
      code: 'API_REQUEST_TIMEOUT',
      message: 'Request timed out.',
      category: ApiErrorCategory.NETWORK,
      severity: ErrorSeverity.TERMINAL,
      originalMessage: 'Request timed out.',
    });
  }

  if (err instanceof DOMException && err.name === 'AbortError') {
    return makeClientError({
      code: 'API_ABORTED',
      message: 'Request was cancelled.',
      category: ApiErrorCategory.NETWORK,
      severity: ErrorSeverity.TERMINAL,
      originalMessage: err.message,
    });
  }

  const message = err instanceof Error ? err.message : 'Network error';
  return makeClientError({
    code: 'API_NETWORK_ERROR',
    message: 'Network request failed.',
    category: ApiErrorCategory.NETWORK,
    severity: ErrorSeverity.RETRYABLE,
    originalMessage: message,
  });
}

function dispatchApiTrace(_data: unknown): void {
  // no-op stub for local diagnostics hook
}

function makeValidationError(message: string): ApiClientError {
  return makeClientError({
    code: 'API_VALIDATION_ERROR',
    message,
    category: ApiErrorCategory.VALIDATION,
    severity: ErrorSeverity.TERMINAL,
  });
}

export class ApiClient {
  private readonly _baseUrl: string;
  private readonly _sessionStore?: SessionStore;

  constructor();
  constructor(baseUrl: string, sessionStore?: SessionStore);
  constructor(config: ApiClientConfig);
  constructor(arg1?: string | ApiClientConfig, arg2?: SessionStore) {
    if (typeof arg1 === 'string') {
      this._baseUrl = arg1;
      this._sessionStore = arg2;
      return;
    }

    this._baseUrl = arg1?.baseUrl ?? '';
    this._sessionStore = arg1?.sessionStore;
  }

  async getGames(opts?: ApiRequestOptions): Promise<ApiResult<GetGamesResponse>> {
    return this._request('GET', '/games', undefined, false, opts);
  }

  async getGameById(gameId: string, opts?: ApiRequestOptions): Promise<ApiResult<GetGameByIdResponse>> {
    if (!gameId.trim()) {
      return { success: false, error: makeValidationError('Game id is required.') };
    }
    return this._request('GET', `/games/${encodeURIComponent(gameId)}`, undefined, false, opts);
  }

  async playGame(input: PlayGameRequest, opts?: ApiRequestOptions): Promise<ApiResult<PlayGameResponse>> {
    if (!input.gameId.trim()) {
      return { success: false, error: makeValidationError('Game id is required.') };
    }
    if (input.wager !== undefined && input.wager <= 0) {
      return { success: false, error: makeValidationError('Wager must be greater than zero.') };
    }
    return this._request('POST', '/games/play', input, true, opts);
  }

  async getProfile(opts?: ApiRequestOptions): Promise<ApiResult<GetProfileResponse>> {
    return this._request('GET', '/users/profile', undefined, true, opts);
  }

  async createProfile(input: CreateProfileRequest, opts?: ApiRequestOptions): Promise<ApiResult<CreateProfileResponse>> {
    if (!input.address.trim()) {
      return { success: false, error: makeValidationError('Address is required.') };
    }
    return this._request('POST', '/users/create', input, false, opts);
  }

  async updateProfile(input: UpdateProfileRequest, opts?: ApiRequestOptions): Promise<ApiResult<UpdateProfileResponse>> {
    if (!input.address.trim() || !input.username.trim()) {
      return { success: false, error: makeValidationError('Address and username are required.') };
    }
    return this._request('POST', '/users/update', input, true, opts);
  }

  async deposit(input: WalletAmountRequest, opts?: ApiRequestOptions): Promise<ApiResult<DepositResponse>> {
    if (input.amount <= 0) {
      return { success: false, error: makeValidationError('Amount must be greater than zero.') };
    }
    return this._request('POST', '/wallet/deposit', input, true, opts);
  }

  async withdraw(input: WalletAmountRequest, opts?: ApiRequestOptions): Promise<ApiResult<WithdrawResponse>> {
    if (input.amount <= 0) {
      return { success: false, error: makeValidationError('Amount must be greater than zero.') };
    }
    return this._request('POST', '/wallet/withdraw', input, true, opts);
  }

  private async _request<T>(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    requiresAuth: boolean,
    opts: ApiRequestOptions = {},
  ): Promise<ApiResult<T>> {
    const token = this._sessionStore?.getToken() ?? null;

    if (requiresAuth && token === null) {
      return { success: false, error: makeUnauthorizedError() };
    }

    if (opts.signal?.aborted) {
      return {
        success: false,
        error: makeClientError({
          code: 'API_ABORTED',
          message: 'Request was cancelled.',
          category: ApiErrorCategory.NETWORK,
          severity: ErrorSeverity.TERMINAL,
          originalMessage: 'Request was cancelled.',
        }),
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token !== null) {
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (opts.timeout !== undefined) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, opts.timeout);
    }

    if (opts.signal) {
      opts.signal.addEventListener('abort', () => {
        controller.abort(opts.signal?.reason);
      });
    }

    const url = `${this._baseUrl}${path}`;
    let lastError: ApiClientError | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      if (attempt > 0) {
        await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1));
      }

      try {
        dispatchApiTrace({ method, path, attempt: attempt + 1 });

        const response = await fetch(url, {
          method,
          headers,
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          signal: controller.signal,
        });

        if (response.ok) {
          const data = (await response.json()) as T;
          if (timeoutId) clearTimeout(timeoutId);
          return { success: true, data };
        }

        let errorBody: Record<string, unknown>;
        try {
          errorBody = (await response.json()) as Record<string, unknown>;
        } catch {
          errorBody = { status: response.status };
        }

        const mapped = mapApiError(response.status, errorBody);
        lastError = mapped;

        if (mapped.severity !== ErrorSeverity.RETRYABLE) {
          if (timeoutId) clearTimeout(timeoutId);
          return { success: false, error: mapped };
        }
      } catch (err: unknown) {
        const mapped = mapRpcError(err, timedOut);
        lastError = mapped;

        if (mapped.severity !== ErrorSeverity.RETRYABLE) {
          if (timeoutId) clearTimeout(timeoutId);
          return { success: false, error: mapped };
        }
      }
    }

    if (timeoutId) clearTimeout(timeoutId);
    return {
      success: false,
      error:
        lastError ??
        makeClientError({
          code: 'API_UNKNOWN',
          message: 'Unknown API error.',
          category: ApiErrorCategory.UNKNOWN,
          severity: ErrorSeverity.TERMINAL,
        }),
    };
  }
}

export type { ApiResult, ApiRequestOptions, ApiClientError };
export type { Game };
