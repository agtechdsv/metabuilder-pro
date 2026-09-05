import React from 'react'
import {
  SpecialLayoutProps,
  GeneralPatternConfig,
  KanbanLayoutConfig,
  SchedulerLayoutConfig,
  TimelineLayoutConfig,
  GanttLayoutConfig,
  BlueprintLayoutConfig,
  MapLayoutConfig
} from './special-layouts'

export function SpecialLayouts(props: SpecialLayoutProps) {
  return (
    <>
      {/* ZONA: CONFIGURAÇÕES GERAIS */}
      <GeneralPatternConfig config={props.config} setConfig={props.setConfig} t={props.t} />

      {/* ZONA: KANBAN CONFIG */}
      <KanbanLayoutConfig {...props} />

      {/* ZONA: SCHEDULER CONFIG */}
      <SchedulerLayoutConfig {...props} />

      {/* ZONA: TIMELINE CONFIG */}
      <TimelineLayoutConfig {...props} />

      {/* ZONA: GANTT CONFIG */}
      <GanttLayoutConfig {...props} />

      {/* ZONA: BLUEPRINT CONFIG */}
      <BlueprintLayoutConfig {...props} />

      {/* ZONA: MAP CONFIG */}
      <MapLayoutConfig {...props} />
    </>
  )
}
