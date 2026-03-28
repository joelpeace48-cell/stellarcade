import { fireEvent, render, screen } from '@testing-library/react';
import { NotificationPreferencesPanel } from '../../../src/components/v1/NotificationPreferencesPanel';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '../../../src/types/notification';

const STORAGE_KEY = 'stc_notification_preferences_v1';

const getStoredPreferences = (): NotificationPreferences => {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as NotificationPreferences) : DEFAULT_NOTIFICATION_PREFERENCES;
};

describe('NotificationPreferencesPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads default preferences', () => {
    render(<NotificationPreferencesPanel />);

    expect(screen.getByTestId('notification-preferences-panel-toggle-productUpdates')).toBeChecked();
    expect(screen.getByTestId('notification-preferences-panel-toggle-gameReminders')).toBeChecked();
    expect(screen.getByTestId('notification-preferences-panel-toggle-securityAlerts')).toBeChecked();
    expect(screen.getByTestId('notification-preferences-panel-toggle-marketing')).not.toBeChecked();
  });

  it('loads persisted preferences when available', () => {
    const stored: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      marketing: true,
      gameReminders: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    render(<NotificationPreferencesPanel />);

    expect(screen.getByTestId('notification-preferences-panel-toggle-marketing')).toBeChecked();
    expect(screen.getByTestId('notification-preferences-panel-toggle-gameReminders')).not.toBeChecked();
  });

  it('persists toggle changes to storage', () => {
    render(<NotificationPreferencesPanel />);

    const marketingToggle = screen.getByTestId(
      'notification-preferences-panel-toggle-marketing'
    );
    fireEvent.click(marketingToggle);

    const stored = getStoredPreferences();
    expect(stored.marketing).toBe(true);
  });

  it('resets preferences to defaults', () => {
    render(<NotificationPreferencesPanel />);

    fireEvent.click(
      screen.getByTestId('notification-preferences-panel-toggle-marketing')
    );
    fireEvent.click(screen.getByTestId('notification-preferences-panel-reset'));

    const stored = getStoredPreferences();
    expect(stored).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(screen.getByTestId('notification-preferences-panel-toggle-marketing')).not.toBeChecked();
  });

  it('persists across remounts', () => {
    const { unmount } = render(<NotificationPreferencesPanel />);

    fireEvent.click(
      screen.getByTestId('notification-preferences-panel-toggle-gameReminders')
    );

    unmount();
    render(<NotificationPreferencesPanel />);

    expect(
      screen.getByTestId('notification-preferences-panel-toggle-gameReminders')
    ).not.toBeChecked();
  });
});
