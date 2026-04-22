import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContractEventFeed, eventToTimelineItem } from '@/components/v1/ContractEventFeed';
import type { ContractEventFeedProps } from '@/components/v1/ContractEventFeed';
import type { ContractEvent } from '@/types/contracts/events';
import {
  getPersistedEventFeedFilter,
  persistEventFeedFilter,
  clearEventFeedFilter,
  getSavedFilterPresets,
  recordRecentFilter,
  getRecentFilters,
  getTableDensityPreference,
} from '@/services/global-state-store';
import { Timeline } from '@/components/v1/Timeline';
import type { TimelineItemData } from '@/components/v1/Timeline';

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
  sessionStorage.clear();
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

// ── Filter persistence ─────────────────────────────────────────────────────────

const filterChips: ContractEventFeedProps['eventTypeFilters'] = [
  { label: 'Coin Flip', value: 'coin_flip', active: false },
  { label: 'Transfer', value: 'transfer', active: false },
];

describe('ContractEventFeed - filter persistence', () => {
  it('persists active filter to sessionStorage when persistFilters=true and a chip is clicked', () => {
    const onToggle = vi.fn();
    renderFeed({
      eventTypeFilters: filterChips,
      onEventTypeFilterToggle: onToggle,
      persistFilters: true,
      feedScope: 'test-scope-persist',
    });

    fireEvent.click(screen.getByTestId('contract-event-feed-filter-coin_flip'));

    const stored = getPersistedEventFeedFilter('test-scope-persist');
    expect(stored).toContain('coin_flip');
    // External callback still fires
    expect(onToggle).toHaveBeenCalledWith('coin_flip');
  });

  it('restores persisted filter state on remount', () => {
    persistEventFeedFilter('restore-scope', ['transfer']);

    renderFeed({
      eventTypeFilters: filterChips,
      persistFilters: true,
      feedScope: 'restore-scope',
    });

    // The restored chip should render as active (aria-pressed="true")
    const transferBtn = screen.getByTestId('contract-event-feed-filter-transfer');
    expect(transferBtn).toHaveAttribute('aria-pressed', 'true');

    // The non-restored chip should be inactive
    const coinFlipBtn = screen.getByTestId('contract-event-feed-filter-coin_flip');
    expect(coinFlipBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('different feedScopes do not share filter state', () => {
    persistEventFeedFilter('scope-a', ['coin_flip']);
    persistEventFeedFilter('scope-b', ['transfer']);

    const storedA = getPersistedEventFeedFilter('scope-a');
    const storedB = getPersistedEventFeedFilter('scope-b');

    expect(storedA).toContain('coin_flip');
    expect(storedA).not.toContain('transfer');
    expect(storedB).toContain('transfer');
    expect(storedB).not.toContain('coin_flip');
  });

  it('default filter behavior is unchanged when persistFilters=false', () => {
    renderFeed({
      eventTypeFilters: [
        { label: 'Coin Flip', value: 'coin_flip', active: true },
        { label: 'Transfer', value: 'transfer', active: false },
      ],
      persistFilters: false,
    });

    // active prop from parent is respected
    expect(screen.getByTestId('contract-event-feed-filter-coin_flip')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('contract-event-feed-filter-transfer')).toHaveAttribute('aria-pressed', 'false');
  });

  it('clears persisted filter state when clear button is clicked', () => {
    persistEventFeedFilter('clear-scope', ['coin_flip']);
    mockEvents = [makeEvent()];

    renderFeed({
      eventTypeFilters: filterChips,
      persistFilters: true,
      feedScope: 'clear-scope',
    });

    fireEvent.click(screen.getByTestId('contract-event-feed-clear'));
    expect(mockClear).toHaveBeenCalledTimes(1);

    const stored = getPersistedEventFeedFilter('clear-scope');
    // After clear, the persisted entry is removed — same as first-time visitor
    expect(stored).toBeNull();
  });

  it('returns null for scope with no persisted state (first-time visitor)', () => {
    const stored = getPersistedEventFeedFilter('brand-new-scope');
    expect(stored).toBeNull();
  });

  it('clearEventFeedFilter removes persisted state for a scope', () => {
    persistEventFeedFilter('to-clear', ['coin_flip']);
    clearEventFeedFilter('to-clear');
    expect(getPersistedEventFeedFilter('to-clear')).toBeNull();
  });

  it('saves, restores, and deletes named filter presets for the active scope', () => {
    const onToggle = vi.fn();
    renderFeed({
      eventTypeFilters: filterChips,
      onEventTypeFilterToggle: onToggle,
      persistFilters: true,
      feedScope: 'preset-scope',
    });

    fireEvent.click(screen.getByTestId('contract-event-feed-filter-coin_flip'));
    fireEvent.change(screen.getByTestId('contract-event-feed-preset-name'), {
      target: { value: 'My Preset' },
    });
    fireEvent.click(screen.getByTestId('contract-event-feed-preset-save'));

    expect(getSavedFilterPresets('preset-scope')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('contract-event-feed-filter-coin_flip'));
    expect(screen.getByTestId('contract-event-feed-filter-coin_flip')).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    fireEvent.change(screen.getByTestId('contract-event-feed-preset-select'), {
      target: { value: 'preset-scope::my-preset' },
    });
    fireEvent.click(screen.getByTestId('contract-event-feed-preset-restore'));
    expect(screen.getByTestId('contract-event-feed-filter-coin_flip')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByTestId('contract-event-feed-preset-delete'));
    expect(getSavedFilterPresets('preset-scope')).toEqual([]);
  });

  it('keeps named presets isolated between scopes', () => {
    renderFeed({
      eventTypeFilters: filterChips,
      persistFilters: true,
      feedScope: 'scope-a',
    });

    fireEvent.click(screen.getByTestId('contract-event-feed-filter-coin_flip'));
    fireEvent.change(screen.getByTestId('contract-event-feed-preset-name'), {
      target: { value: 'Scope A' },
    });
    fireEvent.click(screen.getByTestId('contract-event-feed-preset-save'));

    renderFeed({
      eventTypeFilters: filterChips,
      persistFilters: true,
      feedScope: 'scope-b',
      testId: 'scope-b-feed',
    });

    expect(getSavedFilterPresets('scope-a')).toHaveLength(1);
    expect(getSavedFilterPresets('scope-b')).toEqual([]);
  });
});

describe('ContractEventFeed - feed modes', () => {
  it('loads more rows in infinite-scroll mode and announces the end of the list', async () => {
    mockEvents = Array.from({ length: 5 }, (_, index) =>
      makeEvent({ id: `inf-${index}` }),
    );

    renderFeed({
      feedMode: 'infinite',
      pageSize: 2,
    });

    expect(screen.getAllByTestId(/contract-event-feed-row-inf-/)).toHaveLength(2);

    const list = screen.getByTestId('contract-event-feed-list');
    Object.defineProperty(list, 'scrollHeight', { value: 400, configurable: true });
    Object.defineProperty(list, 'clientHeight', { value: 200, configurable: true });

    fireEvent.scroll(list, { target: { scrollTop: 220 } });
    await waitFor(() => {
      expect(screen.getAllByTestId(/contract-event-feed-row-inf-/)).toHaveLength(4);
    });

    fireEvent.scroll(list, { target: { scrollTop: 220 } });
    await waitFor(() => {
      expect(screen.getAllByTestId(/contract-event-feed-row-inf-/)).toHaveLength(5);
      expect(screen.getByTestId('contract-event-feed-feed-status')).toHaveTextContent(
        /end of event feed/i,
      );
    });
  });

  it('keeps explicit pagination available when feedMode=pagination', async () => {
    mockEvents = Array.from({ length: 5 }, (_, index) =>
      makeEvent({ id: `page-${index}` }),
    );

    renderFeed({
      feedMode: 'pagination',
      pageSize: 2,
    });

    expect(screen.getByTestId('contract-event-feed-pager')).toBeInTheDocument();
    expect(screen.getByTestId('contract-event-feed-page-label')).toHaveTextContent(
      /page 1 of 3/i,
    );

    fireEvent.click(screen.getByTestId('contract-event-feed-page-next'));
    await waitFor(() => {
      expect(screen.getByTestId('contract-event-feed-page-label')).toHaveTextContent(
        /page 2 of 3/i,
      );
    });
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

// ── Timeline integration ───────────────────────────────────────────────────

describe('ContractEventFeed - timeline composition', () => {
  it('event list carries sc-timeline--vertical class for timeline composition', () => {
    mockEvents = [makeEvent({ id: 'tl-1' }), makeEvent({ id: 'tl-2' })];
    renderFeed();
    const list = screen.getByTestId('contract-event-feed-list');
    expect(list.classList.contains('sc-timeline')).toBe(true);
    expect(list.classList.contains('sc-timeline--vertical')).toBe(true);
  });

  it('event list items render in chronological order (oldest first in ol[reversed])', () => {
    const t1 = new Date('2025-06-01T10:00:00Z').toISOString();
    const t2 = new Date('2025-06-01T11:00:00Z').toISOString();
    mockEvents = [
      makeEvent({ id: 'older', timestamp: t1 }),
      makeEvent({ id: 'newer', timestamp: t2 }),
    ];
    renderFeed();
    const list = screen.getByTestId('contract-event-feed-list');
    const items = Array.from(list.querySelectorAll('li[data-event-id]'));
    expect(items[0].getAttribute('data-event-id')).toBe('older');
    expect(items[1].getAttribute('data-event-id')).toBe('newer');
  });
});

// ── Timeline component unit tests ─────────────────────────────────────────

describe('Timeline component', () => {
  const items: TimelineItemData[] = [
    { id: 'step-1', label: 'Submitted', status: 'completed', timestamp: '10:00:00' },
    { id: 'step-2', label: 'Pending', status: 'active' },
    { id: 'step-3', label: 'Confirmed', status: 'idle' },
  ];

  it('renders all items', () => {
    render(<Timeline items={items} testId="tl" />);
    expect(screen.getByTestId('tl-item-step-1')).toBeInTheDocument();
    expect(screen.getByTestId('tl-item-step-2')).toBeInTheDocument();
    expect(screen.getByTestId('tl-item-step-3')).toBeInTheDocument();
  });

  it('renders items in provided order', () => {
    render(<Timeline items={items} testId="tl-order" />);
    const list = screen.getByTestId('tl-order');
    const rendered = Array.from(list.querySelectorAll('[data-status]'));
    expect(rendered[0].getAttribute('data-status')).toBe('completed');
    expect(rendered[1].getAttribute('data-status')).toBe('active');
    expect(rendered[2].getAttribute('data-status')).toBe('idle');
  });

  it('applies correct status data attribute to each item', () => {
    render(<Timeline items={items} testId="tl-status" />);
    expect(screen.getByTestId('tl-status-item-step-1')).toHaveAttribute('data-status', 'completed');
    expect(screen.getByTestId('tl-status-item-step-2')).toHaveAttribute('data-status', 'active');
  });

  it('renders timestamp slot when provided', () => {
    render(<Timeline items={items} testId="tl-ts" />);
    expect(screen.getByTestId('tl-ts-item-step-1-timestamp')).toHaveTextContent('10:00:00');
  });

  it('omits timestamp slot when not provided', () => {
    render(<Timeline items={items} testId="tl-nots" />);
    expect(screen.queryByTestId('tl-nots-item-step-2-timestamp')).not.toBeInTheDocument();
  });

  it('renders metadata slot when provided', () => {
    const withMeta: TimelineItemData[] = [
      { id: 'm1', label: 'Event', status: 'idle', metadata: 'CABC1234' },
    ];
    render(<Timeline items={withMeta} testId="tl-meta" />);
    expect(screen.getByTestId('tl-meta-item-m1-metadata')).toHaveTextContent('CABC1234');
  });

  it('uses horizontal orientation class', () => {
    render(<Timeline items={items} orientation="horizontal" testId="tl-h" />);
    expect(screen.getByTestId('tl-h').classList.contains('sc-timeline--horizontal')).toBe(true);
  });

  it('uses vertical orientation class by default', () => {
    render(<Timeline items={items} testId="tl-v" />);
    expect(screen.getByTestId('tl-v').classList.contains('sc-timeline--vertical')).toBe(true);
  });

  it('applies compact class when compact=true', () => {
    render(<Timeline items={items} compact testId="tl-c" />);
    expect(screen.getByTestId('tl-c').classList.contains('sc-timeline--compact')).toBe(true);
  });

  it('renders empty list without crashing when items is empty', () => {
    render(<Timeline items={[]} testId="tl-empty" />);
    expect(screen.getByTestId('tl-empty')).toBeInTheDocument();
    expect(screen.getByTestId('tl-empty').querySelectorAll('li').length).toBe(0);
  });
});

// ── eventToTimelineItem adapter ────────────────────────────────────────────

describe('eventToTimelineItem', () => {
  it('maps event id to timeline item id', () => {
    const event: ContractEvent = {
      id: 'evt-xyz',
      type: 'transfer',
      contractId: 'CXYZ1234',
      timestamp: new Date('2025-01-01T09:30:00Z').toISOString(),
      data: null,
    };
    const item = eventToTimelineItem(event);
    expect(item.id).toBe('evt-xyz');
  });

  it('maps event type to timeline label', () => {
    const event: ContractEvent = {
      id: 'e1',
      type: 'game_end',
      contractId: undefined,
      timestamp: new Date().toISOString(),
      data: null,
    };
    expect(eventToTimelineItem(event).label).toBe('game_end');
  });

  it('falls back to "unknown" label when event type is undefined', () => {
    const event: ContractEvent = {
      id: 'e2',
      type: undefined as unknown as string,
      contractId: undefined,
      timestamp: new Date().toISOString(),
      data: null,
    };
    expect(eventToTimelineItem(event).label).toBe('unknown');
  });

  it('sets timestamp to null when timestamp is invalid', () => {
    const event: ContractEvent = {
      id: 'e3',
      type: 'win',
      contractId: undefined,
      timestamp: 'not-a-date',
      data: null,
    };
    expect(eventToTimelineItem(event).timestamp).toBeNull();
  });

  it('includes truncated contractId as metadata', () => {
    const event: ContractEvent = {
      id: 'e4',
      type: 'mint',
      contractId: 'CABCDEFGHIJ1234567890',
      timestamp: new Date().toISOString(),
      data: null,
    };
    const item = eventToTimelineItem(event);
    expect(item.metadata).toBe('CABCDEFGHI');
  });

  it('sets metadata to null when contractId is absent', () => {
    const event: ContractEvent = {
      id: 'e5',
      type: 'burn',
      contractId: undefined,
      timestamp: new Date().toISOString(),
      data: null,
    };
    expect(eventToTimelineItem(event).metadata).toBeNull();
  });
});

describe('ContractEventFeed - density preference', () => {
  it('toggles compact density and persists the preference', () => {
    mockEvents = [makeEvent({ id: 'density-1' })];

    renderFeed({ densityScope: 'events-density-scope' });

    fireEvent.click(screen.getByTestId('contract-event-feed-density-compact'));

    expect(screen.getByTestId('contract-event-feed')).toHaveClass('cef--compact');
    expect(screen.getByTestId('contract-event-feed-density-compact')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(getTableDensityPreference('events-density-scope')).toBe('compact');
  });

  it('restores persisted compact density on remount', () => {
    localStorage.setItem('stc_table_density_v1_events-density-restore', 'compact');

    renderFeed({ densityScope: 'events-density-restore' });

    expect(screen.getByTestId('contract-event-feed')).toHaveClass('cef--compact');
    expect(screen.getByTestId('contract-event-feed-density-compact')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

// ── Recent filter chip rail (#478) ────────────────────────────────────────

describe('ContractEventFeed - recent filter chip rail (#478)', () => {
  it('renders recent filter chips when persistFilters=true and filters have been recorded', () => {
    recordRecentFilter('recent-scope', ['coin_flip'], 'Coin Flip');

    renderFeed({
      eventTypeFilters: filterChips,
      persistFilters: true,
      feedScope: 'recent-scope',
    });

    expect(screen.getByTestId('contract-event-feed-recent-filters')).toBeInTheDocument();
    expect(screen.getByTestId('contract-event-feed-recent-chip-0')).toHaveTextContent('Coin Flip');
  });

  it('does not render chip rail when showRecentFilters=false', () => {
    recordRecentFilter('hidden-scope', ['coin_flip']);

    renderFeed({
      eventTypeFilters: filterChips,
      persistFilters: true,
      feedScope: 'hidden-scope',
      showRecentFilters: false,
    });

    expect(screen.queryByTestId('contract-event-feed-recent-filters')).not.toBeInTheDocument();
  });

  it('applies a recent filter when a chip is clicked', () => {
    recordRecentFilter('apply-scope', ['transfer'], 'Transfer');

    const onToggle = vi.fn();
    renderFeed({
      eventTypeFilters: filterChips,
      onEventTypeFilterToggle: onToggle,
      persistFilters: true,
      feedScope: 'apply-scope',
    });

    fireEvent.click(screen.getByTestId('contract-event-feed-recent-chip-0'));
    expect(onToggle).toHaveBeenCalledWith('transfer');
  });

  it('recent filter history is bounded and deterministic', () => {
    for (let i = 0; i < 12; i++) {
      recordRecentFilter('bound-scope', [`filter-${i}`]);
    }

    const result = getRecentFilters('bound-scope');
    expect(result.length).toBeLessThanOrEqual(8);
    // Most recently recorded appears first
    expect(result[0].values).toEqual(['filter-11']);
  });

  it('clears recent filters when clear button is clicked', () => {
    recordRecentFilter('clear-recent-scope', ['coin_flip']);

    renderFeed({
      eventTypeFilters: filterChips,
      persistFilters: true,
      feedScope: 'clear-recent-scope',
    });

    expect(screen.getByTestId('contract-event-feed-recent-filters')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('contract-event-feed-recent-clear'));
    expect(screen.queryByTestId('contract-event-feed-recent-filters')).not.toBeInTheDocument();
    expect(getRecentFilters('clear-recent-scope')).toEqual([]);
  });

  it('chip rail has role=toolbar for accessibility', () => {
    recordRecentFilter('a11y-scope', ['coin_flip']);

    renderFeed({
      eventTypeFilters: filterChips,
      persistFilters: true,
      feedScope: 'a11y-scope',
    });

    expect(screen.getByRole('toolbar', { name: /recent filters/i })).toBeInTheDocument();
  });
});
