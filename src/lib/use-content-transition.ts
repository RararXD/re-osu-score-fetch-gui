import { useLayoutEffect, useRef } from "react";

// Animate the existing region, preserving focus and in-progress exports on updates.
export function useContentTransition<T extends HTMLElement>(identity: string) {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element?.animate || document.hidden) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animation = element.animate(
      reducedMotion.matches
        ? [{ opacity: 0.75 }, { opacity: 1 }]
        : [
            { opacity: 0.4, transform: "translateY(6px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
      {
        id: `content-${identity}`,
        duration: reducedMotion.matches ? 100 : 220,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    );
    const cancel = () => animation.cancel();
    const onVisibility = () => {
      if (document.hidden) cancel();
    };
    reducedMotion.addEventListener("change", cancel);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancel();
      reducedMotion.removeEventListener("change", cancel);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [identity]);

  return ref;
}
