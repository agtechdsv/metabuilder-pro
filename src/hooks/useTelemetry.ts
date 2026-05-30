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
  uiViewName?: string
  heartbeatIntervalMs?: number // Default: 2 minutes
}

export function useTelemetry({
  workspaceId,
  projectId,
  uiViewId,
  uiViewName,
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
  
  const logIdRef = useRef<string | null>(null)
  const hasLoggedEntryRef = useRef(false)

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

  // Log session start automatically when user is loaded
  useEffect(() => {
    if (userId && !hasLoggedEntryRef.current) {
      logAction('SESSION_START', uiViewName ? `Entrou no configurador do Caso de Uso: ${uiViewName}` : 'Entrou no configurador do Caso de Uso')
      hasLoggedEntryRef.current = true
    }
  }, [userId, logAction, uiViewName])

  // The Heartbeat
  const flush = useCallback(async (overrideUiViewId?: string) => {
    if (eventsBufferRef.current.length === 0 || !userId || !workspaceId || !projectId) return

    const now = new Date()
    // Calculate final active time for this chunk if they just clicked something
    const timeSinceLastActive = (now.getTime() - lastActiveRef.current.getTime()) / 1000
    if (timeSinceLastActive < 60) {
       activeTimeSecondsRef.current += timeSinceLastActive
       lastActiveRef.current = now
    }

    const finalUiViewId = overrideUiViewId || uiViewId || null

    const payload = {
      workspace_id: workspaceId,
      project_id: projectId,
      user_id: userId,
      ui_view_id: finalUiViewId,
      session_start: sessionStartRef.current.toISOString(),
      session_end: now.toISOString(),
      active_time_seconds: Math.floor(activeTimeSecondsRef.current),
      actions_count: eventsBufferRef.current.length,
      events: eventsBufferRef.current, // Sending all accumulated events
    }

    try {
      if (logIdRef.current) {
        // Update existing row
        const { error } = await supabase
          .from('activity_logs')
          .update({
            session_end: payload.session_end,
            active_time_seconds: payload.active_time_seconds,
            actions_count: payload.actions_count,
            events: payload.events,
            ui_view_id: payload.ui_view_id
          })
          .eq('id', logIdRef.current)
          
        if (error) console.error('Telemetry flush update error:', error)
      } else {
        // Insert new row
        const { data, error } = await supabase
          .from('activity_logs')
          .insert(payload)
          .select('id')
          .single()

        if (error) {
          console.error('Telemetry flush insert error:', error)
        } else if (data) {
          logIdRef.current = data.id
        }
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
