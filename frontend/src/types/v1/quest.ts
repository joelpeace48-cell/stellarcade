/**
 * Quest and Milestone type definitions for StellarCade learning system.
 *
 * @module types/v1/quest
 */

/** Represents a single milestone within a quest */
export interface QuestMilestone {
  /** Unique identifier for the milestone */
  id: string;
  /** Display title of the milestone */
  title: string;
  /** Description of what needs to be completed */
  description: string;
  /** Whether this milestone has been completed */
  completed: boolean;
  /** Optional: XP reward for completing this milestone */
  xpReward?: number;
}

/** Represents a quest with multiple milestones */
export interface Quest {
  /** Unique identifier for the quest */
  id: string;
  /** Display title of the quest */
  title: string;
  /** Description of the quest */
  description: string;
  /** Array of milestones that make up this quest */
  milestones: QuestMilestone[];
  /** Whether the user is enrolled in this quest */
  enrolled: boolean;
  /** Optional: Total XP reward for completing all milestones */
  totalXpReward?: number;
  /** Optional: Certificate ID awarded upon completion */
  certificateId?: string;
  /** Optional: Quest category or difficulty */
  category?: 'beginner' | 'intermediate' | 'advanced';
  /** Optional: Estimated time to complete */
  estimatedTime?: string;
}

/** Calculated progress for a quest */
export interface QuestProgress {
  /** Number of completed milestones */
  completedMilestones: number;
  /** Total number of milestones */
  totalMilestones: number;
  /** Progress as a percentage (0-100) */
  percentage: number;
  /** Whether all milestones are complete */
  isComplete: boolean;
}

/** Props for quest card component */
export interface QuestCardProps {
  /** Quest data to display */
  quest: Quest;
  /** Callback when user clicks to enroll/join */
  onEnroll?: () => void;
  /** Callback when user clicks to view details */
  onViewDetails?: () => void;
  /** Callback when user claims certificate */
  onClaimCertificate?: () => void;
  /** Whether to show the progress bar (default: true for enrolled quests) */
  showProgress?: boolean;
  /** Compact mode for smaller display */
  compact?: boolean;
}

/** Props for progress bar component */
export interface QuestProgressBarProps {
  /** Current progress percentage (0-100) */
  percentage: number;
  /** Optional: Label showing progress text */
  label?: string;
  /** Whether to animate on mount */
  animate?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
}

/** Props for progress ring component */
export interface QuestProgressRingProps {
  /** Current progress percentage (0-100) */
  percentage: number;
  /** Size of the ring in pixels */
  size?: 'small' | 'medium' | 'large' | number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Whether to show percentage text inside ring */
  showPercentage?: boolean;
  /** Whether to animate on mount */
  animate?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Color variant */
  color?: 'primary' | 'success' | 'warning';
  /** Custom label to display below the ring */
  label?: string;
  /** Subtitle for additional context */
  subtitle?: string;
}

/** Props for workspace header with progress */
export interface QuestWorkspaceHeaderProps {
  /** Current quest the user is working on */
  activeQuest: Quest | null;
  /** Progress data for the active quest */
  progress: QuestProgress | null;
  /** Callback when user claims certificate */
  onClaimCertificate?: () => void;
  /** Callback when user navigates back */
  onBack?: () => void;
}
