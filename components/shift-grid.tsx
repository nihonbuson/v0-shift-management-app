'use client'

import { useMemo } from 'react'
import { Printer, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { StaffMember, Role, Session, Assignment, DayConfig, StaffOverride } from '@/lib/types'
import { timeToMinutes, minutesToTime, generateTimeSlots } from '@/lib/types'

/** Compute relative luminance and return white or black for best contrast */
function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '')
  if (hex.length < 6) return '#000000'
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  const luminance =
    0.2126 * (r <= 0.03928 ? r / 12.92 : ((r + 0.055) / 1.055) ** 2.4) +
    0.7152 * (g <= 0.03928 ? g / 12.92 : ((g + 0.055) / 1.055) ** 2.4) +
    0.0722 * (b <= 0.03928 ? b / 12.92 : ((b + 0.055) / 1.055) ** 2.4)
  return luminance > 0.4 ? '#1a1a1a' : '#ffffff'
}

interface ShiftGridProps {
  staff: StaffMember[]
  roles: Role[]
  sessions: Session[]
  assignments: Assignment[]
  staffOverrides: StaffOverride[]
  days: DayConfig[]
  gridStartTime: string
  gridEndTime: string
}

/** A resolved milestone with absolute time */
interface ResolvedMilestone {
  time: string // "HH:MM"
  label: string
}

interface CellInfo {
  sessionId: string | null
  roleId: string | null
  roleName: string
  roleColor: string
  roleTextColor: string
  sessionTitle: string
  isOverride: boolean
  isGlobalOverride: boolean
  note: string
  milestones: ResolvedMilestone[]
}

interface MergedCell {
  rowSpan: number
  info: CellInfo
  isFirst: boolean
}

/** Session column merge info */
interface SessionColCell {
  sessionId: string | null
  title: string
  rowSpan: number
  isFirst: boolean
}

const EMPTY_CELL: CellInfo = {
  sessionId: null,
  roleId: null,
  roleName: '',
  roleColor: '',
  roleTextColor: '',
  sessionTitle: '',
  isOverride: false,
  isGlobalOverride: false,
  note: '',
  milestones: [],
}

