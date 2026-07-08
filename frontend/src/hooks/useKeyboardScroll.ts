import { useEffect } from 'react';

export function useKeyboardScroll() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let prevHeight = vv.height;

    const handleResize = () => {
      const currentHeight = vv.height;

      if (currentHeight < prevHeight) {
        // Viewport shrank — keyboard appeared. Scroll focused element into view
        // after a short delay to let the keyboard animation finish.
        setTimeout(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) return;

          const tag = el.tagName.toLowerCase();
          if (tag === 'input' || tag === 'textarea' || el.isContentEditable) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }

          // IonInput wraps the real <input> in shadow DOM — walk up to the
          // ion-input host element and scroll that instead.
          const ionHost = el.closest('ion-input, ion-textarea, ion-searchbar');
          if (ionHost) {
            ionHost.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }

      prevHeight = currentHeight;
    };

    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, []);
}
