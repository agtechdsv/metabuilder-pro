'use client';

import { Suspense } from 'react';
import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';

export function ProgressBarProvider() {
  return (
    <Suspense fallback={null}>
      <ProgressBar
        height="4px"
        color="#6366f1" // indigo-500
        options={{ showSpinner: true }}
        shallowRouting
      />
    </Suspense>
  );
}