/* ========================================================================== */
/*  useGridData - compute staff cell data for every 5-min slot                */
/* ========================================================================== */
function useGridData(
  timeSlots: string[],
  staff: StaffMember[],
  sessions: Session[],
  assignments: Assignment[],
  roles: Role[],
  staffOverrides: StaffOverride[]
) {
  const gridData = useMemo(() => {
    const roleMap = new Map(roles.map((r) => [r.id, r]))
    const assignMap = new Map<string, Assignment>()

    // Build a lookup for global staff overrides
    const globalOvMap = new Map<string, { startMin: number; endMin: number; ov: StaffOverride }[]>()
    for (const so of staffOverrides) {
      const list = globalOvMap.get(so.staffId) || []
      list.push({
        startMin: timeToMinutes(so.startTime),
        endMin: timeToMinutes(so.endTime),
        ov: so,
      })
      globalOvMap.set(so.staffId, list)
    }
    for (const a of assignments) {
      assignMap.set(`${a.sessionId}::${a.staffId}`, a)
    }

    // Pre-compute milestone absolute times per session
    const sessionMilestoneMap = new Map<string, Map<string, ResolvedMilestone[]>>()
    for (const session of sessions) {
      const milestones = session.milestones || []
      if (milestones.length === 0) continue
      const slotMap = new Map<string, ResolvedMilestone[]>()
      const baseMin = timeToMinutes(session.startTime)
      for (const ms of milestones) {
        if (!ms.label) continue
        const absMin = baseMin + ms.offsetMinutes
        const snapped = Math.floor(absMin / 5) * 5
        const slotKey = minutesToTime(snapped)
        const resolved: ResolvedMilestone = { time: minutesToTime(absMin), label: ms.label }
        const existing = slotMap.get(slotKey)
        if (existing) existing.push(resolved)
        else slotMap.set(slotKey, [resolved])
      }
      sessionMilestoneMap.set(session.id, slotMap)
    }

    const sortedSessions = [...sessions].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    )

    const grid: CellInfo[][] = timeSlots.map((slot) => {
      const slotMin = timeToMinutes(slot)
      return staff.map((s) => {
        // Priority 1: Global staff overrides
        const globalOvs = globalOvMap.get(s.id)
        if (globalOvs) {
          for (const { startMin, endMin, ov } of globalOvs) {
            if (slotMin >= startMin && slotMin < endMin) {
              const role = roleMap.get(ov.roleId)
              let slotMilestones: ResolvedMilestone[] = []
              for (const session of sortedSessions) {
                const sStart = timeToMinutes(session.startTime)
                const sEnd = timeToMinutes(session.endTime)
                if (slotMin >= sStart && slotMin < sEnd) {
                  slotMilestones = sessionMilestoneMap.get(session.id)?.get(slot) ?? []
                  break
                }
              }
              return {
                sessionId: null, roleId: ov.roleId,
                roleName: role?.name ?? '', roleColor: role?.color ?? '', roleTextColor: role?.textColor ?? '',
                sessionTitle: '', isOverride: true, isGlobalOverride: true,
                note: ov.note ?? '', milestones: slotMilestones,
              }
            }
          }
        }

        // Priority 2+3: Session overrides and assignments
        for (const session of sortedSessions) {
          const start = timeToMinutes(session.startTime)
          const end = timeToMinutes(session.endTime)
          if (slotMin >= start && slotMin < end) {
            const assignment = assignMap.get(`${session.id}::${s.id}`)
            if (!assignment) {
              return {
                sessionId: session.id, roleId: null, roleName: '', roleColor: '', roleTextColor: '',
                sessionTitle: session.title, isOverride: false, isGlobalOverride: false,
                note: '', milestones: sessionMilestoneMap.get(session.id)?.get(slot) ?? [],
              }
            }

            // Session-level overrides (offset-based)
            const overrides = assignment.overrides || []
            for (const ov of overrides) {
              const ovStart = start + (ov.startOffsetMinutes ?? 0)
              const ovEnd = start + (ov.endOffsetMinutes ?? end - start)
              if (slotMin >= ovStart && slotMin < ovEnd) {
                const role = roleMap.get(ov.roleId)
                return {
                  sessionId: session.id, roleId: ov.roleId,
                  roleName: role?.name ?? '', roleColor: role?.color ?? '', roleTextColor: role?.textColor ?? '',
                  sessionTitle: session.title, isOverride: true, isGlobalOverride: false,
                  note: ov.note ?? '', milestones: sessionMilestoneMap.get(session.id)?.get(slot) ?? [],
                }
              }
            }

            // Default role
            const role = assignment.roleId ? roleMap.get(assignment.roleId) : null
            return {
              sessionId: session.id, roleId: assignment.roleId || null,
              roleName: role?.name ?? '', roleColor: role?.color ?? '', roleTextColor: role?.textColor ?? '',
              sessionTitle: session.title, isOverride: false, isGlobalOverride: false,
              note: assignment.note ?? '', milestones: sessionMilestoneMap.get(session.id)?.get(slot) ?? [],
            }
          }
        }
        return EMPTY_CELL
      })
    })

    return grid
  }, [timeSlots, staff, sessions, assignments, roles, staffOverrides])

  // Merge consecutive identical cells vertically per column
  const mergedGrid = useMemo(() => {
    const result: MergedCell[][] = timeSlots.map(() =>
      staff.map(() => ({ rowSpan: 1, info: EMPTY_CELL, isFirst: true }))
    )

    for (let col = 0; col < staff.length; col++) {
      let spanStart = 0
      for (let row = 1; row <= timeSlots.length; row++) {
        const prev = row > 0 ? gridData[row - 1]?.[col] : null
        const curr = row < timeSlots.length ? gridData[row]?.[col] : null

        const sameGroup =
          curr && prev &&
          curr.sessionId === prev.sessionId &&
          curr.roleId === prev.roleId &&
          curr.isOverride === prev.isOverride &&
          curr.isGlobalOverride === prev.isGlobalOverride &&
          curr.note === prev.note

        if (!sameGroup || row === timeSlots.length) {
          const spanLength = row - spanStart
          if (spanLength > 0 && gridData[spanStart]) {
            result[spanStart][col] = { rowSpan: spanLength, info: gridData[spanStart][col], isFirst: true }
            for (let r = spanStart + 1; r < row; r++) {
              result[r][col] = { rowSpan: 0, info: gridData[r][col], isFirst: false }
            }
          }
          spanStart = row
        }
      }
    }

    return result
  }, [timeSlots, staff, gridData])

  return { gridData, mergedGrid }
}

