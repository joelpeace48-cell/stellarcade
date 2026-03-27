/**
 * Components v1 - Public API
 *
 * Re-exports all v1 components for clean imports.
 *
 * @example
 * ```tsx
 * import { EmptyStateBlock, WalletStatusCard } from '@/components/v1';
 * ```
 */

export {
  EmptyStateBlock,
  default as EmptyStateBlockDefault,
} from "./EmptyStateBlock";
export type {
  EmptyStateBlockProps,
  EmptyStateAction,
  EmptyStateVariant,
  ActionVariant,
} from "./EmptyStateBlock.types";

export { default as ErrorNotice } from "./ErrorNotice";
export type { ErrorNoticeProps } from "./ErrorNotice";

export {
  FormErrorSummary,
  default as FormErrorSummaryDefault,
} from "./FormErrorSummary";
export type { FormErrorSummaryProps, FormFieldError } from "./FormErrorSummary";

export { ActionToolbar } from "./ActionToolbar";
export type {
  ActionToolbarProps,
  ToolbarAction,
  ToolbarActionIntent,
} from "./ActionToolbar";

export {
  ContractEventFeed,
  default as ContractEventFeedDefault,
} from "./ContractEventFeed";
export type { ContractEventFeedProps } from "./ContractEventFeed";

export { PaginatedListController } from "./PaginatedListController";
export type { PaginatedListControllerProps } from "./PaginatedListController";

export {
  WalletStatusCard,
  default as WalletStatusCardDefault,
} from "./WalletStatusCard";
export type {
  WalletStatusCardProps,
  WalletStatusCardCallbacks,
  WalletBadgeVariant,
  WalletStatus,
  WalletCapabilities,
  WalletStatusError,
} from "./WalletStatusCard.types";

export { AsyncStateBoundary } from "./AsyncStateBoundary";
export type { AsyncStateBoundaryProps } from "./AsyncStateBoundary";

export { ContractActionButton } from "./ContractActionButton";
export type { ContractActionButtonProps } from "./ContractActionButton";

export {
  SessionTimeoutModal,
  default as SessionTimeoutModalDefault,
} from "./SessionTimeoutModal";
export type { SessionTimeoutModalProps } from "./SessionTimeoutModal";

export {
  SkeletonBase,
  SkeletonCard,
  SkeletonRow,
  SkeletonList,
  SkeletonPreset,
  LoadingState,
} from "./LoadingSkeletonSet";
export type {
  SkeletonBaseProps,
  SkeletonCardProps,
  SkeletonRowProps,
  SkeletonListProps,
  SkeletonPresetProps,
  LoadingStateProps,
} from "./LoadingSkeletonSet";

export {
  SKELETON_PRESETS,
  skBaseColor,
  skBaseColorDark,
  skBorderColor,
  skBorderColorDark,
  skRadiusSm,
  skRadiusMd,
  skRadiusLg,
  skRadiusCircle,
  skGapSm,
  skGapMd,
  skGapLg,
  skPadding,
  skPulseDuration,
  skPulseEasing,
  skHeightTextSm,
  skHeightTextMd,
  skHeightTextLg,
  skHeightHeading,
  skHeightThumbnail,
  skHeightDetailBanner,
  skSizeAvatarSm,
  skSizeAvatarMd,
  skSizeAvatarLg,
} from "./skeleton.tokens";
export type { SkeletonShape, SkeletonPresetType } from "./skeleton.tokens";

// Quest Components
export { QuestCard, default as QuestCardDefault } from "./QuestCard";
export type { QuestCardProps } from "../../types/v1/quest";

export {
  QuestProgressBar,
  default as QuestProgressBarDefault,
} from "./QuestProgressBar";
export type { QuestProgressBarProps } from "../../types/v1/quest";

export {
  QuestProgressRing,
  default as QuestProgressRingDefault,
} from "./QuestProgressRing";
export type { QuestProgressRingProps } from "../../types/v1/quest";

export {
  QuestWorkspaceHeader,
  default as QuestWorkspaceHeaderDefault,
} from "./QuestWorkspaceHeader";
export type { QuestWorkspaceHeaderProps } from "../../types/v1/quest";
