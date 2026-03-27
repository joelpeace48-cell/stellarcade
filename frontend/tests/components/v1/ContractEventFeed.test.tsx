import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContractEventFeed } from '@/components/v1/ContractEventFeed';
import type { ContractEventFeedProps } from '@/components/v1/ContractEventFeed';
import type { ContractEvent } from '@/types/contracts/events';

const mockStart = vi.fn();
const mockStop = vi.fn();
const mockClear = vi.fn();

let mockEvents: ContractEvent[] = [];
let mockIsListening = false;
let mockError: Error | null = null;

vi.mock('@/hooks/v1/useContractEvents', () => ({
  useContractEvents: vi.fn(() => ({
    events: mockEvents,
    isListening: mockIsListening,
    error: mockError,
    start: mockStart,
    stop: mockStop,
    clear: mockClear,
  })),
}));

vi.mock('@/components/v1/EmptyStateBlock', () => ({
  EmptyStateBlock: ({
    title,
    description,
    testId,
  }: {
    title?: string;
    description?: string;
    testId?: string;
  }) => (
    <div data-testid={testId ?? 'empty-state-block'}>
      {title && <span data-testid="empty-title">{title}</span>}
      {description && <span data-testid="empty-desc">{description}</span>}
    </div>
  ),
}));

vi.mock('@/components/v1/ErrorNotice', () => ({
  ErrorNotice: ({
    testId,
    onRetry,
  }: {
    testId?: string;
    onRetry?: () => void;
  }) => (
    <div data-testid={testId ?? 'error-notice'}>
      <button onClick={onRetry} data-testid="error-retry">
        Retry
      </button>
    </div>
  ),
}));

