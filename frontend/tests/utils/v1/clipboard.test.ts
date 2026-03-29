import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard } from '../../../src/utils/v1/clipboard';

describe('clipboard utility', () => {
  let originalClipboard: any;
  let originalExecCommand: any;

  beforeEach(() => {
    // Save original globals
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    originalExecCommand = document.execCommand;
  });

  afterEach(() => {
    // Restore original globals
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    } else {
      // @ts-expect-error - overriding for tests
      delete navigator.clipboard;
    }
    document.execCommand = originalExecCommand;
    vi.restoreAllMocks();
  });

  it('fails gracefully when text is empty', async () => {
    const result = await copyToClipboard('');
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Cannot copy empty text');
  });

  it('uses navigator.clipboard.writeText when available and successful', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    const result = await copyToClipboard('test copy');
    expect(writeTextMock).toHaveBeenCalledWith('test copy');
    expect(result.success).toBe(true);
  });

  it('falls back to document.execCommand if navigator.clipboard fails', async () => {
    // navigator.clipboard fails
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    // Mock document.execCommand for success
    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const result = await copyToClipboard('test fallback');
    
    expect(writeTextMock).toHaveBeenCalledWith('test fallback');
    expect(execCommandMock).toHaveBeenCalledWith('copy');
    expect(result.success).toBe(true);
  });

  it('uses document.execCommand if navigator.clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const result = await copyToClipboard('no navigator');
    
    expect(execCommandMock).toHaveBeenCalledWith('copy');
    expect(result.success).toBe(true);
  });

  it('returns false if both APIs fail', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });

    // Fail document.execCommand
    const execCommandMock = vi.fn().mockReturnValue(false);
    document.execCommand = execCommandMock;

    const result = await copyToClipboard('total failure');
    
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('document.execCommand failed');
  });
});
