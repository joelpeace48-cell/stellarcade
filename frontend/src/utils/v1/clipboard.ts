/**
 * Clipboard Utility
 *
 * Provides a standardized copy-to-clipboard function with fallback support
 * for environments that do not support navigator.clipboard natively.
 * Includes a React hook for short-lived success/failure feedback.
 *
 * @module utils/v1/clipboard
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface ClipboardResult {
  success: boolean;
  error?: Error;
}

export type CopyFeedbackState = 'idle' | 'success' | 'error';

export interface UseCopyFeedbackOptions {
  /** Duration in ms to show feedback before reverting to idle. Default 2000. */
  feedbackDurationMs?: number;
  /** Called after a successful copy. */
  onSuccess?: (text: string) => void;
  /** Called after a failed copy. */
  onError?: (error: Error) => void;
}

export interface UseCopyFeedbackReturn {
  /** Current feedback state: 'idle', 'success', or 'error'. */
  state: CopyFeedbackState;
  /** Trigger a copy with the given text. */
  copy: (text: string) => Promise<void>;
  /** Reset feedback state back to idle. */
  reset: () => void;
}

/**
 * React hook for copy-to-clipboard with short-lived feedback state.
 *
 * Returns { state, copy, reset } where state cycles through
 * 'idle' → 'success'|'error' → 'idle' after the feedback duration.
 *
 * Degrades gracefully when clipboard APIs are unavailable.
 * Accessible: the state value can be bound to aria-live regions.
 */
export function useCopyFeedback(
  options: UseCopyFeedbackOptions = {},
): UseCopyFeedbackReturn {
  const { feedbackDurationMs = 2000, onSuccess, onError } = options;
  const [state, setState] = useState<CopyFeedbackState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setState('idle');
  }, [clearTimer]);

  const copy = useCallback(
    async (text: string) => {
      clearTimer();
      const result = await copyToClipboard(text);

      if (result.success) {
        setState('success');
        onSuccess?.(text);
      } else {
        setState('error');
        onError?.(result.error ?? new Error('Copy failed'));
      }

      timerRef.current = setTimeout(() => {
        setState('idle');
        timerRef.current = null;
      }, feedbackDurationMs);
    },
    [clearTimer, feedbackDurationMs, onSuccess, onError],
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return { state, copy, reset };
}

/**
 * Copies the given text to the user's clipboard.
 * Uses navigator.clipboard API if available, otherwise falls back to
 * document.execCommand('copy') which supports older browsers and some
 * restrictive environments.
 *
 * @param text The string to copy
 * @returns A promise resolving to a ClipboardResult object
 */
export async function copyToClipboard(text: string): Promise<ClipboardResult> {
  if (!text) {
    return { success: false, error: new Error('Cannot copy empty text') };
  }

  // Primary API: modern browsers and secure contexts
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true };
    } catch (err) {
      // If the primary API fails (e.g., due to permissions), fall through to the fallback
      console.warn('navigator.clipboard.writeText failed, attempting fallback...', err);
    }
  }

  // Fallback API: older browsers or restricted environments
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    
    // Make invisible
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const result = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (result) {
      return { success: true };
    }
    
    return { success: false, error: new Error('document.execCommand failed') };
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err : new Error(String(err)) 
    };
  }
}
