'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

function ProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Complete progress on page change
  useEffect(() => {
    if (isAnimating) {
      setProgress(100);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setProgress(0);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Trickle progress when active
  useEffect(() => {
    if (!isAnimating || progress >= 95) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return prev;
        }
        // Slowly trickle up near the end
        const remaining = 95 - prev;
        const diff = Math.random() * (remaining * 0.15) + 0.5;
        return Math.min(prev + diff, 95);
      });
    }, 250);

    // Safety timeout - auto complete/reset after 15s if stuck
    const safetyTimeout = setTimeout(() => {
      setIsAnimating(false);
      setProgress(0);
    }, 15000);

    return () => {
      clearInterval(interval);
      clearTimeout(safetyTimeout);
    };
  }, [isAnimating, progress]);

  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      // Find closest anchor tag
      let anchor = event.target as HTMLElement | null;
      while (anchor && anchor.tagName !== 'A') {
        anchor = anchor.parentElement;
      }

      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Ignore external links
      const isExternal = href.startsWith('http') && !href.startsWith(window.location.origin);
      if (isExternal) return;

      // Ignore target="_blank"
      const target = anchor.getAttribute('target');
      if (target === '_blank') return;

      // Ignore downloads
      if (anchor.hasAttribute('download')) return;

      // Ignore hash links or javascript void links
      if (href.startsWith('#') || href.startsWith('javascript:')) return;

      // Ignore modified clicks (open in new tab/window)
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1) {
        return;
      }

      // Ignore click on active tab/same path
      const currentUrl = new URL(window.location.href);
      const targetUrl = new URL(href, window.location.href);
      if (currentUrl.pathname === targetUrl.pathname && currentUrl.search === targetUrl.search) {
        return;
      }

      // Start progress bar!
      setIsAnimating(true);
      setProgress(10);
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  return (
    <AnimatePresence>
      {isAnimating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { delay: 0.1, duration: 0.2 } }}
          className="fixed top-0 left-0 right-0 h-[5px] z-[99999] pointer-events-none"
        >
          {/* Progress Line */}
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative"
            style={{ width: `${progress}%` }}
            transition={{
              type: 'spring',
              stiffness: 70,
              damping: 15,
            }}
          >
            {/* Glowing End Glow */}
            <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-r from-transparent via-white/50 to-white dark:to-indigo-300 opacity-80 blur-[3px]" />
            <div className="absolute right-0 top-0 h-full w-8 bg-white dark:bg-indigo-300 shadow-[0_0_15px_#6366f1,0_0_5px_#a855f7]" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ProgressBarProvider() {
  return (
    <Suspense fallback={null}>
      <ProgressBarInner />
    </Suspense>
  );
}
