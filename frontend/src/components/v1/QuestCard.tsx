/**
 * QuestCard Component
 *
 * Displays a quest with progress indicator for enrolled users.
 * Shows progress bar for enrolled quests and enrollment CTA for others.
 * When all milestones are complete, shows certificate claim CTA.
 *
 * @module components/v1/QuestCard
 */

import React, { useMemo } from 'react';
import type { QuestCardProps, QuestProgress } from '../../types/v1/quest';
import { QuestProgressBar } from './QuestProgressBar';
import './QuestCard.css';

/**
 * Calculates quest progress from milestones.
 */
function calculateQuestProgress(milestones: Array<{ completed: boolean }>): QuestProgress {
  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter((m) => m.completed).length;
  const percentage = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;
  const isComplete = percentage >= 100;

  return {
    completedMilestones,
    totalMilestones,
    percentage,
    isComplete,
  };
}

/**
 * QuestCard — quest display with progress tracking.
 *
 * Shows quest information with a progress bar for enrolled users.
 * Displays enrollment CTA for non-enrolled quests.
 * When all milestones are complete, shows certificate claim CTA.
 *
 * @example
 * ```tsx
 * // Basic quest card
 * <QuestCard quest={questData} />
 *
 * // With callbacks
 * <QuestCard
 *   quest={questData}
 *   onEnroll={() => handleEnroll(questId)}
 *   onViewDetails={() => navigate(`/quest/${questId}`)}
 *   onClaimCertificate={() => handleClaim(questId)}
 * />
 * ```
 */
export const QuestCard: React.FC<QuestCardProps> = ({
  quest,
  onEnroll,
  onViewDetails,
  onClaimCertificate,
  showProgress = true,
  compact = false,
}) => {
  // Calculate progress for enrolled quests
  const progress = useMemo<QuestProgress | null>(() => {
    if (!quest.enrolled || !showProgress) {
      return null;
    }
    return calculateQuestProgress(quest.milestones);
  }, [quest.enrolled, quest.milestones, showProgress]);

  const isComplete = progress?.isComplete ?? false;
  const progressLabel = progress
    ? `${progress.completedMilestones}/${progress.totalMilestones} milestones completed`
    : undefined;

  // Determine card modifiers
  const cardModifiers = [
    'quest-card',
    quest.enrolled ? 'quest-card--enrolled' : '',
    isComplete ? 'quest-card--complete' : '',
    compact ? 'quest-card--compact' : '',
    quest.category ? `quest-card--${quest.category}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cardModifiers}
      data-testid={`quest-card-${quest.id}`}
      data-enrolled={quest.enrolled}
      data-complete={isComplete}
    >
      {/* Card Header */}
      <div className="quest-card__header">
        <div className="quest-card__category">
          {quest.category ?? 'Quest'}
        </div>
        {quest.enrolled && (
          <div className="quest-card__status quest-card__status--active">
            {isComplete ? 'Complete' : 'In Progress'}
          </div>
        )}
      </div>

      {/* Quest Title */}
      <h3 className="quest-card__title">{quest.title}</h3>

      {/* Quest Description */}
      <p className="quest-card__description">{quest.description}</p>

      {/* Progress Section (for enrolled quests) */}
      {quest.enrolled && progress && (
        <div className="quest-card__progress">
          <QuestProgressBar
            percentage={progress.percentage}
            label={compact ? undefined : progressLabel}
            animate={true}
            size={compact ? 'small' : 'medium'}
          />
        </div>
      )}

      {/* Milestone Summary (for enrolled quests, non-compact) */}
      {quest.enrolled && !compact && (
        <div className="quest-card__milestones">
          <div className="quest-card__milestones-title">
            Milestones ({progress?.completedMilestones ?? 0}/{quest.milestones.length})
          </div>
          <ul className="quest-card__milestones-list">
            {quest.milestones.slice(0, 3).map((milestone) => (
              <li
                key={milestone.id}
                className={`quest-card__milestone ${milestone.completed ? 'quest-card__milestone--completed' : ''}`}
              >
                <span className="quest-card__milestone-check" aria-hidden="true">
                  {milestone.completed ? '✓' : '○'}
                </span>
                <span className="quest-card__milestone-title">{milestone.title}</span>
              </li>
            ))}
            {quest.milestones.length > 3 && (
              <li className="quest-card__milestone quest-card__milestone--more">
                <span className="quest-card__milestone-more">
                  +{quest.milestones.length - 3} more
                </span>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Meta Info (XP, Time) */}
      <div className="quest-card__meta">
        {quest.totalXpReward && (
          <div className="quest-card__meta-item">
            <span className="quest-card__meta-icon">⭐</span>
            <span>{quest.totalXpReward} XP</span>
          </div>
        )}
        {quest.estimatedTime && (
          <div className="quest-card__meta-item">
            <span className="quest-card__meta-icon">⏱</span>
            <span>{quest.estimatedTime}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="quest-card__actions">
        {isComplete ? (
          /* Certificate Claim CTA */
          <button
            className="quest-card__btn quest-card__btn--claim"
            onClick={onClaimCertificate}
            disabled={!onClaimCertificate}
            data-testid="quest-claim-certificate-btn"
            type="button"
          >
            <span className="quest-card__btn-icon">🏆</span>
            <span>100% Complete - Claim your certificate</span>
          </button>
        ) : quest.enrolled ? (
          /* Continue Quest */
          <button
            className="quest-card__btn quest-card__btn--continue"
            onClick={onViewDetails}
            disabled={!onViewDetails}
            data-testid="quest-continue-btn"
            type="button"
          >
            Continue Quest
          </button>
        ) : (
          /* Enroll CTA */
          <button
            className="quest-card__btn quest-card__btn--enroll"
            onClick={onEnroll}
            disabled={!onEnroll}
            data-testid="quest-enroll-btn"
            type="button"
          >
            Enroll in Quest
          </button>
        )}
      </div>
    </div>
  );
};

QuestCard.displayName = 'QuestCard';

export default QuestCard;
