import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface ModalStackEntry {
  id: string;
  onRequestClose?: () => void;
  returnFocusTarget: HTMLElement | null;
}

interface ModalStackContextValue {
  registerModal: (entry: Omit<ModalStackEntry, 'returnFocusTarget'>) => () => void;
  isTopModal: (id: string) => boolean;
  getStackIndex: (id: string) => number;
}

const ModalStackContext = createContext<ModalStackContextValue | null>(null);

function focusFirstInteractive(container: HTMLElement | null): boolean {
  const firstInteractive = container?.querySelector<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  if (!firstInteractive) {
    return false;
  }
  firstInteractive.focus();
  return true;
}

export const ModalStackProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [stack, setStack] = useState<ModalStackEntry[]>([]);

  const registerModal = useCallback(
    (entry: Omit<ModalStackEntry, 'returnFocusTarget'>) => {
      const returnFocusTarget =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      setStack((current) => {
        const withoutExisting = current.filter((item) => item.id !== entry.id);
        return [...withoutExisting, { ...entry, returnFocusTarget }];
      });

      return () => {
        setStack((current) => {
          const target = current.find((item) => item.id === entry.id) ?? null;
          const next = current.filter((item) => item.id !== entry.id);

          queueMicrotask(() => {
            if (next.length > 0) {
              const nextTopContainer = document.querySelector<HTMLElement>(
                `[data-modal-stack-id="${next[next.length - 1].id}"]`,
              );
              if (focusFirstInteractive(nextTopContainer)) {
                return;
              }
            }
            target?.returnFocusTarget?.focus?.();
          });

          return next;
        });
      };
    },
    [],
  );

  useEffect(() => {
    if (stack.length === 0) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      const topEntry = stack[stack.length - 1];
      if (!topEntry?.onRequestClose) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      topEntry.onRequestClose();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [stack]);

  const value = useMemo<ModalStackContextValue>(
    () => ({
      registerModal,
      isTopModal: (id: string) => stack[stack.length - 1]?.id === id,
      getStackIndex: (id: string) => stack.findIndex((entry) => entry.id === id),
    }),
    [registerModal, stack],
  );

  return (
    <ModalStackContext.Provider value={value}>
      {children}
    </ModalStackContext.Provider>
  );
};

interface UseModalStackRegistrationOptions {
  active: boolean;
  modalId: string;
  onRequestClose?: () => void;
}

export function useModalStackRegistration({
  active,
  modalId,
  onRequestClose,
}: UseModalStackRegistrationOptions) {
  const context = useContext(ModalStackContext);
  const registerModal = context?.registerModal;
  const unregisterRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!registerModal || !active) {
      unregisterRef.current?.();
      unregisterRef.current = null;
      return;
    }

    unregisterRef.current?.();
    unregisterRef.current = registerModal({
      id: modalId,
      onRequestClose,
    });

    return () => {
      unregisterRef.current?.();
      unregisterRef.current = null;
    };
  }, [active, modalId, onRequestClose, registerModal]);

  if (!context) {
    return {
      isTopModal: active,
      stackIndex: active ? 0 : -1,
    };
  }

  return {
    isTopModal: active && context.isTopModal(modalId),
    stackIndex: active ? context.getStackIndex(modalId) : -1,
  };
}
