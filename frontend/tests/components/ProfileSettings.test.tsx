import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileSettings, { profileStore } from '@/pages/ProfileSettings';

vi.mock('@/hooks/v1/useWalletStatus', () => ({
  useWalletStatus: () => ({
    address: 'GTEST1234567890',
    network: 'TESTNET',
    provider: 'WalletProvider',
    capabilities: { isConnected: true },
    status: 'connected',
    error: null,
    lastUpdatedAt: Date.now(),
    refresh: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    isRefreshing: false,
  }),
}));

const mockGetProfile = vi.fn();
const mockUpdateProfile = vi.fn();

vi.mock('@/services/typed-api-sdk', () => ({
  ApiClient: class {
    async getProfile() {
      return mockGetProfile();
    }
    async updateProfile(input: unknown) {
      return mockUpdateProfile(input);
    }
  },
}))

describe('ProfileSettings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileStore.dispatch({ type: 'AUTH_SET', payload: { userId: 'test', token: 'test-jwt-token' } });
    profileStore.dispatch({ type: 'PROFILE_CLEAR' });
  });

  it('loads profile data and displays values', async () => {
    mockGetProfile.mockResolvedValueOnce({
      success: true,
      data: {
        address: 'GABC123',
        username: 'alice',
        createdAt: '2025-01-01T12:00:00Z',
      },
    });

    render(<ProfileSettings />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('GABC123')).toBeInTheDocument();
      expect(screen.getByDisplayValue('alice')).toBeInTheDocument();
    });
  });

  it('exposes profile settings as a labelled page section with a top-level heading', async () => {
    mockGetProfile.mockResolvedValueOnce({
      success: true,
      data: {
        address: 'GABC123',
        username: 'alice',
        createdAt: '2025-01-01T12:00:00Z',
      },
    });

    render(<ProfileSettings />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Profile Settings' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: 'Profile Settings' }),
      ).toBeInTheDocument();
    });
  });

  it('saves successfully with optimism and shows success state', async () => {
    mockGetProfile.mockResolvedValueOnce({
      success: true,
      data: {
        address: 'GABC123',
        username: 'alice',
        createdAt: '2025-01-01T12:00:00Z',
      },
    });
    mockUpdateProfile.mockResolvedValueOnce({
      success: true,
      data: {
        address: 'GABC123',
        username: 'alice_updated',
        createdAt: '2025-01-01T12:00:00Z',
      },
    });

    render(<ProfileSettings />);

    await waitFor(() => expect(screen.getByDisplayValue('alice')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'alice_updated' },
    });
    expect(screen.getByDisplayValue('alice_updated')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('profile-settings-save'));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('profile-settings-success')).toHaveTextContent(/Profile saved successfully/i);
      expect(screen.getByDisplayValue('alice_updated')).toBeInTheDocument();
    });
  });

  it('reverts on save failure and shows error', async () => {
    mockGetProfile.mockResolvedValueOnce({
      success: true,
      data: {
        address: 'GABC123',
        username: 'alice',
        createdAt: '2025-01-01T12:00:00Z',
      },
    });
    mockUpdateProfile.mockResolvedValueOnce({
      success: false,
      error: {
        code: 'API_SERVER_ERROR',
        domain: 'api',
        message: 'Server failure',
        severity: 'terminal',
      },
    });

    render(<ProfileSettings />);

    await waitFor(() => expect(screen.getByDisplayValue('alice')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'alice_fail' },
    });

    fireEvent.click(screen.getByTestId('profile-settings-save'));

    await waitFor(() => {
      expect(screen.getByTestId('profile-settings-error')).toBeInTheDocument();
      expect(screen.getByDisplayValue('alice')).toBeInTheDocument();
    });
  });
});
