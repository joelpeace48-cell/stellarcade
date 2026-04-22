import React, { useCallback, useEffect, useRef } from 'react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  side?: 'left' | 'right';
  children?: React.ReactNode;
  testId?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  title,
  side = 'right',
  children,
  testId = 'drawer',
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      requestAnimationFrame(() => {
        const close = drawerRef.current?.querySelector<HTMLElement>('[data-drawer-close]');
        close?.focus();
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (!focusableElements || focusableElements.length === 0) {
        event.preventDefault();
        drawerRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const sideClass = side === 'left' ? ' drawer--left' : '';

  return (
    <>
      <div
        className={`drawer-backdrop${open ? ' drawer-backdrop--open' : ''}`}
        onClick={handleBackdropClick}
        data-testid={`${testId}-backdrop`}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        className={`drawer${sideClass}${open ? ' drawer--open' : ''}`}
        role="dialog"
        aria-modal={open}
        aria-label={title ?? 'Drawer'}
        tabIndex={-1}
        data-testid={testId}
        {...(!open ? { inert: '' as unknown as string } : {})}
      >
        <div className="drawer__header">
          {title && <h2 className="drawer__title">{title}</h2>}
          <button
            type="button"
            className="drawer__close-btn"
            onClick={onClose}
            aria-label="Close drawer"
            data-drawer-close=""
            data-testid={`${testId}-close`}
          >
            x
          </button>
        </div>

        <div className="drawer__body" data-testid={`${testId}-body`}>
          {children}
        </div>
      </div>
    </>
  );
};

Drawer.displayName = 'Drawer';

export default Drawer;
