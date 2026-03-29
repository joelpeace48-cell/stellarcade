/**
 * React hooks for form validation and input handling.
 *
 * These hooks provide stateful validation logic for forms and user inputs,
 * wrapping the core validation utilities from utils/v1/validation.
 *
 * @module hooks/v1/validation
 */

import { useState, useCallback, useMemo } from "react";
import { useI18n } from "../../i18n/provider";
import type {
  ValidationError,
  WagerBounds,
  StringConstraints,
  NumericBounds,
} from "../../utils/v1/validation";
import {
  validateWager,
  validateGameId,
  validateEnum,
  validateStellarAddress,
  validateString,
  validateNumber,
  DEFAULT_WAGER_BOUNDS,
} from "../../utils/v1/validation";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ValidationState<T> {
  value: T;
  error: ValidationError | null;
  isValid: boolean;
  isDirty: boolean;
}

export interface ValidationHookResult<T> {
  value: T;
  error: ValidationError | null;
  isValid: boolean;
  isDirty: boolean;
  setValue: (value: T) => void;
  validate: () => boolean;
  reset: (newValue?: T) => void;
  touch: () => void;
}

/**
 * Maps a validation error to a locale-aware message key.
 * 
 * @param error - The validation error object
 * @returns The message key for the error
 */
export function getValidationMessageKey(error: ValidationError): string {
  const code = error.code.toLowerCase();
  const field = error.field?.toLowerCase();

  // Prefer field-specific key, fall back to generic key
  return field 
    ? `validation.${field}.${code}` 
    : `validation.generic.${code}`;
}

/**
 * Translates a validation error using the provided translation function.
 * 
 * @param error - The validation error object
 * @param t - The translation function from useI18n
 * @returns The localized message or the original error message as fallback
 */
export function translateValidationError(
  error: ValidationError, 
  t: (key: string, fallback?: string) => string
): string {
  const key = getValidationMessageKey(error);
  return t(key, error.message);
}

// ── Wager Validation Hook ──────────────────────────────────────────────────────

/**
 * Hook for validating wager amounts with stateful error tracking.
 *
 * @param initialValue - Initial wager value (default: empty string)
 * @param bounds - Optional custom wager bounds
 * @returns Validation state and control functions
 *
 * @example
 * ```typescript
 * function WagerInput() {
 *   const wager = useWagerValidation("", { min: 5_000_000n, max: 100_000_000n });
 *
 *   const handleSubmit = () => {
 *     if (wager.validate()) {
 *       // wager.value is guaranteed to be valid here
 *       submitBet(wager.value);
 *     }
 *   };
 *
 *   // return input with value={wager.value}, onChange, onBlur handlers
 *   // show error message when wager.isDirty && wager.error
 * }
 * ```
 */
export function useWagerValidation(
  initialValue: string = "",
  bounds: WagerBounds = DEFAULT_WAGER_BOUNDS
): ValidationHookResult<string> {
  const [value, setValue] = useState<string>(initialValue);
  const [error, setError] = useState<ValidationError | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const validate = useCallback((): boolean => {
    const result = validateWager(value, bounds);
    if (result.success) {
      setError(null);
      return true;
    } else {
      setError(result.error);
      return false;
    }
  }, [value, bounds]);

  const handleSetValue = useCallback((newValue: string) => {
    setValue(newValue);
    setIsDirty(true);
    // Clear error on change, will re-validate on blur or submit
    setError(null);
  }, []);

  const reset = useCallback((newValue: string = initialValue) => {
    setValue(newValue);
    setError(null);
    setIsDirty(false);
  }, [initialValue]);

  const touch = useCallback(() => {
    setIsDirty(true);
    validate();
  }, [validate]);

  const isValid = useMemo(() => {
    return error === null && (value === "" || validateWager(value, bounds).success);
  }, [value, error, bounds]);

  return {
    value,
    error,
    isValid,
    isDirty,
    setValue: handleSetValue,
    validate,
    reset,
    touch,
  };
}

// ── Game ID Validation Hook ────────────────────────────────────────────────────

/**
 * Hook for validating game IDs with stateful error tracking.
 *
 * @param initialValue - Initial game ID value
 * @returns Validation state and control functions
 */
export function useGameIdValidation(
  initialValue: string = ""
): ValidationHookResult<string> {
  const [value, setValue] = useState<string>(initialValue);
  const [error, setError] = useState<ValidationError | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const validate = useCallback((): boolean => {
    const result = validateGameId(value);
    if (result.success) {
      setError(null);
      return true;
    } else {
      setError(result.error);
      return false;
    }
  }, [value]);

  const handleSetValue = useCallback((newValue: string) => {
    setValue(newValue);
    setIsDirty(true);
    setError(null);
  }, []);

  const reset = useCallback((newValue: string = initialValue) => {
    setValue(newValue);
    setError(null);
    setIsDirty(false);
  }, [initialValue]);

  const touch = useCallback(() => {
    setIsDirty(true);
    validate();
  }, [validate]);

  const isValid = useMemo(() => {
    return error === null && (value === "" || validateGameId(value).success);
  }, [value, error]);

  return {
    value,
    error,
    isValid,
    isDirty,
    setValue: handleSetValue,
    validate,
    reset,
    touch,
  };
}

