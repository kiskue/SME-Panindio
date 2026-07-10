/**
 * ToastProvider + useToast()
 * ==========================
 * The existing `Toast` molecule is a fully CONTROLLED component (you own
 * `visible`/`onDismiss`). There was no app-wide way to fire one imperatively.
 * This provider owns that managed state and exposes a stable `show()` so any
 * subtree (e.g. `RealtimeProvider` on a realtime event) can raise a toast
 * without threading props.
 *
 * Presentation: one toast at a time. Additional `show()` calls while one is
 * visible are queued (FIFO) and shown as each dismisses, so a burst of realtime
 * events never stacks overlapping toasts. Queue state is kept in refs (not React
 * state) so it is safe against React 18 double-invoked updaters.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Toast, type ToastVariant } from './Toast';

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  position?: 'top' | 'bottom';
  action?: { label: string; onPress: () => void };
}

export interface ToastContextValue {
  /** Show a toast (queued behind any currently-visible one). */
  show: (options: ToastOptions) => void;
  /** Immediately hide the current toast and drop the queue. */
  hide: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Delay between one toast fading out and the next appearing. */
const GAP_MS = 150;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [current, setCurrent] = useState<ToastOptions | null>(null);
  const [visible, setVisible] = useState(false);

  const queueRef = useRef<ToastOptions[]>([]);
  const showingRef = useRef(false);
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pull the next queued toast (or clear when the queue is empty). All queue
  // mutation happens here — outside any React state updater — so it is immune to
  // double-invoked updaters in dev/strict mode.
  const promote = useCallback(() => {
    const next = queueRef.current.shift();
    if (next) {
      showingRef.current = true;
      setCurrent(next);
      setVisible(true);
    } else {
      showingRef.current = false;
      setCurrent(null);
    }
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      queueRef.current.push(options);
      if (!showingRef.current) promote();
    },
    [promote],
  );

  const hide = useCallback(() => {
    queueRef.current = [];
    showingRef.current = false;
    if (gapTimer.current) clearTimeout(gapTimer.current);
    setVisible(false);
  }, []);

  // Fired by Toast once it has faded out (auto-dismiss timer or manual hide).
  const handleDismiss = useCallback(() => {
    setVisible(false);
    if (gapTimer.current) clearTimeout(gapTimer.current);
    gapTimer.current = setTimeout(promote, GAP_MS);
  }, [promote]);

  useEffect(
    () => () => {
      if (gapTimer.current) clearTimeout(gapTimer.current);
    },
    [],
  );

  const value = useMemo<ToastContextValue>(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current !== null && (
        <Toast
          message={current.message}
          visible={visible}
          onDismiss={handleDismiss}
          {...(current.variant !== undefined ? { variant: current.variant } : {})}
          {...(current.duration !== undefined ? { duration: current.duration } : {})}
          {...(current.position !== undefined ? { position: current.position } : {})}
          {...(current.action !== undefined ? { action: current.action } : {})}
        />
      )}
    </ToastContext.Provider>
  );
};

/**
 * Access the imperative toast API. Returns a safe no-op implementation if called
 * outside a `ToastProvider` so consumers (e.g. background controllers) never
 * crash when the provider is absent.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    if (__DEV__) {
      console.warn('[useToast] called outside <ToastProvider> — using no-op');
    }
    return { show: () => {}, hide: () => {} };
  }
  return ctx;
}
