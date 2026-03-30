/**
 * useAppDialog
 *
 * Imperative hook for displaying AppDialog modals anywhere in the app.
 * Acts as a drop-in replacement for React Native's Alert.alert().
 *
 * Usage:
 *   const dialog = useAppDialog();
 *
 *   // Single-button (info / success / error / warning):
 *   dialog.show({ variant: 'error', title: 'Save Failed', message: 'Try again.' });
 *
 *   // Two-button (confirm / cancel):
 *   dialog.confirm({
 *     title:     'Delete Item?',
 *     message:   'This action cannot be undone.',
 *     onConfirm: () => doDelete(),
 *     onCancel:  () => {},          // optional
 *   });
 *
 *   // In JSX (once per screen, anywhere in the tree):
 *   return (
 *     <View>
 *       ...
 *       <dialog.Dialog />
 *     </View>
 *   );
 */

import React, { useCallback, useMemo, useState } from 'react';
import { AppDialog, type AppDialogVariant } from '@/components/molecules/AppDialog';

// ─── Public API types ─────────────────────────────────────────────────────────

export interface ShowDialogOptions {
  variant?:     AppDialogVariant;
  title:        string;
  message:      string;
  confirmText?: string;
  onConfirm?:   () => void;
  /** Whether tapping the backdrop dismisses. Default: true */
  dismissable?: boolean;
}

export interface ConfirmDialogOptions {
  title:        string;
  message:      string;
  confirmText?: string;
  cancelText?:  string;
  onConfirm:    () => void;
  onCancel?:    () => void;
  /** Whether tapping the backdrop dismisses. Default: true */
  dismissable?: boolean;
}

export interface AppDialogHandle {
  /** Show a single-button informational/status dialog. */
  show:    (opts: ShowDialogOptions) => void;
  /** Show a two-button confirm/cancel dialog. */
  confirm: (opts: ConfirmDialogOptions) => void;
  /** Dismiss the dialog programmatically without firing any callback. */
  hide:    () => void;
  /**
   * Pre-bound AppDialog element — render this once somewhere in the component's
   * JSX tree (usually at the bottom, just before the closing tag).
   */
  Dialog:  React.ReactElement;
}

// ─── Internal state ───────────────────────────────────────────────────────────

interface DialogState {
  visible:      boolean;
  variant:      AppDialogVariant;
  title:        string;
  message:      string;
  confirmText:  string;
  cancelText:   string | undefined;
  onConfirm:    (() => void) | undefined;
  onCancel:     (() => void) | undefined;
  dismissable:  boolean;
}

const INITIAL_STATE: DialogState = {
  visible:     false,
  variant:     'info',
  title:       '',
  message:     '',
  confirmText: 'OK',
  cancelText:  undefined,
  onConfirm:   undefined,
  onCancel:    undefined,
  dismissable: true,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAppDialog(): AppDialogHandle {
  const [state, setState] = useState<DialogState>(INITIAL_STATE);

  const hide = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const show = useCallback((opts: ShowDialogOptions) => {
    setState({
      visible:     true,
      variant:     opts.variant ?? 'info',
      title:       opts.title,
      message:     opts.message,
      confirmText: opts.confirmText ?? 'OK',
      cancelText:  undefined,
      onConfirm:   opts.onConfirm,
      onCancel:    undefined,
      dismissable: opts.dismissable ?? true,
    });
  }, []);

  const confirm = useCallback((opts: ConfirmDialogOptions) => {
    setState({
      visible:     true,
      variant:     'confirm',
      title:       opts.title,
      message:     opts.message,
      confirmText: opts.confirmText ?? 'Confirm',
      cancelText:  opts.cancelText  ?? 'Cancel',
      onConfirm:   opts.onConfirm,
      onCancel:    opts.onCancel,
      dismissable: opts.dismissable ?? true,
    });
  }, []);

  // Wrap handlers so the dialog closes after the callback fires.
  const handleConfirm = useCallback(() => {
    hide();
    state.onConfirm?.();
  }, [hide, state.onConfirm]);

  const handleCancel = useCallback(() => {
    hide();
    state.onCancel?.();
  }, [hide, state.onCancel]);

  const Dialog = useMemo(
    () =>
      React.createElement(AppDialog, {
        visible:     state.visible,
        variant:     state.variant,
        title:       state.title,
        message:     state.message,
        confirmText: state.confirmText,
        onConfirm:   handleConfirm,
        dismissable: state.dismissable,
        ...(state.cancelText !== undefined ? { cancelText: state.cancelText } : {}),
        ...(state.onCancel   !== undefined ? { onCancel:   handleCancel      } : {}),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, handleConfirm, handleCancel],
  );

  return { show, confirm, hide, Dialog };
}