// ── Enum Validation Hook ───────────────────────────────────────────────────────

/**
 * Hook for validating enum values with stateful error tracking.
 *
 * @param initialValue - Initial enum value
 * @param allowedValues - Array of allowed enum values
 * @param fieldName - Name of the field for error messages
 * @returns Validation state and control functions
 *
 * @example
 * ```typescript
 * function CoinSideSelector() {
 *   const side = useEnumValidation<"heads" | "tails">(
 *     "heads",
 *     ["heads", "tails"],
 *     "side"
 *   );
 *
 *   // return select element with value={side.value} and onChange handler
 * }
 * ```
 */
export function useEnumValidation<T extends string>(
  initialValue: T | "",
  allowedValues: readonly T[],
  fieldName: string = "value"
): ValidationHookResult<T | ""> {
  const [value, setValue] = useState<T | "">(initialValue);
  const [error, setError] = useState<ValidationError | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const validate = useCallback((): boolean => {
    if (value === "") {
      setError({
        code: "REQUIRED" as any,
        message: `${fieldName} is required`,
        field: fieldName,
      });
      return false;
    }
    const result = validateEnum(value as T, allowedValues, fieldName);
    if (result.success) {
      setError(null);
      return true;
    } else {
      setError(result.error);
      return false;
    }
  }, [value, allowedValues, fieldName]);

  const handleSetValue = useCallback((newValue: T | "") => {
    setValue(newValue);
    setIsDirty(true);
    setError(null);
  }, []);

  const reset = useCallback((newValue: T | "" = initialValue) => {
    setValue(newValue);
    setError(null);
    setIsDirty(false);
  }, [initialValue]);

  const touch = useCallback(() => {
    setIsDirty(true);
    validate();
  }, [validate]);

  const isValid = useMemo(() => {
    return error === null && (value === "" || validateEnum(value as T, allowedValues, fieldName).success);
  }, [value, error, allowedValues, fieldName]);

  return {
    value,
    error,
    isValid,
    isDirty,
    setValue: handleSetValue,
    validate,
    reset,
    touch,
  };
}

// ── Address Validation Hook ────────────────────────────────────────────────────

/**
 * Hook for validating Stellar addresses with stateful error tracking.
 *
 * @param initialValue - Initial address value
 * @returns Validation state and control functions
 */
export function useAddressValidation(
  initialValue: string = ""
): ValidationHookResult<string> {
  const [value, setValue] = useState<string>(initialValue);
  const [error, setError] = useState<ValidationError | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const validate = useCallback((): boolean => {
    const result = validateStellarAddress(value);
    if (result.success) {
      setError(null);
      return true;
    } else {
      setError(result.error);
      return false;
    }
  }, [value]);

  const handleSetValue = useCallback((newValue: string) => {
    setValue(newValue);
    setIsDirty(true);
    setError(null);
  }, []);

  const reset = useCallback((newValue: string = initialValue) => {
    setValue(newValue);
    setError(null);
    setIsDirty(false);
  }, [initialValue]);

  const touch = useCallback(() => {
    setIsDirty(true);
    validate();
  }, [validate]);

  const isValid = useMemo(() => {
    return error === null && (value === "" || validateStellarAddress(value).success);
  }, [value, error]);

  return {
    value,
    error,
    isValid,
    isDirty,
    setValue: handleSetValue,
    validate,
    reset,
    touch,
  };
}

// ── String Validation Hook ─────────────────────────────────────────────────────

/**
 * Hook for validating strings with custom constraints.
 *
 * @param initialValue - Initial string value
 * @param fieldName - Name of the field for error messages
 * @param constraints - Optional length and pattern constraints
 * @returns Validation state and control functions
 *
 * @example
 * ```typescript
 * function UsernameInput() {
 *   const username = useStringValidation("", "username", {
 *     minLength: 3,
 *     maxLength: 20,
 *     pattern: /^[a-z0-9_]+$/,
 *     patternDescription: "lowercase letters, numbers, and underscores"
 *   });
 *
 *   // return input with value={username.value}, onChange, onBlur handlers
 * }
 * ```
 */
