import React from "react";

export interface SectionHeaderProps {
  /** Provide an id so sections can reference it via aria-labelledby. */
  titleId: string;
  /** Main header text. */
  title: string;
  /** Optional supporting copy under the title. */
  description?: string;
  /** Optional right-side actions (buttons/toggles/links). */
  actions?: React.ReactNode;
}

/**
 * SectionHeader — reusable dashboard section header with optional actions.
 * Intentionally reuses existing dashboard header styling via `dashboard-section-heading`.
 */
export function SectionHeader({
  titleId,
  title,
  description,
  actions,
}: SectionHeaderProps): React.JSX.Element {
  return (
    <div className="dashboard-section-heading" data-testid="section-header">
      <div>
        <h2 id={titleId}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}

export default SectionHeader;

