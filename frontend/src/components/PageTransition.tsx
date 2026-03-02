import { ReactNode, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

/**
 * Wraps page content and triggers a CSS page-enter animation on every route change.
 *
 * IMPORTANT: The animation class is removed after it completes (500ms) so that
 * the div no longer has an active CSS `transform`. If it did, all `position: fixed`
 * children (modals, dropdowns) would be positioned relative to this div instead
 * of the viewport — a known CSS containing-block side-effect of transforms.
 */
export default function PageTransition({ children }: Props) {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Clear any pending cleanup
    if (timerRef.current) clearTimeout(timerRef.current);

    // Restart animation
    el.classList.remove('animate-page-enter');
    void el.offsetWidth; // force reflow
    el.classList.add('animate-page-enter');

    // Remove class once done so transform is no longer active.
    // fixed children will correctly use the viewport as containing block.
    timerRef.current = setTimeout(() => {
      el.classList.remove('animate-page-enter');
    }, 520); // slightly > animation duration (500ms)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location.pathname]);

  return (
    <div ref={ref} className="h-full">
      {children}
    </div>
  );
}
