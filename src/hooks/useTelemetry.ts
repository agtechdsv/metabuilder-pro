import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'

interface TelemetryEvent {
  action: string
  detail: string
  time: string
}

interface UseTelemetryProps {
  workspaceId?: string
  projectId?: string
  uiViewId?: string
  heartbeatIntervalMs?: number // Default: 2 minutes
}

export function useTelemetry({
  workspaceId,
  projectId,
  uiViewId,
  heartbeatIntervalMs = 120000,
}: UseTelemetryProps) {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [supabase])
  
  // Refs for state that shouldn't trigger re-renders
  const sessionStartRef = useRef<Date>(new Date())
  const lastActiveRef = useRef<Date>(new Date())
  const activeTimeSecondsRef = useRef<number>(0)
  const eventsBufferRef = useRef<TelemetryEvent[]>([])
  
  // Throttle timer for grouping similar rapid actions
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const logAction = useCallback((action: string, detail: string) => {
    const now = new Date()
    
    // Update active time (if previous action was less than 5 mins ago, count it as active time)
    const timeSinceLastActive = (now.getTime() - lastActiveRef.current.getTime()) / 1000
    if (timeSinceLastActive < 300) { // 5 minutes inactivity threshold
      activeTimeSecondsRef.current += timeSinceLastActive
    }
    lastActiveRef.current = now

    // Add to buffer
    eventsBufferRef.current.push({
      action,
      detail,
      time: now.toISOString(),
    })
  }, [])

  // The Heartbeat
  const flush = useCallback(async () => {
    if (eventsBufferRef.current.length === 0 || !userId || !workspaceId || !projectId) return // Nothing to flush or missing IDs

    const now = new Date()
    // Calculate final active time for this chunk if they just clicked something
    const timeSinceLastActive = (now.getTime() - lastActiveRef.current.getTime()) / 1000
    if (timeSinceLastActive < 60) {
       activeTimeSecondsRef.current += timeSinceLastActive
       lastActiveRef.current = now
    }

    const payload = {
      workspace_id: workspaceId,
      project_id: projectId,
      user_id: userId,
      ui_view_id: uiViewId || null,
      session_start: sessionStartRef.current.toISOString(),
      session_end: now.toISOString(),
      active_time_seconds: Math.floor(activeTimeSecondsRef.current),
      actions_count: eventsBufferRef.current.length,
      events: eventsBufferRef.current,
    }

    try {
      const { error } = await supabase
        .from('activity_logs')
        .insert(payload)

      if (error) {
        console.error('Telemetry flush error:', error)
      } else {
        // Reset for next heartbeat
        sessionStartRef.current = now
        activeTimeSecondsRef.current = 0
        eventsBufferRef.current = []
      }
    } catch (err) {
      console.error('Telemetry flush exception:', err)
    }
  }, [supabase, workspaceId, projectId, uiViewId, userId])

  // Setup Heartbeat interval
  useEffect(() => {
    const interval = setInterval(flush, heartbeatIntervalMs)
    
    // Flush on unmount (component closed)
    return () => {
      clearInterval(interval)
      flush()
    }
  }, [flush, heartbeatIntervalMs])

  return { logAction, flush }
}