/* ========================================================================== */
/*  useSessionColumn - compute session-name column with rowspan merging       */
/* ========================================================================== */
function useSessionColumn(timeSlots: string[], sessions: Session[]) {
  return useMemo(() => {
    const sorted = [...sessions].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    )

    // Map each slot to a session (or null)
    const slotSession: (Session | null)[] = timeSlots.map((slot) => {
      const slotMin = timeToMinutes(slot)
      for (const s of sorted) {
        const start = timeToMinutes(s.startTime)
        const end = timeToMinutes(s.endTime)
        if (slotMin >= start && slotMin < end) return s
      }
      return null
    })

    // Merge consecutive identical sessions
    const result: SessionColCell[] = timeSlots.map(() => ({
      sessionId: null, title: '', rowSpan: 1, isFirst: true,
    }))

    let spanStart = 0
    for (let row = 1; row <= timeSlots.length; row++) {
      const prev = slotSession[row - 1]
      const curr = row < timeSlots.length ? slotSession[row] : null
      const same = curr && prev && curr.id === prev.id

      if (!same || row === timeSlots.length) {
        const spanLen = row - spanStart
        const s = slotSession[spanStart]
        result[spanStart] = {
          sessionId: s?.id ?? null,
          title: s?.title ?? '',
          rowSpan: spanLen,
          isFirst: true,
        }
        for (let r = spanStart + 1; r < row; r++) {
          result[r] = { sessionId: s?.id ?? null, title: '', rowSpan: 0, isFirst: false }
        }
        spanStart = row
      }
    }

    return result
  }, [timeSlots, sessions])
}

