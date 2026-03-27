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
}

const StatusCard: React.FC<StatusCardProps> = ({
  id,
  name,
  status,
  wager,
  tone = 'neutral',
  beforeSlot,
  afterSlot,
}: StatusCardProps) => {
  return (
    <div className={`status-card tone-${tone}`} data-testid="status-card">
      <div className="status-indicator"></div>
      <div className="card-header">
        <div className="flex items-center gap-2">
          {beforeSlot}
          <h3>{name}</h3>
        </div>
        <span className="game-id">#{id.slice(0, 8)}</span>
      </div>
      <div className="card-body">
        <div className="status-label">{status.toUpperCase()}</div>
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