export function useStringValidation(
  initialValue: string = "",
  fieldName: string,
  constraints: StringConstraints = {}
): ValidationHookResult<string> {
  const [value, setValue] = useState<string>(initialValue);
  const [error, setError] = useState<ValidationError | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const validate = useCallback((): boolean => {
    const result = validateString(value, fieldName, constraints);
    if (result.success) {
      setError(null);
      return true;
    } else {
      setError(result.error);
      return false;
    }
  }, [value, fieldName, constraints]);

  const handleSetValue = useCallback((newValue: string) => {
    setValue(newValue);
    setIsDirty(true);
    setError(null);
  }, []);

  const reset = useCallback((newValue: string = initialValue) => {
    setValue(newValue);
    setError(null);
    setIsDirty(false);
  }, [initialValue]);

  const touch = useCallback(() => {
    setIsDirty(true);
    validate();
  }, [validate]);

  const isValid = useMemo(() => {
    return error === null && (value === "" || validateString(value, fieldName, constraints).success);
  }, [value, error, fieldName, constraints]);

  return {
    value,
    error,
    isValid,
    isDirty,
    setValue: handleSetValue,
    validate,
    reset,
    touch,
  };
}

// ── Number Validation Hook ─────────────────────────────────────────────────────

/**
 * Hook for validating numbers with optional bounds.
 *
 * @param initialValue - Initial number value
 * @param fieldName - Name of the field for error messages
 * @param bounds - Optional min/max bounds
 * @returns Validation state and control functions
 */
export function useNumberValidation(
  initialValue: string = "",
  fieldName: string,
  bounds: NumericBounds = {}
): ValidationHookResult<string> {
  const [value, setValue] = useState<string>(initialValue);
  const [error, setError] = useState<ValidationError | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const validate = useCallback((): boolean => {
    const result = validateNumber(value, fieldName, bounds);
    if (result.success) {
      setError(null);
      return true;
    } else {
      setError(result.error);
      return false;
    }
  }, [value, fieldName, bounds]);

  const handleSetValue = useCallback((newValue: string) => {
    setValue(newValue);
    setIsDirty(true);
    setError(null);
  }, []);

  const reset = useCallback((newValue: string = initialValue) => {
    setValue(newValue);
    setError(null);
    setIsDirty(false);
  }, [initialValue]);

  const touch = useCallback(() => {
    setIsDirty(true);
    validate();
  }, [validate]);

  const isValid = useMemo(() => {
    return error === null && (value === "" || validateNumber(value, fieldName, bounds).success);
  }, [value, error, fieldName, bounds]);

  return {
    value,
    error,
    isValid,
    isDirty,
    setValue: handleSetValue,
    validate,
    reset,
    touch,
  };
}

// ── Form Validation Hook ───────────────────────────────────────────────────────

export interface FormField {
  validate: () => boolean;
  touch: () => void;
}

/**
 * Hook for managing multi-field form validation.
 *
 * @param fields - Object mapping field names to validation hooks
 * @returns Form-level validation state and control functions
 *
 * @example
 * ```typescript
 * function BetForm() {
 *   const wager = useWagerValidation();
 *   const side = useEnumValidation("", ["heads", "tails"], "side");
 *
 *   const form = useFormValidation({ wager, side });
 *
 *   const handleSubmit = () => {
 *     if (form.validateAll()) {
 *       submitBet({ wager: wager.value, side: side.value });
 *     }
 *   };
 *
 *   // return form JSX with submit button disabled based on form.isValid
 * }
 * ```
 */
export function useFormValidation(fields: Record<string, FormField>) {
  const validateAll = useCallback((): boolean => {
    let allValid = true;
    Object.values(fields).forEach((field) => {
      field.touch();
      if (!field.validate()) {
        allValid = false;
      }
    });
    return allValid;
  }, [fields]);

  const touchAll = useCallback(() => {
    Object.values(fields).forEach((field) => field.touch());
  }, [fields]);

  const isValid = useMemo(() => {
    return Object.values(fields).every((field) => field.validate());
  }, [fields]);

  return {
    validateAll,
    touchAll,
    isValid,
  };
}

export type ValidationHintVariant = 'error' | 'warning' | 'info';

export interface ValidationHint {
  field: string;
  message: string;
  variant: ValidationHintVariant;
}

export function useFieldValidationHint(
  field: string,
  error: ValidationError | null,
  warning?: string | null,
  info?: string | null
): ValidationHint | null {
  const { t } = useI18n();

  return useMemo(() => {
    if (error) {
      return {
        field,
        message: translateValidationError(error, t),
        variant: 'error' as const,
      };
    }
    if (warning) {
      return {
        field,
        message: warning,
        variant: 'warning' as const,
      };
    }
    if (info) {
      return {
        field,
        message: info,
        variant: 'info' as const,
      };
    }
    return null;
  }, [field, error, warning, info, t]);
}
