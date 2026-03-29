/**
 * ContractEventFeed Component - v1
 *
 * Renders a live, ordered, deduplicated stream of Soroban contract events.
 * Supports optional virtualization for larger feeds while preserving the
 * existing small-list behavior and interactions.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContractEvents } from '../../hooks/v1/useContractEvents';
import { ErrorNotice } from './ErrorNotice';
import { EmptyStateBlock } from './EmptyStateBlock';
import { toAppError } from '../../utils/v1/errorMapper';
import {
  generateIdempotencyKey,
  InFlightRequestDedupe,
} from '../../utils/v1/idempotency';
import {
  getPersistedEventFeedFilter,
  persistEventFeedFilter,
  clearEventFeedFilter,
  deleteSavedFilterPreset,
  getSavedFilterPresets,
  saveFilterPreset,
} from '../../services/global-state-store';
import type { ContractEvent } from '../../types/contracts/events';
import type { SavedFilterPreset } from '../../types/global-state';
import './ContractEventFeed.css';

export type EventSeverity = 'info' | 'warning' | 'error' | 'success';

export interface SeverityMapping {
  [eventType: string]: EventSeverity;
}

export interface FilterChipConfig {
  label: string;
  value: string;
  active: boolean;
  count?: number;
}

export const DEFAULT_SEVERITY_MAPPING: SeverityMapping = {
  game_start: 'info',
  game_end: 'success',
  bet_placed: 'info',
  win: 'success',
  loss: 'error',
  error: 'error',
  warning: 'warning',
  transfer: 'info',
  mint: 'success',
  burn: 'warning',
};

const DEFAULT_LIST_HEIGHT_PX = 480;
const DEFAULT_VIRTUALIZATION_THRESHOLD = 120;
const DEFAULT_VIRTUAL_ITEM_HEIGHT_PX = 42;
const DEFAULT_VIRTUAL_OVERSCAN = 6;

export function getEventSeverity(
  eventType: string | undefined,
  mapping: SeverityMapping = DEFAULT_SEVERITY_MAPPING,
): EventSeverity {
  if (!eventType) return 'info';
  const normalizedType = eventType.toLowerCase().replace(/[-_]/g, '_');
  for (const [key, severity] of Object.entries(mapping)) {
    if (normalizedType.includes(key.toLowerCase().replace(/[-_]/g, '_'))) {
      return severity;
    }
  }
  return 'info';
}

export interface ContractEventFeedProps {
  contractId: string;
  eventTypeFilter?: string;
  contractSourceFilter?: string;
  timeWindowMs?: number;
  maxEvents?: number;
  pollInterval?: number;
  autoStart?: boolean;
  onEventClick?: (event: ContractEvent) => void;
  onNewEvent?: (event: ContractEvent) => void;
  eventTypeFilters?: FilterChipConfig[];
  onEventTypeFilterToggle?: (value: string) => void;
  severityMapping?: SeverityMapping;
  className?: string;
  testId?: string;
  virtualizationThreshold?: number;
  virtualizedItemHeight?: number;
  virtualizedOverscan?: number;
  /**
   * When true, the component persists the active event-type filter selection
   * to sessionStorage and restores it on remount.
   * @default false
   */
  persistFilters?: boolean;
  /**
   * Stable scope key used to isolate persisted filter state.
   * Defaults to `contractId` when not provided.
   * Use a custom value when multiple feeds share the same contractId.
   */
  feedScope?: string;
  feedMode?: 'pagination' | 'infinite';
  pageSize?: number;
  presetScope?: string;
  showFilterPresets?: boolean;
}

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'idle';

interface StatusBadgeProps {
  status: ConnectionStatus;
  testId?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, testId }) => {
  const labels: Record<ConnectionStatus, string> = {
    connected: 'Live',
    disconnected: 'Disconnected',
    reconnecting: 'Reconnecting...',
    idle: 'Idle',
  };

  return (
    <span
      className={`cef-status-badge cef-status-badge--${status}`}
      data-testid={testId ? `${testId}-status` : 'cef-status'}
      aria-live="polite"
      aria-label={`Feed status: ${labels[status]}`}
    >
      <span className="cef-status-badge__dot" aria-hidden="true" />
      {labels[status]}
    </span>
  );
};

interface EventRowProps {
  event: ContractEvent;
  onClick?: (event: ContractEvent) => void;
  severity?: EventSeverity;
  testId?: string;
}