/* ========================================================================== */
/*  DayGridTable - renders the actual HTML table for one day                  */
/* ========================================================================== */
function DayGridTable({
  dayLabel,
  staff,
  roles,
  sessions,
  timeSlots,
  gridData,
  mergedGrid,
  gridStartTime,
  gridEndTime,
  isLast,
}: {
  dayLabel: string
  staff: StaffMember[]
  roles: Role[]
  sessions: Session[]
  timeSlots: string[]
  gridData: CellInfo[][]
  mergedGrid: MergedCell[][]
  gridStartTime: string
  gridEndTime: string
  isLast: boolean
}) {
  const sessionCol = useSessionColumn(timeSlots, sessions)

  // Compute fixed column widths
  const TIME_COL_W = 56
  const SESSION_COL_W = 88
  const STAFF_COL_W = 120
  const totalW = TIME_COL_W + SESSION_COL_W + staff.length * STAFF_COL_W

  return (
    <div className={`shift-grid-day ${!isLast ? 'print-page-break' : ''}`}>
      {/* Print header */}
      <div className="hidden print-only mb-2">
        <h2 className="text-sm font-bold text-foreground">{dayLabel}</h2>
        <p className="text-xs text-muted-foreground">
          {gridStartTime + ' ~ ' + gridEndTime + ' / 5分刻み'}
        </p>
      </div>

      <div className="shift-grid-container overflow-auto max-h-[70vh]">
        <table
          className="shift-grid-table border-collapse text-xs"
          style={{ tableLayout: 'fixed', width: `${totalW}px`, minWidth: `${totalW}px` }}
        >
          <colgroup>
            <col style={{ width: `${TIME_COL_W}px` }} />
            <col style={{ width: `${SESSION_COL_W}px` }} />
            {staff.map((s) => (
              <col key={s.id} style={{ width: `${STAFF_COL_W}px` }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="border border-border bg-secondary text-secondary-foreground px-1 py-1.5 text-left font-semibold sticky left-0 z-20">
                時刻
              </th>
              <th className="border border-border bg-muted text-muted-foreground px-1 py-1.5 text-center font-semibold">
                セッション
              </th>
              {staff.map((s) => (
                <th
                  key={s.id}
                  className="border border-border bg-secondary text-secondary-foreground px-1 py-1.5 text-center font-semibold truncate"
                >
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((slot, rowIdx) => {
              const minutes = timeToMinutes(slot)
              const isHour = minutes % 60 === 0
              const isHalfHour = minutes % 30 === 0

              const sc = sessionCol[rowIdx]

              return (
                <tr key={slot}>
                  {/* ── Time column ── */}
                  <td
                    className={`border border-border px-1 py-0 text-right font-mono sticky left-0 z-[5] ${
                      isHour
                        ? 'bg-secondary text-secondary-foreground font-semibold'
                        : isHalfHour
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-card text-muted-foreground'
                    }`}
                    style={{ height: '16px', lineHeight: '16px' }}
                  >
                    {isHour || isHalfHour ? slot : ''}
                  </td>

                  {/* ── Session name column ── */}
                  {sc.isFirst && (
                    <td
                      rowSpan={sc.rowSpan}
                      className={`border border-border px-1 text-center overflow-hidden ${
                        sc.sessionId
                          ? 'bg-muted/70 font-semibold text-foreground'
                          : 'bg-card text-muted-foreground/40'
                      }`}
                      style={{ height: `${sc.rowSpan * 16}px` }}
                      title={sc.title || undefined}
                    >
                      {sc.title && sc.rowSpan >= 2 ? (
                        <div className="flex items-center justify-center h-full overflow-hidden">
                          <span className="text-[10px] leading-tight break-words line-clamp-3 max-w-full">
                            {sc.title}
                          </span>
                        </div>
                      ) : sc.title ? (
                        <span className="text-[8px] truncate">{sc.title}</span>
                      ) : null}
                    </td>
                  )}

                  {/* ── Staff columns ── */}
                  {staff.map((s, colIdx) => {
                    const cell = mergedGrid[rowIdx]?.[colIdx]
                    if (!cell || !cell.isFirst) return null

                    const { info, rowSpan } = cell
                    const hasRole = info.roleId && info.roleColor

                    // Collect milestones across the merged span
                    const spanMilestones: { ms: ResolvedMilestone; rowOffset: number }[] = []
                    for (let r = rowIdx; r < rowIdx + rowSpan && r < gridData.length; r++) {
                      const cellData = gridData[r]?.[colIdx]
                      if (cellData?.milestones) {
                        for (const ms of cellData.milestones) {
                          spanMilestones.push({ ms, rowOffset: r - rowIdx })
                        }
                      }
                    }

                    // Auto-contrast text color
                    const effectiveTextColor =
                      hasRole && info.roleColor ? getContrastTextColor(info.roleColor) : undefined

                    // Tooltip always shows full info
                    const tipParts: string[] = []
                    if (info.roleName) tipParts.push(info.roleName)
                    if (info.note) tipParts.push(info.note)
                    if (info.isGlobalOverride) tipParts.push('(個別予定)')
                    else if (info.isOverride) tipParts.push('(個別調整)')
                    const cellTooltip = tipParts.join(' / ')

                    return (
                      <td
                        key={s.id}
                        rowSpan={rowSpan}
                        className={`border border-border text-center relative overflow-hidden ${
                          !hasRole && info.sessionId
                            ? 'bg-muted/30'
                            : !hasRole
                              ? 'bg-card'
                              : ''
                        }`}
                        style={
                          hasRole
                            ? { backgroundColor: info.roleColor, color: effectiveTextColor, height: `${rowSpan * 16}px` }
                            : { height: `${rowSpan * 16}px` }
                        }
                        title={cellTooltip || undefined}
                      >
                        {/* 
                          Strict display rule:
                          - note exists → show note only
                          - note empty  → show nothing (background color still visible)
                        */}
                        {info.note && rowSpan >= 2 ? (
                          <div className="flex items-center justify-center h-full leading-tight px-0.5 overflow-hidden">
                            <span className="text-[10px] font-medium truncate max-w-full shift-grid-note">
                              {info.note}
                            </span>
                          </div>
                        ) : info.note && rowSpan >= 1 ? (
                          <div className="flex items-center justify-center h-full overflow-hidden">
                            <span className="text-[8px] font-medium truncate max-w-full px-0.5 leading-none">
                              {info.note}
                            </span>
                          </div>
                        ) : null}

                        {/* Milestone indicators - positioned at actual time row */}
                        {spanMilestones.map(({ ms, rowOffset }, msIdx) => {
                          const topPercent = (rowOffset / rowSpan) * 100
                          return (
                            <div
                              key={ms.time + '-' + msIdx}
                              className="absolute left-0 right-0 flex justify-end pr-px pointer-events-none"
                              style={{ top: `${topPercent}%` }}
                            >
                              <span
                                className="milestone-badge pointer-events-auto inline-flex items-center gap-0.5 px-1 py-px rounded-sm text-[7px] font-bold leading-none whitespace-nowrap cursor-default shadow-sm border"
                                style={{
                                  backgroundColor: 'rgba(255,255,255,0.92)',
                                  color: '#1a1a1a',
                                  borderColor: 'rgba(0,0,0,0.2)',
                                }}
                                title={ms.time + ' ' + ms.label}
                              >
                                <FileText className="h-2 w-2 shrink-0 text-primary" />
                                <span className="milestone-time font-mono">{ms.time}</span>
                                <span className="milestone-screen-label truncate max-w-[44px]">{ms.label}</span>
                                <span className="hidden milestone-print-label">{ms.label}</span>
                              </span>
                            </div>
                          )
                        })}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ========================================================================== */
/*  SingleDayGrid - filters data by day and delegates to DayGridTable         */
/* ========================================================================== */
function SingleDayGrid({
  day,
  staff,
  roles,
  sessions,
  assignments,
  staffOverrides,
  gridStartTime,
  gridEndTime,
  isLast,
}: {
  day: DayConfig
  staff: StaffMember[]
  roles: Role[]
  sessions: Session[]
  assignments: Assignment[]
  staffOverrides: StaffOverride[]
  gridStartTime: string
  gridEndTime: string
  isLast: boolean
}) {
  const daySessions = sessions.filter((s) => s.dayId === day.id)
  const daySessionIds = new Set(daySessions.map((s) => s.id))
  const dayAssignments = assignments.filter((a) => daySessionIds.has(a.sessionId))
  const dayStaffOverrides = staffOverrides.filter((so) => so.dayId === day.id)

  const timeSlots = useMemo(
    () => generateTimeSlots(gridStartTime, gridEndTime, 5),
    [gridStartTime, gridEndTime]
  )

  const { gridData, mergedGrid } = useGridData(
    timeSlots, staff, daySessions, dayAssignments, roles, dayStaffOverrides
  )

  const dayLabel = day.label + (day.date ? ` (${day.date})` : '')

  return (
    <DayGridTable
      dayLabel={dayLabel}
      staff={staff}
      roles={roles}
      sessions={daySessions}
      timeSlots={timeSlots}
      gridData={gridData}
      mergedGrid={mergedGrid}
      gridStartTime={gridStartTime}
      gridEndTime={gridEndTime}
      isLast={isLast}
    />
  )
}

/* ========================================================================== */
/*  ShiftGrid - main export                                                   */
/* ========================================================================== */
export function ShiftGrid({
  staff,
  roles,
  sessions,
  assignments,
  staffOverrides,
  days,
  gridStartTime,
  gridEndTime,
}: ShiftGridProps) {
  const handlePrint = () => {
    window.print()
  }

  if (staff.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          スタッフが登録されていません。設定画面からスタッフを追加してください。
        </CardContent>
      </Card>
    )
  }

  const defaultTab = days[0]?.id?.toString() ?? '1'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between no-print">
        <div>
          <h3 className="font-semibold text-sm text-foreground">シフト表プレビュー</h3>
          <p className="text-xs text-muted-foreground">
            {gridStartTime + ' ~ ' + gridEndTime + ' / 5分刻み'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="flex items-center gap-2 flex-wrap">
            {roles.map((r) => (
              <div key={r.id} className="flex items-center gap-1">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: r.color }}
                />
                <span className="text-xs text-muted-foreground">{r.name}</span>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handlePrint} className="bg-transparent">
            <Printer className="h-4 w-4 mr-1" />
            印刷
          </Button>
        </div>
      </div>

      {/* Tabs for day selection */}
      <Tabs defaultValue={defaultTab}>
        <div className="no-print">
          <TabsList className="mb-2">
            {days.map((d) => (
              <TabsTrigger key={d.id} value={d.id.toString()}>
                {d.label}
                {d.date ? ` (${d.date})` : ''}
              </TabsTrigger>
            ))}
            <TabsTrigger value="all">全日程</TabsTrigger>
          </TabsList>
        </div>

        {days.map((d) => (
          <TabsContent key={d.id} value={d.id.toString()}>
            <Card className="overflow-hidden">
              <SingleDayGrid
                day={d}
                staff={staff}
                roles={roles}
                sessions={sessions}
                assignments={assignments}
                staffOverrides={staffOverrides}
                gridStartTime={gridStartTime}
                gridEndTime={gridEndTime}
                isLast
              />
            </Card>
          </TabsContent>
        ))}

        <TabsContent value="all">
          <div className="flex flex-col gap-6">
            {days.map((d, idx) => (
              <div key={d.id}>
                <h3 className="text-sm font-semibold mb-2 text-foreground">
                  {d.label}
                  {d.date ? ` (${d.date})` : ''}
                </h3>
                <Card className="overflow-hidden">
                  <SingleDayGrid
                    day={d}
                    staff={staff}
                    roles={roles}
                    sessions={sessions}
                    assignments={assignments}
                    staffOverrides={staffOverrides}
                    gridStartTime={gridStartTime}
                    gridEndTime={gridEndTime}
                    isLast={idx === days.length - 1}
                  />
                </Card>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
