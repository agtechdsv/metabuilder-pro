'use client'

import React from 'react'
import { CheckCircle2, XCircle, MinusCircle, Circle, Loader2 } from 'lucide-react'
import type { RowStatus } from '@/lib/testing/history'

export function StatusIcon({ s }: { s: RowStatus | 'running' }) {
  if (s === 'passed') return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
  if (s === 'failed') return <XCircle className="w-4 h-4 text-red-400 shrink-0" />
  if (s === 'running') return <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
  if (s === 'skipped') return <MinusCircle className="w-4 h-4 text-neutral-500 shrink-0" />
  return <Circle className="w-4 h-4 text-neutral-600 shrink-0" />
}