const EventRow: React.FC<EventRowProps> = ({ event, onClick, severity, testId }) => {
  const handleClick = useCallback(() => {
    onClick?.(event);
  }, [event, onClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.(event);
      }
    },
    [event, onClick],
  );

  const timestamp = new Date(event.timestamp);
  const timeLabel = Number.isNaN(timestamp.getTime())
    ? '--'
    : timestamp.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

  const isClickable = typeof onClick === 'function';

  return (
    <li
      className={`cef-event-row${isClickable ? ' cef-event-row--clickable' : ''}${severity ? ` cef-event-row--${severity}` : ''}`}
      data-testid={testId ? `${testId}-row-${event.id}` : `cef-row-${event.id}`}
      data-event-id={event.id}
      data-event-type={event.type ?? 'unknown'}
      data-event-severity={severity ?? 'info'}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      tabIndex={isClickable ? 0 : undefined}
      role={isClickable ? 'button' : 'listitem'}
      aria-label={isClickable ? `View event ${event.id}` : undefined}
    >
      <span className="cef-event-row__time" aria-label={`Event time: ${timeLabel}`}>
        {timeLabel}
      </span>
      <span className="cef-event-row__type" aria-label={`Event type: ${event.type ?? 'unknown'}`}>
        {event.type ?? 'unknown'}
      </span>
      <span className="cef-event-row__id" title={event.id} aria-label={`Event ID: ${event.id}`}>
        {event.id.slice(0, 12)}...
      </span>
      {event.contractId && (
        <span
          className="cef-event-row__contract"
          title={event.contractId}
          aria-label={`Contract: ${event.contractId}`}
        >
          {event.contractId.slice(0, 8)}...
        </span>
      )}
    </li>
  );
};

