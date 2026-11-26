import {useEffect, useRef, type RefObject} from 'react';

export function useNativeModal({
  initialFocus, focusAfterClose = 'native', lockBodyScroll = false,
}: {
  initialFocus?: RefObject<HTMLElement | null>;
  focusAfterClose?: 'native' | 'restore' | 'blur';
  lockBodyScroll?: boolean;
} = {}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    initialFocus?.current?.focus({preventScroll:true});
    if (lockBodyScroll) document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      if (lockBodyScroll) document.body.style.overflow = previousOverflow;
      if (focusAfterClose === 'restore' && opener?.isConnected) opener.focus({preventScroll:true});
      if (focusAfterClose === 'blur' && document.activeElement === opener) opener?.blur();
    };
  }, [initialFocus, focusAfterClose, lockBodyScroll]);
  return ref;
}
