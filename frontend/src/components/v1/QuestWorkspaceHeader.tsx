/**
 * QuestWorkspaceHeader Component
 *
 * Header component for quest workspace showing large progress ring.
 * Displays overall quest completion status with certificate claim CTA when complete.
 *
 * @module components/v1/QuestWorkspaceHeader
 */

import React from 'react';
import type { QuestWorkspaceHeaderProps } from '../../types/v1/quest';
import { QuestProgressRing } from './QuestProgressRing';
import './QuestWorkspaceHeader.css';

/**
 * QuestWorkspaceHeader — workspace header with quest progress.
 *
 * Shows a large progress ring at the top of the quest workspace,
 * displaying the current completion status. When all milestones are
 * complete, shows the certificate claim CTA.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <QuestWorkspaceHeader
 *   activeQuest={quest}
 *   progress={progress}
 * />
 *
 * // With certificate claim
 * <QuestWorkspaceHeader
 *   activeQuest={quest}
 *   progress={progress}
 *   onClaimCertificate={() => handleClaim()}
 *   onBack={() => navigate('/quests')}
 * />
 * ```
 */
export const QuestWorkspaceHeader: React.FC<QuestWorkspaceHeaderProps> = ({
  activeQuest,
  progress,
  onClaimCertificate,
  onBack,
}) => {
  const isComplete = progress?.isComplete ?? false;
  const percentage = progress?.percentage ?? 0;

  // Build label based on progress state
  const ringLabel = isComplete
    ? 'Quest Complete!'
    : progress
    ? `${progress.completedMilestones}/${progress.totalMilestones} Milestones`
    : 'Not Enrolled';

  // Build subtitle based on progress state
  const ringSubtitle = isComplete
    ? 'Ready to claim your certificate'
    : `${Math.round(percentage)}% complete`;

  return (
    <div className="quest-workspace-header" data-testid="quest-workspace-header">
      {/* Back Button */}
      {onBack && (
        <button
          className="quest-workspace-header__back"
          onClick={onBack}
          data-testid="quest-workspace-back-btn"
          type="button"
          aria-label="Go back to quests"
        >
          <span className="quest-workspace-header__back-icon" aria-hidden="true">
            ←
          </span>
          <span>Back to Quests</span>
        </button>
      )}

      {/* Main Header Content */}
      <div className="quest-workspace-header__content">
        {/* Quest Info (left side) */}
        <div className="quest-workspace-header__info">
          {activeQuest?.category && (
            <div className="quest-workspace-header__category">
              {activeQuest.category}
            </div>
          )}
          <h1 className="quest-workspace-header__title">
            {activeQuest?.title ?? 'Quest Workspace'}
          </h1>
          {activeQuest?.description && (
            <p className="quest-workspace-header__description">
              {activeQuest.description}
            </p>
          )}
        </div>

        {/* Progress Ring (right side) */}
        <div className="quest-workspace-header__progress">
          <QuestProgressRing
            percentage={percentage}
            size="large"
            color={isComplete ? 'success' : 'primary'}
            showPercentage={true}
            animate={true}
            label={ringLabel}
            subtitle={ringSubtitle}
          />
        </div>
      </div>

      {/* Certificate Claim CTA (shown when complete) */}
      {isComplete && (
        <div className="quest-workspace-header__cta" role="region" aria-label="Certificate claim">
          <div className="quest-workspace-header__cta-content">
            <span className="quest-workspace-header__cta-icon" aria-hidden="true">
              🏆
            </span>
            <div className="quest-workspace-header__cta-text">
              <span className="quest-workspace-header__cta-title">
                100% Complete - Claim your certificate
              </span>
              <span className="quest-workspace-header__cta-subtitle">
                Congratulations! You've completed all milestones.
              </span>
            </div>
          </div>
          <button
            className="quest-workspace-header__btn quest-workspace-header__btn--claim"
            onClick={onClaimCertificate}
            disabled={!onClaimCertificate}
            data-testid="quest-workspace-claim-btn"
            type="button"
          >
            Claim Certificate
          </button>
        </div>
      )}
    </div>
  );
};

QuestWorkspaceHeader.displayName = 'QuestWorkspaceHeader';

export default QuestWorkspaceHeader;
