/**
 * EmptyStateBlock Utility Functions Tests
 * 
 * Tests for helper functions used by EmptyStateBlock component:
 * - String sanitization
 * - Config resolution
 * - Action validation
 * - Error configuration
 */

import {
  sanitizeString,
  safeCallback,
  isValidCallback,
  getErrorConfig,
  getErrorTitle,
  resolveConfig,
  validateActions,
  VARIANT_CONFIGS,
} from '../../../src/components/v1/EmptyStateBlock.utils';
import type { AppError } from '../../../src/types/errors';
import { ErrorDomain, ErrorSeverity } from '../../../src/types/errors';
import type { EmptyStateBlockProps } from '../../../src/components/v1/EmptyStateBlock.types';

describe('EmptyStateBlock Utilities', () => {
  describe('sanitizeString', () => {
    it('should return empty string for null input', () => {
      expect(sanitizeString(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(sanitizeString(undefined)).toBe('');
    });

    it('should return empty string for empty string input', () => {
      expect(sanitizeString('')).toBe('');
    });

    it('should return unchanged string for safe input', () => {
      expect(sanitizeString('Hello World')).toBe('Hello World');
    });

    it('should remove script tags', () => {
      const input = '<script>alert("xss")</script>Safe Text';
      const result = sanitizeString(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
      expect(result).toContain('Safe Text');
    });

    it('should remove script tags with attributes', () => {
      const input = '<script type="text/javascript">alert("xss")</script>Safe';
      const result = sanitizeString(input);
      expect(result).not.toContain('<script');
      expect(result).toContain('Safe');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(\'xss\')">Click me</div>';
      const result = sanitizeString(input);
      expect(result).not.toContain('onclick');
    });

    it('should remove javascript: protocol', () => {
      const input = '<a href="javascript:alert(\'xss\')">Link</a>';
      const result = sanitizeString(input);
      expect(result).not.toContain('javascript:');
    });

    it('should handle multiple script tags', () => {
      const input = '<script>bad1</script>Good<script>bad2</script>';
      const result = sanitizeString(input);
      expect(result).not.toContain('<script>');
      expect(result).toContain('Good');
    });

    it('should be case-insensitive for script tags', () => {
      const input = '<SCRIPT>alert("xss")</SCRIPT>Safe';
      const result = sanitizeString(input);
      expect(result).not.toContain('SCRIPT');
      expect(result).toContain('Safe');
    });
  });

  describe('safeCallback', () => {
    it('should execute callback successfully', async () => {
      const callback = vi.fn();
      const safe = safeCallback(callback, 'test');
      
      await safe();
      
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle async callbacks', async () => {
      const callback = vi.fn().mockResolvedValue('result');
      const safe = safeCallback(callback, 'test');
      
      await safe();
      
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should catch and log errors without throwing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const callback = vi.fn(() => {
        throw new Error('Test error');
      });
      const safe = safeCallback(callback, 'test-action');
      
      await expect(safe()).resolves.not.toThrow();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('test-action'),
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should catch async errors without throwing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const callback = vi.fn().mockRejectedValue(new Error('Async error'));
      const safe = safeCallback(callback, 'async-action');
      
      await expect(safe()).resolves.not.toThrow();
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('isValidCallback', () => {
    it('should return true for function', () => {
      expect(isValidCallback(() => {})).toBe(true);
    });

    it('should return true for async function', () => {
      expect(isValidCallback(async () => {})).toBe(true);
    });

    it('should return false for string', () => {
      expect(isValidCallback('not a function')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isValidCallback(123)).toBe(false);
    });

    it('should return false for object', () => {
      expect(isValidCallback({})).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidCallback(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidCallback(undefined)).toBe(false);
    });
  });

  describe('getErrorConfig', () => {
    it('should return config for RETRYABLE error', () => {
      const error: AppError = {
        code: 'API_NETWORK_ERROR',
        domain: ErrorDomain.API,
        severity: ErrorSeverity.RETRYABLE,
        message: 'Network error',
      };
      
      const config = getErrorConfig(error);
      
      expect(config.icon).toBe('🔄');
      expect(config.title).toBe('Temporary Issue');
      expect(config.description).toBe('Network error');
    });

    it('should return config for USER_ACTIONABLE error', () => {
      const error: AppError = {
        code: 'WALLET_NOT_CONNECTED',
        domain: ErrorDomain.WALLET,
        severity: ErrorSeverity.USER_ACTIONABLE,
        message: 'Connect wallet',
      };
      
      const config = getErrorConfig(error);
      
      expect(config.icon).toBe('⚠️');
      expect(config.title).toBe('Action Required');
      expect(config.description).toBe('Connect wallet');
    });

    it('should return config for TERMINAL error', () => {
      const error: AppError = {
        code: 'CONTRACT_NOT_INITIALIZED',
        domain: ErrorDomain.CONTRACT,
        severity: ErrorSeverity.TERMINAL,
        message: 'Contract error',
      };
      
      const config = getErrorConfig(error);
      
      expect(config.icon).toBe('❌');
      expect(config.title).toBe('Unable to Complete');
      expect(config.description).toBe('Contract error');
    });

    it('should use default icon for unknown severity', () => {
      const error: AppError = {
        code: 'UNKNOWN',
        domain: ErrorDomain.UNKNOWN,
        severity: 'unknown' as any,
        message: 'Unknown error',
      };
      
      const config = getErrorConfig(error);
      
      expect(config.icon).toBe('⚠️');
    });
  });

  describe('getErrorTitle', () => {
    it('should return "Temporary Issue" for RETRYABLE', () => {
      const error: AppError = {
        code: 'API_NETWORK_ERROR',
        domain: ErrorDomain.API,
        severity: ErrorSeverity.RETRYABLE,
        message: 'Error',
      };
      
      expect(getErrorTitle(error)).toBe('Temporary Issue');
    });

    it('should return "Action Required" for USER_ACTIONABLE', () => {
      const error: AppError = {
        code: 'WALLET_NOT_CONNECTED',
        domain: ErrorDomain.WALLET,
        severity: ErrorSeverity.USER_ACTIONABLE,
        message: 'Error',
      };
      
      expect(getErrorTitle(error)).toBe('Action Required');
    });

    it('should return "Unable to Complete" for TERMINAL', () => {
      const error: AppError = {
        code: 'CONTRACT_NOT_INITIALIZED',
        domain: ErrorDomain.CONTRACT,
        severity: ErrorSeverity.TERMINAL,
        message: 'Error',
      };
      
      expect(getErrorTitle(error)).toBe('Unable to Complete');
    });

    it('should return fallback for unknown severity', () => {
      const error: AppError = {
        code: 'UNKNOWN',
        domain: ErrorDomain.UNKNOWN,
        severity: 'unknown' as any,
        message: 'Error',
      };
      
      expect(getErrorTitle(error)).toBe('Something went wrong');
    });
  });

  describe('resolveConfig', () => {
    it('should use default variant when no props provided', () => {
      const props: EmptyStateBlockProps = {};
      const config = resolveConfig(props);
      
      expect(config.title).toBe(VARIANT_CONFIGS.default.title);
      expect(config.description).toBe(VARIANT_CONFIGS.default.description);
    });

    it('should use specified variant', () => {
      const props: EmptyStateBlockProps = { variant: 'list' };
      const config = resolveConfig(props);
      
      expect(config.title).toBe(VARIANT_CONFIGS.list.title);
      expect(config.description).toBe(VARIANT_CONFIGS.list.description);
    });

    it('should use no-results variant config', () => {
      const props: EmptyStateBlockProps = { variant: 'no-results' };
      const config = resolveConfig(props);
      
      expect(config.title).toBe(VARIANT_CONFIGS['no-results'].title);
      expect(config.description).toBe(VARIANT_CONFIGS['no-results'].description);
    });

    it('should override title with custom value', () => {
      const props: EmptyStateBlockProps = {
        variant: 'list',
        title: 'Custom Title',
      };
      const config = resolveConfig(props);
      
      expect(config.title).toBe('Custom Title');
    });

    it('should override description with custom value', () => {
      const props: EmptyStateBlockProps = {
        variant: 'list',
        description: 'Custom Description',
      };
      const config = resolveConfig(props);
      
      expect(config.description).toBe('Custom Description');
    });

    it('should set description to null when explicitly null', () => {
      const props: EmptyStateBlockProps = {
        variant: 'list',
        description: null,
      };
      const config = resolveConfig(props);
      
      expect(config.description).toBeNull();
    });

    it('should override icon with custom value', () => {
      const props: EmptyStateBlockProps = {
        variant: 'list',
        icon: '🎮',
      };
      const config = resolveConfig(props);
      
      expect(config.icon).toBe('🎮');
    });

    it('should set icon to null when explicitly null', () => {
      const props: EmptyStateBlockProps = {
        variant: 'list',
        icon: null,
      };
      const config = resolveConfig(props);
      
      expect(config.icon).toBeNull();
    });

    it('should use error config when error prop provided', () => {
      const error: AppError = {
        code: 'API_NETWORK_ERROR',
        domain: ErrorDomain.API,
        severity: ErrorSeverity.RETRYABLE,
        message: 'Network error',
      };
      const props: EmptyStateBlockProps = { error };
      const config = resolveConfig(props);
      
      expect(config.title).toBe('Temporary Issue');
      expect(config.description).toBe('Network error');
    });

    it('should allow custom props to override error config', () => {
      const error: AppError = {
        code: 'API_NETWORK_ERROR',
        domain: ErrorDomain.API,
        severity: ErrorSeverity.RETRYABLE,
        message: 'Network error',
      };
      const props: EmptyStateBlockProps = {
        error,
        title: 'Custom Error Title',
      };
      const config = resolveConfig(props);
      
      expect(config.title).toBe('Custom Error Title');
      expect(config.description).toBe('Network error');
    });

    it('should sanitize title', () => {
      const props: EmptyStateBlockProps = {
        title: '<script>alert("xss")</script>Safe Title',
      };
      const config = resolveConfig(props);
      
      expect(config.title).not.toContain('<script>');
      expect(config.title).toContain('Safe Title');
    });

    it('should sanitize description', () => {
      const props: EmptyStateBlockProps = {
        description: '<script>alert("xss")</script>Safe Description',
      };
      const config = resolveConfig(props);
      
      expect(config.description).not.toContain('<script>');
      expect(config.description).toContain('Safe Description');
    });
  });

  describe('validateActions', () => {
    it('should return empty array for undefined', () => {
      expect(validateActions(undefined)).toEqual([]);
    });

    it('should return empty array for null', () => {
      expect(validateActions(null as any)).toEqual([]);
    });

    it('should return empty array for non-array', () => {
      expect(validateActions('not an array' as any)).toEqual([]);
    });

    it('should return valid actions', () => {
      const actions = [
        { label: 'Action 1', onClick: vi.fn() },
        { label: 'Action 2', onClick: vi.fn() },
      ];
      
      const result = validateActions(actions);
      
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('Action 1');
      expect(result[1].label).toBe('Action 2');
    });

    it('should filter out actions with missing label', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const actions = [
        { label: 'Valid', onClick: vi.fn() },
        { label: '', onClick: vi.fn() },
      ];
      
      const result = validateActions(actions as any);
      
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Valid');
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    it('should filter out actions with invalid onClick', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const actions = [
        { label: 'Valid', onClick: vi.fn() },
        { label: 'Invalid', onClick: 'not a function' as any },
      ];
      
      const result = validateActions(actions);
      
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Valid');
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    it('should filter out actions with null onClick', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const actions = [
        { label: 'Valid', onClick: vi.fn() },
        { label: 'Invalid', onClick: null as any },
      ];
      
      const result = validateActions(actions);
      
      expect(result).toHaveLength(1);
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    it('should preserve action properties', () => {
      const actions = [
        {
          label: 'Action',
          onClick: vi.fn(),
          variant: 'primary' as const,
          disabled: true,
        },
      ];
      
      const result = validateActions(actions);
      
      expect(result[0].variant).toBe('primary');
      expect(result[0].disabled).toBe(true);
    });
  });

  describe('VARIANT_CONFIGS', () => {
    it('should have all required variants', () => {
      expect(VARIANT_CONFIGS).toHaveProperty('list');
      expect(VARIANT_CONFIGS).toHaveProperty('search');
      expect(VARIANT_CONFIGS).toHaveProperty('no-results');
      expect(VARIANT_CONFIGS).toHaveProperty('transaction');
      expect(VARIANT_CONFIGS).toHaveProperty('error');
      expect(VARIANT_CONFIGS).toHaveProperty('default');
    });

    it('should have icon, title, and description for each variant', () => {
      Object.values(VARIANT_CONFIGS).forEach((config) => {
        expect(config).toHaveProperty('icon');
        expect(config).toHaveProperty('title');
        expect(config).toHaveProperty('description');
        expect(typeof config.icon).toBe('string');
        expect(typeof config.title).toBe('string');
        expect(typeof config.description).toBe('string');
      });
    });

    it('should have non-empty values', () => {
      Object.values(VARIANT_CONFIGS).forEach((config) => {
        expect(config.icon.length).toBeGreaterThan(0);
        expect(config.title.length).toBeGreaterThan(0);
        expect(config.description.length).toBeGreaterThan(0);
      });
    });
  });
});
