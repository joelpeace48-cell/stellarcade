import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ApiClient } from '@/services/typed-api-sdk';
import { SkeletonPreset } from '@/components/v1/LoadingSkeletonSet';
import GlobalStateStore from '@/services/global-state-store';
import { useWalletStatus } from '@/hooks/v1/useWalletStatus';
import type { UserProfile } from '@/types/api-client';

export const profileStore = new GlobalStateStore();

const formatDateTime = (value?: string): string => {
  if (!value) return 'N/A';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleString();
};

const getStoreToken = () => {
  const token = profileStore.getState().auth.token ?? null;
  if (token) return token;
  if (import.meta.env.DEV) {
    return 'test-jwt-token';
  }
  return null;
};

const createApiClient = () => {
  return new ApiClient({
    sessionStore: {
      getToken: () => getStoreToken(),
    },
  });
};

const ProfileSettings: React.FC = () => {
  const walletStatus = useWalletStatus();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState('');

  const store = useRef<GlobalStateStore>(profileStore);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const persisted = store.current.selectProfile();
      if (persisted) {
        setProfile(persisted);
        setUsername(persisted.username ?? '');
        setLoading(false);
        return;
      }

      const client = createApiClient();
      const result = await client.getProfile();
      if (result.success) {
        setProfile(result.data);
        setUsername(result.data.username ?? '');
        store.current.dispatch({ type: 'PROFILE_SET', payload: { profile: result.data } });
      } else {
        setError(result.error.message);
      }

      setLoading(false);
    };

    loadProfile();
  }, []);

  const walletMeta = useMemo(() => {
    const providerInfo = walletStatus.provider;
    const providerLabel = providerInfo
      ? `${providerInfo.name} (${providerInfo.id})${providerInfo.version ? ` v${providerInfo.version}` : ''}`
      : 'Unknown';

    return {
      connected: walletStatus.capabilities.isConnected,
      address: walletStatus.address || 'Not connected',
      network: walletStatus.network || 'Unknown',
      provider: providerLabel,
      lastUpdatedAt: walletStatus.lastUpdatedAt
        ? new Date(walletStatus.lastUpdatedAt).toLocaleString()
        : 'Never',
    };
  }, [walletStatus]);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (!profile) {
      setError('Profile data is not loaded.');
      return;
    }

    const trimmed = username.trim();
    if (!trimmed) {
      setError('Username is required.');
      return;
    }

    const nextProfile: UserProfile = {
      ...profile,
      username: trimmed,
    };

    const previousProfile = profile;
    setProfile(nextProfile);
    setSaving(true);

    const client = createApiClient();
    const result = await client.updateProfile({
      address: profile.address,
      username: trimmed,
    });

    if (result.success) {
      setProfile(result.data);
      setUsername(result.data.username ?? '');
      store.current.dispatch({ type: 'PROFILE_SET', payload: { profile: result.data } });
      setSuccess('Profile saved successfully.');
    } else {
      setProfile(previousProfile);
      setUsername(previousProfile.username ?? '');
      setError(result.error.message);
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div data-testid="profile-settings-loading" role="status" aria-live="polite">
        <p>Loading profile settings...</p>
        <SkeletonPreset type="detail" />
      </div>
    );
  }

  return (
    <section className="profile-settings" aria-labelledby="profile-settings-heading">
      <h1 id="profile-settings-heading">Profile Settings</h1>

      {error && (
        <div role="alert" className="error-message" data-testid="profile-settings-error">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="success-message" data-testid="profile-settings-success">
          {success}
        </div>
      )}

      <form
        onSubmit={(evt) => {
          evt.preventDefault();
          void handleSave();
        }}
      >
        <div className="form-row">
          <label htmlFor="profile-address">Wallet Address</label>
          <input
            id="profile-address"
            type="text"
            value={profile?.address ?? ''}
            readOnly
            aria-readonly
          />
        </div>

        <div className="form-row">
          <label htmlFor="profile-username">Username</label>
          <input
            id="profile-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your display name"
          />
        </div>

        <div className="form-row">
          <label htmlFor="profile-createdAt">Created At</label>
          <input
            id="profile-createdAt"
            type="text"
            value={formatDateTime(profile?.createdAt)}
            readOnly
            aria-readonly
          />
        </div>

        <button type="submit" disabled={saving} data-testid="profile-settings-save">
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>

      <div className="wallet-metadata" data-testid="profile-settings-wallet-meta">
        <h3>Wallet Metadata</h3>
        <dl>
          <dt>Connected</dt>
          <dd>{String(walletMeta.connected)}</dd>

          <dt>Address</dt>
          <dd>{walletMeta.address}</dd>

          <dt>Network</dt>
          <dd>{walletMeta.network}</dd>

          <dt>Provider</dt>
          <dd>{walletMeta.provider}</dd>

          <dt>Last Sync</dt>
          <dd>{walletMeta.lastUpdatedAt}</dd>
        </dl>
      </div>
    </section>
  );
};

export default ProfileSettings;
