import React, { ReactNode } from 'react';
import type { StatusToneVariant } from '../../types/status-tone';

interface StatusCardProps {
  id: string;
  name: string;
  status: string;
  wager?: number;
  tone?: StatusToneVariant;
  beforeSlot?: ReactNode;
  afterSlot?: ReactNode;
  isStale?: boolean;
}

const StatusCard: React.FC<StatusCardProps> = ({
  id,
  name,
  status,
  wager,
  tone = 'neutral',
  beforeSlot,
  afterSlot,
  isStale = false,
}: StatusCardProps) => {
  return (
    <div className={`status-card tone-${tone} ${isStale ? 'is-stale opacity-75' : ''}`} data-testid="status-card">
      <div className="status-indicator"></div>
      <div className="card-header">
        <div className="flex items-center gap-2">
          {beforeSlot}
          <h3>{name}</h3>
        </div>
        <span className="game-id">#{id.slice(0, 8)}</span>
      </div>
      <div className="card-body">
        <div className="status-label">
          {status.toUpperCase()}
          {isStale && (
            <span 
              className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded border border-amber-200 uppercase"
              data-testid="status-card-stale-badge"
            >
              Stale
            </span>
          )}
        </div>
        {wager && <div className="wager-amount">{wager} XLM</div>}
      </div>
      <div className="card-footer flex justify-between items-center">
        <button className="btn-play">Join Game</button>
        {afterSlot}
      </div>
    </div>
  );
};

export default StatusCard;