export const ContractEventFeed: React.FC<ContractEventFeedProps> = ({
  contractId,
  eventTypeFilter,
  contractSourceFilter,
  timeWindowMs,
  maxEvents = 100,
  pollInterval = 5000,
  autoStart = true,
  onEventClick,
  onNewEvent,
  eventTypeFilters,
  onEventTypeFilterToggle,
  severityMapping = DEFAULT_SEVERITY_MAPPING,
  className = '',
  testId = 'contract-event-feed',
  virtualizationThreshold = DEFAULT_VIRTUALIZATION_THRESHOLD,
  virtualizedItemHeight = DEFAULT_VIRTUAL_ITEM_HEIGHT_PX,
  virtualizedOverscan = DEFAULT_VIRTUAL_OVERSCAN,
  persistFilters = false,
  feedScope,
  feedMode = 'pagination',
  pageSize = 25,
  presetScope,
  showFilterPresets = true,
}) => {
  // ── Filter persistence ─────────────────────────────────────────────────────
  // Stable scope key isolates persisted state so different feeds don't collide.
  const resolvedScope = feedScope ?? contractId;
  const resolvedPresetScope = presetScope ?? resolvedScope;

  // Internal active-filter state used when persistFilters=true.
  // Null means "not yet initialised" (restored from storage on first render).
  const [persistedActiveFilters, setPersistedActiveFilters] = useState<string[] | null>(null);
  const [presetName, setPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState<SavedFilterPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [visiblePages, setVisiblePages] = useState(1);
  const filterInitialisedRef = useRef(false);
  const isContractIdValid =
    typeof contractId === 'string' && contractId.trim().length > 0;

  const {
    events: rawEvents,
    isListening,
    error: hookError,
    start,
    stop,
    clear,
  } = useContractEvents({
    contractId: isContractIdValid ? contractId.trim() : '',
    autoStart: autoStart && isContractIdValid,
    pollInterval,
  });

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('idle');
  const prevListeningRef = useRef<boolean | null>(null);
  const feedDedupeRef = useRef(new InFlightRequestDedupe());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const prevEventCountRef = useRef(0);
  const listRef = useRef<HTMLOListElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_LIST_HEIGHT_PX);

  // Restore persisted filter state on mount (or when scope changes).
  useEffect(() => {
    if (!persistFilters) {
      filterInitialisedRef.current = true;
      return;
    }
    const restored = getPersistedEventFeedFilter(resolvedScope);
    setPersistedActiveFilters(restored ?? []);
    filterInitialisedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistFilters, resolvedScope]);

  useEffect(() => {
    setSavedPresets(getSavedFilterPresets(resolvedPresetScope));
  }, [resolvedPresetScope]);

  useEffect(() => {
    const prev = prevListeningRef.current;

    if (isListening) {
      setConnectionStatus('connected');
    } else if (hookError && prev === true) {
      setConnectionStatus('reconnecting');
    } else if (!isListening && prev === null) {
      setConnectionStatus('idle');
    } else if (!isListening) {
      setConnectionStatus('disconnected');
    }

    prevListeningRef.current = isListening;
  }, [isListening, hookError]);

  const filteredEvents = useMemo(() => {
    if (!Array.isArray(rawEvents)) return [];

    const now = Date.now();
    const dedupe = feedDedupeRef.current;
    const batchSeen = new Set<string>();

    const uniqueEvents = rawEvents.filter((event): event is ContractEvent => {
      if (!event || typeof event.id !== 'string') return false;
      if (batchSeen.has(event.id)) return false;
      batchSeen.add(event.id);

      const keyResult = generateIdempotencyKey({
        operation: 'contractEventFeed.event',
        scope: contractId,
        payload: { id: event.id },
      });

      if (!keyResult.success || !keyResult.key) return false;

      const registration = dedupe.register(keyResult.key, { ttlMs: 60_000 });
      if (!registration.accepted && !seenIdsRef.current.has(event.id)) return false;

      seenIdsRef.current.add(event.id);
      return true;
    });

    return uniqueEvents
      .filter((event) => {
        if (
          eventTypeFilter !== undefined &&
          eventTypeFilter.trim() !== '' &&
          typeof event.type === 'string' &&
          event.type.toLowerCase() !== eventTypeFilter.trim().toLowerCase()
        ) {
          return false;
        }

        if (
          contractSourceFilter !== undefined &&
          contractSourceFilter.trim() !== '' &&
          event.contractId !== contractSourceFilter.trim()
        ) {
          return false;
        }

        if (timeWindowMs !== undefined && timeWindowMs > 0) {
          const ts =
            typeof event.timestamp === 'string' || typeof event.timestamp === 'number'
              ? new Date(event.timestamp).getTime()
              : Number.NaN;

          if (Number.isNaN(ts) || now - ts > timeWindowMs) return false;
        }

        return true;
      })
      .slice(0, maxEvents);
  }, [
    rawEvents,
    contractId,
    eventTypeFilter,
    contractSourceFilter,
    timeWindowMs,
    maxEvents,
  ]);

  useEffect(() => {
    setCurrentPage(1);
    setVisiblePages(1);
  }, [feedMode, filteredEvents, pageSize]);

  useEffect(() => {
    if (!onNewEvent) return;
    const newCount = filteredEvents.length - prevEventCountRef.current;
    if (newCount > 0) {
      filteredEvents.slice(0, newCount).forEach((event) => onNewEvent(event));
    }
    prevEventCountRef.current = filteredEvents.length;
  }, [filteredEvents, onNewEvent]);

  const mappedError = useMemo(() => {
    if (!hookError) return null;
    return toAppError(hookError, 'rpc');
  }, [hookError]);

  const handleToggle = useCallback(() => {
    if (isListening) {
      stop();
      return;
    }
    start();
  }, [isListening, start, stop]);

  const handleClear = useCallback(() => {
    seenIdsRef.current.clear();
    feedDedupeRef.current = new InFlightRequestDedupe();
    prevEventCountRef.current = 0;
    setScrollTop(0);
    if (persistFilters) {
      clearEventFeedFilter(resolvedScope);
      setPersistedActiveFilters([]);
    }
    clear();
  }, [clear, persistFilters, resolvedScope]);

  const currentActiveFilters = useMemo(() => {
    if (persistFilters && persistedActiveFilters !== null) {
      return persistedActiveFilters;
    }
    return (eventTypeFilters ?? [])
      .filter((filter) => filter.active)
      .map((filter) => filter.value);
  }, [eventTypeFilters, persistFilters, persistedActiveFilters]);

  /**
   * Persistence-aware filter toggle handler.
   * When persistFilters=true, updates internal persisted state and writes to
   * sessionStorage before forwarding the call to the external callback.
   */
  const handleFilterToggle = useCallback(
    (value: string) => {
      if (persistFilters) {
        setPersistedActiveFilters((prev) => {
          const current = prev ?? [];
          const next = current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value];
          persistEventFeedFilter(resolvedScope, next);
          return next;
        });
      }
      onEventTypeFilterToggle?.(value);
    },
    [persistFilters, resolvedScope, onEventTypeFilterToggle],
  );

  const applyPresetValues = useCallback(
    (values: string[]) => {
      const nextValues = values.filter((value): value is string => typeof value === 'string');
      const currentValues = new Set(currentActiveFilters);
      const targetValues = new Set(nextValues);
      const knownValues = new Set((eventTypeFilters ?? []).map((filter) => filter.value));

      knownValues.forEach((value) => {
        const shouldBeActive = targetValues.has(value);
        const isActive = currentValues.has(value);
        if (shouldBeActive !== isActive) {
          onEventTypeFilterToggle?.(value);
        }
      });

      if (persistFilters) {
        persistEventFeedFilter(resolvedScope, nextValues);
        setPersistedActiveFilters(nextValues);
      }
    },
    [currentActiveFilters, eventTypeFilters, onEventTypeFilterToggle, persistFilters, resolvedScope],
  );

  const handleSavePreset = useCallback(() => {
    const saved = saveFilterPreset(resolvedPresetScope, presetName, currentActiveFilters);
    if (!saved) {
      return;
    }

    const nextPresets = getSavedFilterPresets(resolvedPresetScope);
    setSavedPresets(nextPresets);
    setSelectedPresetId(saved.id);
    setPresetName('');
  }, [currentActiveFilters, presetName, resolvedPresetScope]);

  const handleRestorePreset = useCallback(() => {
    const preset = savedPresets.find((entry) => entry.id === selectedPresetId);
    if (!preset) {
      return;
    }
    applyPresetValues(preset.values);
  }, [applyPresetValues, savedPresets, selectedPresetId]);

  const handleDeletePreset = useCallback(() => {
    if (!selectedPresetId) {
      return;
    }
    deleteSavedFilterPreset(resolvedPresetScope, selectedPresetId);
    const nextPresets = getSavedFilterPresets(resolvedPresetScope);
    setSavedPresets(nextPresets);
    setSelectedPresetId('');
  }, [resolvedPresetScope, selectedPresetId]);
  const totalPages =
    filteredEvents.length > 0 ? Math.ceil(filteredEvents.length / pageSize) : 0;
  const hasNextPage =
    feedMode === 'infinite'
      ? visiblePages < totalPages
      : currentPage < totalPages;
  const hasPreviousPage = feedMode === 'pagination' && currentPage > 1;
  const renderedEvents =
    feedMode === 'infinite'
      ? filteredEvents.slice(0, visiblePages * pageSize)
      : filteredEvents.slice(
          Math.max(0, (currentPage - 1) * pageSize),
          Math.max(0, (currentPage - 1) * pageSize) + pageSize,
        );

  const shouldVirtualize =
    renderedEvents.length >= virtualizationThreshold &&
    virtualizedItemHeight > 0;

  useEffect(() => {
    const listNode = listRef.current;
    if (!listNode) return;
    setViewportHeight(listNode.clientHeight || DEFAULT_LIST_HEIGHT_PX);
  }, [shouldVirtualize, renderedEvents.length]);

  useEffect(() => {
    if (!shouldVirtualize) {
      setScrollTop(0);
    }
  }, [shouldVirtualize]);

  const virtualizationWindow = useMemo(() => {
    if (!shouldVirtualize) {
      return {
        startIndex: 0,
        endIndex: renderedEvents.length,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      };
    }

    const visibleCount = Math.max(
      1,
      Math.ceil(viewportHeight / virtualizedItemHeight),
    );
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / virtualizedItemHeight) - virtualizedOverscan,
    );
    const endIndex = Math.min(
      renderedEvents.length,
      startIndex + visibleCount + virtualizedOverscan * 2,
    );

    return {
      startIndex,
      endIndex,
      topSpacerHeight: startIndex * virtualizedItemHeight,
      bottomSpacerHeight:
        Math.max(0, renderedEvents.length - endIndex) * virtualizedItemHeight,
    };
  }, [
    renderedEvents.length,
    scrollTop,
    shouldVirtualize,
    viewportHeight,
    virtualizedItemHeight,
    virtualizedOverscan,
  ]);

  const visibleEvents = shouldVirtualize
    ? renderedEvents.slice(
        virtualizationWindow.startIndex,
        virtualizationWindow.endIndex,
      )
    : renderedEvents;

  const handleListScroll = useCallback(
    (event: React.UIEvent<HTMLOListElement>) => {
      const nextScrollTop = event.currentTarget.scrollTop;
      const nextViewportHeight =
        event.currentTarget.clientHeight || DEFAULT_LIST_HEIGHT_PX;

      if (shouldVirtualize) {
        setScrollTop(nextScrollTop);
        setViewportHeight(nextViewportHeight);
      }

      if (
        feedMode === 'infinite' &&
        hasNextPage
      ) {
        const distanceFromBottom =
          event.currentTarget.scrollHeight - (nextScrollTop + nextViewportHeight);
        if (distanceFromBottom <= 96) {
          setVisiblePages((prev) => Math.min(totalPages, prev + 1));
        }
      }
    },
    [feedMode, hasNextPage, shouldVirtualize, totalPages],
  );

  if (!isContractIdValid) {
    return (
      <div className={`cef cef--invalid ${className}`.trim()} data-testid={testId}>
        <EmptyStateBlock
          icon="!"
          title="Invalid Contract"
          description="A valid contract ID is required to subscribe to events."
          testId={`${testId}-invalid`}
        />
      </div>
    );
  }

  const rootClasses = [
    'cef',
    isListening ? 'cef--listening' : 'cef--paused',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={rootClasses}
      data-testid={testId}
      aria-label="Contract Event Feed"
    >
      <header className="cef__header">
        <div className="cef__header-left">
          <h2 className="cef__title">Contract Events</h2>
          <StatusBadge status={connectionStatus} testId={testId} />
        </div>

        <div className="cef__header-right">
          <span className="cef__count" aria-live="polite" aria-atomic="true">
            {filteredEvents.length > 0
              ? `${filteredEvents.length} event${filteredEvents.length !== 1 ? 's' : ''}`
              : ''}
          </span>

          <button
            type="button"
            className={`cef__toggle-btn cef__toggle-btn--${isListening ? 'pause' : 'resume'}`}
            onClick={handleToggle}
            aria-label={isListening ? 'Pause event feed' : 'Resume event feed'}
            data-testid={`${testId}-toggle`}
          >
            {isListening ? 'Pause' : 'Resume'}
          </button>

          <button
            type="button"
            className="cef__clear-btn"
            onClick={handleClear}
            aria-label="Clear all events"
            data-testid={`${testId}-clear`}
            disabled={filteredEvents.length === 0}
          >
            Clear
          </button>
        </div>
      </header>

      {(eventTypeFilter ||
        contractSourceFilter ||
        timeWindowMs ||
        (eventTypeFilters && eventTypeFilters.length > 0)) && (
        <div
          className="cef__filters"
          aria-label="Active filters"
          data-testid={`${testId}-filters`}
        >
          {eventTypeFilters &&
            eventTypeFilters.length > 0 &&
            eventTypeFilters.map((filter) => {
              // When persistFilters=true, derive active state from internal
              // persisted storage instead of the external prop, so filter
              // selections survive remounts and refreshes within the session.
              const isActive = persistFilters && persistedActiveFilters !== null
                ? persistedActiveFilters.includes(filter.value)
                : filter.active;
              return (
                <button
                  key={filter.value}
                  type="button"
                  className={`cef__filter-chip cef__filter-chip--toggle${isActive ? ' cef__filter-chip--active' : ''}`}
                  onClick={() => handleFilterToggle(filter.value)}
                  aria-pressed={isActive}
                  data-testid={`${testId}-filter-${filter.value}`}
                >
                  {filter.label}
                  {filter.count !== undefined && (
                    <span className="cef__filter-chip__count">{filter.count}</span>
                  )}
                </button>
              );
            })}
          {eventTypeFilter && !eventTypeFilters && (
            <span className="cef__filter-chip">
              type: <strong>{eventTypeFilter}</strong>
            </span>
          )}
          {contractSourceFilter && (
            <span className="cef__filter-chip">
              source: <strong>{contractSourceFilter.slice(0, 10)}...</strong>
            </span>
          )}
          {timeWindowMs && (
            <span className="cef__filter-chip">
              window: <strong>{timeWindowMs / 1000}s</strong>
            </span>
          )}
        </div>
      )}

      {showFilterPresets && eventTypeFilters && eventTypeFilters.length > 0 && (
        <div className="cef__presets" data-testid={`${testId}-presets`}>
          <label className="cef__preset-field">
            <span className="cef__preset-label">Preset name</span>
            <input
              type="text"
              className="cef__preset-input"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="High-signal wins"
              data-testid={`${testId}-preset-name`}
            />
          </label>
          <button
            type="button"
            className="cef__preset-button"
            onClick={handleSavePreset}
            disabled={!presetName.trim() || currentActiveFilters.length === 0}
            data-testid={`${testId}-preset-save`}
          >
            Save preset
          </button>
          <label className="cef__preset-field">
            <span className="cef__preset-label">Saved presets</span>
            <select
              className="cef__preset-select"
              value={selectedPresetId}
              onChange={(event) => setSelectedPresetId(event.target.value)}
              data-testid={`${testId}-preset-select`}
            >
              <option value="">Select preset</option>
              {savedPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="cef__preset-button"
            onClick={handleRestorePreset}
            disabled={!selectedPresetId}
            data-testid={`${testId}-preset-restore`}
          >
            Restore
          </button>
          <button
            type="button"
            className="cef__preset-button cef__preset-button--danger"
            onClick={handleDeletePreset}
            disabled={!selectedPresetId}
            data-testid={`${testId}-preset-delete`}
          >
            Delete
          </button>
        </div>
      )}

      {mappedError && (
        <ErrorNotice
          error={mappedError}
          onRetry={start}
          showRetry={true}
          showDismiss={false}
          testId={`${testId}-error`}
        />
      )}

      {renderedEvents.length > 0 ? (
        <>
          <span className="cef__sr-only" aria-live="polite" data-testid={`${testId}-virtualization`}>
            {shouldVirtualize
              ? `Virtualized list showing ${visibleEvents.length} rows out of ${renderedEvents.length}.`
              : 'Standard list rendering active.'}
          </span>
          <ol
            ref={listRef}
            className={`cef__event-list${shouldVirtualize ? ' cef__event-list--virtualized' : ''}`}
            aria-label={`${renderedEvents.length} contract events`}
            data-testid={`${testId}-list`}
            data-virtualized={shouldVirtualize ? 'true' : 'false'}
            reversed={!shouldVirtualize}
            onScroll={handleListScroll}
          >
            {shouldVirtualize && virtualizationWindow.topSpacerHeight > 0 && (
              <li
                className="cef__virtual-spacer"
                aria-hidden="true"
                style={{ height: `${virtualizationWindow.topSpacerHeight}px` }}
              />
            )}

            {visibleEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                onClick={onEventClick}
                severity={getEventSeverity(event.type, severityMapping)}
                testId={testId}
              />
            ))}

            {shouldVirtualize && virtualizationWindow.bottomSpacerHeight > 0 && (
              <li
                className="cef__virtual-spacer"
                aria-hidden="true"
                style={{ height: `${virtualizationWindow.bottomSpacerHeight}px` }}
              />
            )}
          </ol>
          {feedMode === 'pagination' && totalPages > 1 && (
            <div className="cef__pager" data-testid={`${testId}-pager`}>
              <button
                type="button"
                className="cef__preset-button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={!hasPreviousPage}
                data-testid={`${testId}-page-prev`}
              >
                Previous
              </button>
              <span className="cef__pager-label" data-testid={`${testId}-page-label`}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="cef__preset-button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={!hasNextPage}
                data-testid={`${testId}-page-next`}
              >
                Next
              </button>
            </div>
          )}
          {feedMode === 'infinite' && (
            <div className="cef__feed-status" data-testid={`${testId}-feed-status`}>
              {hasNextPage
                ? 'Scroll to load more events.'
                : 'End of event feed'}
            </div>
          )}
        </>
      ) : (
        !mappedError && (
          <EmptyStateBlock
            icon={isListening ? 'radio' : 'pause'}
            title={isListening ? 'Listening for events...' : 'Feed paused'}
            description={
              isListening
                ? 'Events will appear here as they are emitted by the contract.'
                : 'Press Resume to start receiving contract events.'
            }
            testId={`${testId}-empty`}
          />
        )
      )}
    </section>
  );
};

ContractEventFeed.displayName = 'ContractEventFeed';

export default ContractEventFeed;
