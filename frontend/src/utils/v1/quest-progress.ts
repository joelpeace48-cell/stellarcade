/**
 * Quest Progress Utilities
 *
 * Helper functions for calculating and formatting quest progress.
 *
 * @module utils/v1/quest-progress
 */

import type { Quest, QuestProgress, QuestMilestone } from '../../types/v1/quest';

/**
 * Calculates progress for a quest based on its milestones.
 *
 * @param milestones - Array of quest milestones
 * @returns Progress data including completed count, total, percentage, and completion status
 *
 * @example
 * ```typescript
 * const progress = calculateQuestProgress(quest.milestones);
 * console.log(`${progress.percentage}% complete`);
 * ```
 */
export function calculateQuestProgress(milestones: QuestMilestone[]): QuestProgress {
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
 * Calculates progress for a quest object.
 *
 * @param quest - Quest object with milestones
 * @returns Progress data or null if not enrolled
 *
 * @example
 * ```typescript
 * const progress = getQuestProgress(quest);
 * if (progress?.isComplete) {
 *   showCertificateClaim();
 * }
 * ```
 */
export function getQuestProgress(quest: Quest): QuestProgress | null {
  if (!quest.enrolled) {
    return null;
  }
  return calculateQuestProgress(quest.milestones);
}

/**
 * Formats progress as a human-readable string.
 *
 * @param progress - Progress data
 * @returns Formatted progress string (e.g., "3/5 milestones (60%)")
 *
 * @example
 * ```typescript
 * const label = formatProgressLabel(progress);
 * // "3/5 milestones (60%)"
 * ```
 */
export function formatProgressLabel(progress: QuestProgress): string {
  const { completedMilestones, totalMilestones, percentage } = progress;
  const roundedPercentage = Math.round(percentage);

  if (progress.isComplete) {
    return '100% Complete';
  }

  return `${completedMilestones}/${totalMilestones} milestones (${roundedPercentage}%)`;
}

/**
 * Gets the next incomplete milestone for a quest.
 *
 * @param quest - Quest object with milestones
 * @returns The next milestone to complete, or null if all are complete
 *
 * @example
 * ```typescript
 * const nextMilestone = getNextMilestone(quest);
 * if (nextMilestone) {
 *   showMilestoneDetails(nextMilestone);
 * }
 * ```
 */
export function getNextMilestone(quest: Quest): QuestMilestone | null {
  if (!quest.enrolled) {
    return null;
  }

  const incomplete = quest.milestones.find((m) => !m.completed);
  return incomplete ?? null;
}

/**
 * Determines if a quest can be enrolled.
 *
 * @param quest - Quest to check
 * @returns True if the quest can be enrolled
 */
export function canEnroll(quest: Quest): boolean {
  return !quest.enrolled;
}

/**
 * Determines if a quest certificate can be claimed.
 *
 * @param quest - Quest to check
 * @returns True if all milestones are complete and certificate can be claimed
 */
export function canClaimCertificate(quest: Quest): boolean {
  if (!quest.enrolled) {
    return false;
  }

  const progress = calculateQuestProgress(quest.milestones);
  return progress.isComplete;
}