function makeEvent(overrides: Partial<ContractEvent> = {}): ContractEvent {
  const id = overrides.id ?? `evt-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    type: 'coin_flip',
    contractId: 'CAAAA1111',
    timestamp: new Date('2025-01-01T12:00:00Z').toISOString(),
    data: null,
    ...overrides,
  };
}

function renderFeed(props: Partial<ContractEventFeedProps> = {}) {
  const defaults: ContractEventFeedProps = {
    contractId: 'CXYZ1234567890',
    ...props,
  };
  return render(<ContractEventFeed {...defaults} />);
}

beforeEach(() => {
  mockEvents = [];
  mockIsListening = false;
  mockError = null;
  mockStart.mockReset();
  mockStop.mockReset();
  mockClear.mockReset();
});

describe('ContractEventFeed - rendering', () => {
  it('renders the section with aria-label', () => {
    renderFeed();
    expect(
      screen.getByRole('region', { name: /contract event feed/i }),
    ).toBeInTheDocument();
  });

  it('shows idle status badge when not yet listening', () => {
    renderFeed();
    expect(screen.getByLabelText(/feed status: idle/i)).toBeInTheDocument();
  });

  it('shows live status badge when isListening=true', () => {
    mockIsListening = true;
    renderFeed();
    expect(screen.getByLabelText(/feed status: live/i)).toBeInTheDocument();
  });

  it('shows disconnected status badge after listener stops', () => {
    mockIsListening = true;
    const { rerender } = renderFeed();
    mockIsListening = false;
    rerender(<ContractEventFeed contractId="CXYZ1234567890" />);
    expect(
      screen.getByLabelText(/feed status: disconnected/i),
    ).toBeInTheDocument();
  });

  it('renders empty state with listening message when no events and isListening=true', () => {
    mockIsListening = true;
    renderFeed();
    expect(screen.getByTestId('contract-event-feed-empty')).toBeInTheDocument();
    expect(screen.getByTestId('empty-title')).toHaveTextContent(
      /listening for events/i,
    );
  });

  it('renders empty state with paused message when no events and not listening', () => {
    renderFeed();
    expect(screen.getByTestId('contract-event-feed-empty')).toBeInTheDocument();
    expect(screen.getByTestId('empty-title')).toHaveTextContent(/feed paused/i);
  });

  it('renders event rows when events are present', () => {
    mockEvents = [makeEvent({ id: 'evt-001' }), makeEvent({ id: 'evt-002' })];
    mockIsListening = true;
    renderFeed();
    expect(screen.getByTestId('contract-event-feed-list')).toBeInTheDocument();
    expect(
      screen.getByTestId('contract-event-feed-row-evt-001'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('contract-event-feed-row-evt-002'),
    ).toBeInTheDocument();
  });

  it('shows error notice when hookError is set', () => {
    mockError = new Error('RPC node unavailable');
    renderFeed();
    expect(screen.getByTestId('contract-event-feed-error')).toBeInTheDocument();
  });

  it('does not show empty state when error is shown', () => {
    mockError = new Error('RPC node unavailable');
    renderFeed();
    expect(
      screen.queryByTestId('contract-event-feed-empty'),
    ).not.toBeInTheDocument();
  });

  it('shows event count when events exist', () => {
    mockEvents = [makeEvent(), makeEvent()];
    renderFeed();
    expect(screen.getByText(/2 events/i)).toBeInTheDocument();
  });

  it('shows singular event for one event', () => {
    mockEvents = [makeEvent()];
    renderFeed();
    expect(screen.getByText(/1 event$/i)).toBeInTheDocument();
  });
});

describe('ContractEventFeed - filters', () => {
  it('filters by eventTypeFilter (case-insensitive)', () => {
    mockEvents = [
      makeEvent({ id: 'e1', type: 'coin_flip' }),
      makeEvent({ id: 'e2', type: 'dice_roll' }),
    ];
    renderFeed({ eventTypeFilter: 'COIN_FLIP' });
    expect(screen.getByTestId('contract-event-feed-row-e1')).toBeInTheDocument();
    expect(
      screen.queryByTestId('contract-event-feed-row-e2'),
    ).not.toBeInTheDocument();
  });

  it('filters by contractSourceFilter', () => {
    mockEvents = [
      makeEvent({ id: 'e1', contractId: 'CAAA' }),
      makeEvent({ id: 'e2', contractId: 'CBBB' }),
    ];
    renderFeed({ contractSourceFilter: 'CAAA' });
    expect(screen.getByTestId('contract-event-feed-row-e1')).toBeInTheDocument();
    expect(
      screen.queryByTestId('contract-event-feed-row-e2'),
    ).not.toBeInTheDocument();
  });

  it('filters by timeWindowMs, removing old events', () => {
    const now = Date.now();
    mockEvents = [
      makeEvent({ id: 'recent', timestamp: new Date(now - 1000).toISOString() }),
      makeEvent({ id: 'old', timestamp: new Date(now - 999_999).toISOString() }),
    ];
    renderFeed({ timeWindowMs: 5000 });
    expect(
      screen.getByTestId('contract-event-feed-row-recent'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('contract-event-feed-row-old'),
    ).not.toBeInTheDocument();
  });

  it('shows active filter chips for every active filter', () => {
    renderFeed({
      eventTypeFilter: 'coin_flip',
      contractSourceFilter: 'CAAA1234567890',
      timeWindowMs: 30000,
    });
    expect(screen.getByTestId('contract-event-feed-filters')).toBeInTheDocument();
    expect(screen.getByText(/type:/i)).toBeInTheDocument();
    expect(screen.getByText(/source:/i)).toBeInTheDocument();
    expect(screen.getByText(/window:/i)).toBeInTheDocument();
  });

  it('does not show filter strip when no filters are set', () => {
    renderFeed();
    expect(
      screen.queryByTestId('contract-event-feed-filters'),
    ).not.toBeInTheDocument();
  });

  it('respects maxEvents cap', () => {
    mockEvents = Array.from({ length: 10 }, (_, i) => makeEvent({ id: `e${i}` }));
    renderFeed({ maxEvents: 3 });
    const list = screen.getByTestId('contract-event-feed-list');
    expect(list.querySelectorAll('li[data-event-id]').length).toBe(3);
  });
});

describe('ContractEventFeed - virtualization', () => {
  it('keeps small lists on the non-virtualized rendering path', () => {
    mockEvents = Array.from({ length: 3 }, (_, index) =>
      makeEvent({ id: `small-${index}` }),
    );

    renderFeed({ virtualizationThreshold: 10 });

    expect(screen.getByTestId('contract-event-feed-list')).toHaveAttribute(
      'data-virtualized',
      'false',
    );
    expect(
      screen.getAllByTestId(/contract-event-feed-row-small-/),
    ).toHaveLength(3);
  });

  it('engages virtualization only after the threshold is reached', () => {
    mockEvents = Array.from({ length: 20 }, (_, index) =>
      makeEvent({ id: `large-${index}` }),
    );

    renderFeed({
      virtualizationThreshold: 5,
      virtualizedItemHeight: 40,
      virtualizedOverscan: 1,
    });

    const list = screen.getByTestId('contract-event-feed-list');
    expect(list).toHaveAttribute('data-virtualized', 'true');
    expect(list.querySelectorAll('li[data-event-id]').length).toBeLessThan(20);
    expect(screen.getByTestId('contract-event-feed-virtualization')).toHaveTextContent(
      /virtualized list/i,
    );
  });
});

describe('ContractEventFeed - deduplication', () => {
  it('does not render duplicate event IDs', () => {
    const dup = makeEvent({ id: 'dup-001' });
    mockEvents = [dup, dup, { ...dup }];
    renderFeed();
    const rows = screen.getAllByTestId(/contract-event-feed-row-dup-001/);
    expect(rows.length).toBe(1);
  });
});

describe('ContractEventFeed - interactions', () => {
  it('calls stop() when toggle clicked while listening', () => {
    mockIsListening = true;
    renderFeed();
    fireEvent.click(screen.getByTestId('contract-event-feed-toggle'));
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('calls start() when toggle clicked while paused', () => {
    renderFeed();
    fireEvent.click(screen.getByTestId('contract-event-feed-toggle'));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('calls clear() and resets internal state when clear clicked', () => {
    mockEvents = [makeEvent()];
    renderFeed();
    fireEvent.click(screen.getByTestId('contract-event-feed-clear'));
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it('disables clear button when no events', () => {
    renderFeed();
    expect(screen.getByTestId('contract-event-feed-clear')).toBeDisabled();
  });

  it('fires onEventClick when an event row is clicked', () => {
    const event = makeEvent({ id: 'clickable' });
    mockEvents = [event];
    const handler = vi.fn();
    renderFeed({ onEventClick: handler });
    fireEvent.click(screen.getByTestId('contract-event-feed-row-clickable'));
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'clickable' }),
    );
  });

  it('fires onEventClick via keyboard Enter', () => {
    const event = makeEvent({ id: 'key-enter' });
    mockEvents = [event];
    const handler = vi.fn();
    renderFeed({ onEventClick: handler });
    const row = screen.getByTestId('contract-event-feed-row-key-enter');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('fires onEventClick via keyboard Space', () => {
    const event = makeEvent({ id: 'key-space' });
    mockEvents = [event];
    const handler = vi.fn();
    renderFeed({ onEventClick: handler });
    const row = screen.getByTestId('contract-event-feed-row-key-space');
    fireEvent.keyDown(row, { key: ' ' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('calls start() from error retry button', () => {
    mockError = new Error('rpc failure');
    renderFeed();
    fireEvent.click(screen.getByTestId('error-retry'));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('fires onNewEvent for each newly received event', async () => {
    const onNewEvent = vi.fn();
    const event = makeEvent({ id: 'new-one' });
    mockEvents = [event];
    renderFeed({ onNewEvent });
    await waitFor(() => {
      expect(onNewEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-one' }),
      );
    });
  });
});

describe('ContractEventFeed - edge cases', () => {
  it('renders invalid state block when contractId is empty string', () => {
    renderFeed({ contractId: '' });
    expect(screen.getByTestId('contract-event-feed-invalid')).toBeInTheDocument();
  });

  it('renders invalid state block when contractId is whitespace', () => {
    renderFeed({ contractId: '   ' });
    expect(screen.getByTestId('contract-event-feed-invalid')).toBeInTheDocument();
  });

  it('does not crash when events array is empty', () => {
    mockEvents = [];
    expect(() => renderFeed()).not.toThrow();
  });

  it('handles event with undefined type gracefully', () => {
    mockEvents = [makeEvent({ id: 'no-type', type: undefined as unknown as string })];
    renderFeed();
    expect(
      screen.getByTestId('contract-event-feed-row-no-type'),
    ).toBeInTheDocument();
    expect(screen.getByText('unknown')).toBeInTheDocument();
  });

  it('handles event with invalid timestamp gracefully', () => {
    mockEvents = [makeEvent({ id: 'bad-ts', timestamp: 'invalid' })];
    renderFeed();
    expect(
      screen.getByTestId('contract-event-feed-row-bad-ts'),
    ).toBeInTheDocument();
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('does not render rows when events is not an array', () => {
    (mockEvents as unknown) = null;
    renderFeed();
    expect(
      screen.queryByTestId('contract-event-feed-list'),
    ).not.toBeInTheDocument();
  });

  it('does not crash when onEventClick is not provided', () => {
    mockEvents = [makeEvent({ id: 'no-cb' })];
    renderFeed({ onEventClick: undefined });
    expect(() =>
      fireEvent.click(screen.getByTestId('contract-event-feed-row-no-cb')),
    ).not.toThrow();
  });

  it('handles very long contractId in filter chip without breaking layout', () => {
    renderFeed({ contractSourceFilter: 'C' + 'A'.repeat(55) });
    expect(screen.getByTestId('contract-event-feed-filters')).toBeInTheDocument();
  });

  it('applies custom className to root element', () => {
    renderFeed({ className: 'my-custom-class' });
    expect(document.querySelector('.my-custom-class')).toBeInTheDocument();
  });

  it('forwards testId prefix to child elements', () => {
    mockEvents = [makeEvent({ id: 'row-1' })];
    renderFeed({ testId: 'custom-feed' });
    expect(screen.getByTestId('custom-feed')).toBeInTheDocument();
    expect(screen.getByTestId('custom-feed-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('custom-feed-row-row-1')).toBeInTheDocument();
  });
});

describe('ContractEventFeed - accessibility', () => {
  it('toggle button has aria-label describing current action', () => {
    mockIsListening = true;
    renderFeed();
    expect(screen.getByLabelText(/pause event feed/i)).toBeInTheDocument();
  });

  it('toggle button label changes when paused', () => {
    renderFeed();
    expect(screen.getByLabelText(/resume event feed/i)).toBeInTheDocument();
  });

  it('event list has descriptive aria-label', () => {
    mockEvents = [makeEvent(), makeEvent()];
    renderFeed();
    expect(
      screen.getByRole('list', { name: /2 contract events/i }),
    ).toBeInTheDocument();
  });

  it('event row is a button role when clickable', () => {
    mockEvents = [makeEvent({ id: 'click-me' })];
    renderFeed({ onEventClick: vi.fn() });
    expect(
      screen.getByRole('button', { name: /view event click-me/i }),
    ).toBeInTheDocument();
  });

  it('event row is a listitem role when not clickable', () => {
    mockEvents = [makeEvent({ id: 'static' })];
    renderFeed({ onEventClick: undefined });
    expect(
      screen.queryByRole('button', { name: /view event static/i }),
    ).not.toBeInTheDocument();
  });
});

describe('ContractEventFeed - snapshot', () => {
  it('matches stable header snapshot', () => {
    mockIsListening = true;
    const { container } = renderFeed();
    const header = container.querySelector('.cef__header');
    expect(header).toMatchSnapshot();
  });
});
