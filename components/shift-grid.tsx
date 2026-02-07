'use client'

import { useMemo } from 'react'
import { Printer, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { StaffMember, Role, Session, Assignment, DayConfig } from '@/lib/types'
import { timeToMinutes, minutesToTime, generateTimeSlots } from '@/lib/types'

interface ShiftGridProps {
  staff: StaffMember[]
  roles: Role[]
  sessions: Session[]
  assignments: Assignment[]
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
  note: string
  milestones: ResolvedMilestone[] // milestones that land on this 5-min slot
}

interface MergedCell {
  rowSpan: number
  info: CellInfo
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
  note: '',
  milestones: [],
}

function useGridData(
  timeSlots: string[],
  staff: StaffMember[],
  sessions: Session[],
  assignments: Assignment[],
  roles: Role[]
) {
  const gridData = useMemo(() => {
    const roleMap = new Map(roles.map((r) => [r.id, r]))
    const assignMap = new Map<string, Assignment>()
    for (const a of assignments) {
      assignMap.set(`${a.sessionId}::${a.staffId}`, a)
    }

    // Pre-compute milestone absolute times per session, keyed by slot time
    const sessionMilestoneMap = new Map<string, Map<string, ResolvedMilestone[]>>()
    for (const session of sessions) {
      const milestones = session.milestones || []
      if (milestones.length === 0) continue
      const slotMap = new Map<string, ResolvedMilestone[]>()
      const baseMin = timeToMinutes(session.startTime)
      for (const ms of milestones) {
        if (!ms.label) continue
        const absMin = baseMin + ms.offsetMinutes
        // Snap to 5-min slot
        const snapped = Math.floor(absMin / 5) * 5
        const slotKey = minutesToTime(snapped)
        const resolved: ResolvedMilestone = {
          time: minutesToTime(absMin),
          label: ms.label,
        }
        const existing = slotMap.get(slotKey)
        if (existing) {
          existing.push(resolved)
        } else {
          slotMap.set(slotKey, [resolved])
        }
      }
      sessionMilestoneMap.set(session.id, slotMap)
    }

    const sortedSessions = [...sessions].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    )

    const grid: CellInfo[][] = timeSlots.map((slot) => {
      const slotMin = timeToMinutes(slot)
      return staff.map((s) => {
        for (const session of sortedSessions) {
          const start = timeToMinutes(session.startTime)
          const end = timeToMinutes(session.endTime)
          if (slotMin >= start && slotMin < end) {
            const assignment = assignMap.get(`${session.id}::${s.id}`)
            if (!assignment) {
              return {
                sessionId: session.id,
                roleId: null,
                roleName: '',
                roleColor: '',
                roleTextColor: '',
                sessionTitle: session.title,
                isOverride: false,
                note: '',
                milestones: sessionMilestoneMap.get(session.id)?.get(slot) ?? [],
              }
            }

            // Check overrides first (highest priority) - offset-based
            const overrides = assignment.overrides || []
            for (const ov of overrides) {
              const ovStart = start + (ov.startOffsetMinutes ?? 0)
              const ovEnd = start + (ov.endOffsetMinutes ?? end - start)
              if (slotMin >= ovStart && slotMin < ovEnd) {
                const role = roleMap.get(ov.roleId)
                return {
                  sessionId: session.id,
                  roleId: ov.roleId,
                  roleName: role?.name ?? '',
                  roleColor: role?.color ?? '',
                  roleTextColor: role?.textColor ?? '',
                  sessionTitle: session.title,
                  isOverride: true,
                  note: ov.note ?? '',
                  milestones: sessionMilestoneMap.get(session.id)?.get(slot) ?? [],
                }
              }
            }

            // Default role
            const role = assignment.roleId
              ? roleMap.get(assignment.roleId)
              : null
            return {
              sessionId: session.id,
              roleId: assignment.roleId || null,
              roleName: role?.name ?? '',
              roleColor: role?.color ?? '',
              roleTextColor: role?.textColor ?? '',
              sessionTitle: session.title,
              isOverride: false,
              note: assignment.note ?? '',
              milestones: sessionMilestoneMap.get(session.id)?.get(slot) ?? [],
            }
          }
        }
        return EMPTY_CELL
      })
    })

    return grid
  }, [timeSlots, staff, sessions, assignments, roles])

  // Merge cells with rowspan
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
          curr &&
          prev &&
          curr.sessionId === prev.sessionId &&
          curr.roleId === prev.roleId &&
          curr.isOverride === prev.isOverride &&
          curr.note === prev.note

        if (!sameGroup || row === timeSlots.length) {
          const spanLength = row - spanStart
          if (spanLength > 0 && gridData[spanStart]) {
            result[spanStart][col] = {
              rowSpan: spanLength,
              info: gridData[spanStart][col],
              isFirst: true,
            }
            for (let r = spanStart + 1; r < row; r++) {
              result[r][col] = {
                rowSpan: 0,
                info: gridData[r][col],
                isFirst: false,
              }
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

/* ─── Single day grid table ─── */
function DayGridTable({
  dayLabel,
  staff,
  roles,
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
  timeSlots: string[]
  gridData: CellInfo[][]
  mergedGrid: MergedCell[][]
  gridStartTime: string
  gridEndTime: string
  isLast: boolean
}) {
  return (
    <div
      className={`shift-grid-day ${!isLast ? 'print-page-break' : ''}`}
    >
      {/* Print header */}
      <div className="hidden print-only mb-2">
        <h2 className="text-sm font-bold text-foreground">{dayLabel}</h2>
        <p className="text-xs text-muted-foreground">
          {gridStartTime + ' ~ ' + gridEndTime + ' / 5分刻み'}
        </p>
      </div>

      <div className="shift-grid-container overflow-auto max-h-[70vh]">
        <table className="shift-grid-table w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="border border-border bg-secondary text-secondary-foreground px-2 py-1.5 text-left font-semibold sticky left-0 z-20 min-w-[56px]">
                時刻
              </th>
              {staff.map((s) => (
                <th
                  key={s.id}
                  className="border border-border bg-secondary text-secondary-foreground px-2 py-1.5 text-center font-semibold min-w-[72px]"
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

              return (
                <tr key={slot}>
                  <td
                    className={`border border-border px-1.5 py-0 text-right font-mono sticky left-0 z-[5] ${
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
                  {staff.map((s, colIdx) => {
                    const cell = mergedGrid[rowIdx]?.[colIdx]
                    if (!cell || !cell.isFirst) return null

                    const { info, rowSpan } = cell
                    const hasRole = info.roleId && info.roleColor

                    // Collect all milestones across the merged row span
                    // with their relative position (row offset within the span)
                    const spanMilestones: { ms: ResolvedMilestone; rowOffset: number }[] = []
                    for (let r = rowIdx; r < rowIdx + rowSpan && r < gridData.length; r++) {
                      const cellData = gridData[r]?.[colIdx]
                      if (cellData?.milestones) {
                        for (const ms of cellData.milestones) {
                          spanMilestones.push({ ms, rowOffset: r - rowIdx })
                        }
                      }
                    }

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
                            ? {
                                backgroundColor: info.roleColor,
                                color: info.roleTextColor,
                                height: `${rowSpan * 16}px`,
                              }
                            : { height: `${rowSpan * 16}px` }
                        }
                      >
                        {/* Role / note content - centered */}
                        {hasRole && rowSpan >= 3 ? (
                          <div className="flex flex-col items-center justify-center h-full leading-tight px-0.5 overflow-hidden">
                            <span className="font-semibold text-[10px] truncate max-w-full">
                              {info.roleName}
                            </span>
                            {info.note && rowSpan >= 4 && (
                              <span className="text-[9px] opacity-90 font-medium truncate max-w-full shift-grid-note">
                                {info.note}
                              </span>
                            )}
                            {!info.note && rowSpan >= 6 && (
                              <span className="text-[9px] opacity-80 truncate max-w-full">
                                {info.sessionTitle}
                              </span>
                            )}
                            {info.isOverride && rowSpan >= 4 && !info.note && (
                              <span className="text-[8px] opacity-60 italic">
                                {'(個別調整)'}
                              </span>
                            )}
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

/* ─── Single day wrapper ─── */
function SingleDayGrid({
  day,
  staff,
  roles,
  sessions,
  assignments,
  gridStartTime,
  gridEndTime,
  isLast,
}: {
  day: DayConfig
  staff: StaffMember[]
  roles: Role[]
  sessions: Session[]
  assignments: Assignment[]
  gridStartTime: string
  gridEndTime: string
  isLast: boolean
}) {
  const daySessions = sessions.filter((s) => s.dayId === day.id)
  const daySessionIds = new Set(daySessions.map((s) => s.id))
  const dayAssignments = assignments.filter((a) => daySessionIds.has(a.sessionId))

  const timeSlots = useMemo(
    () => generateTimeSlots(gridStartTime, gridEndTime, 5),
    [gridStartTime, gridEndTime]
  )

  const { gridData, mergedGrid } = useGridData(
    timeSlots,
    staff,
    daySessions,
    dayAssignments,
    roles
  )

  const dayLabel = day.label + (day.date ? ` (${day.date})` : '')

  return (
    <DayGridTable
      dayLabel={dayLabel}
      staff={staff}
      roles={roles}
      timeSlots={timeSlots}
      gridData={gridData}
      mergedGrid={mergedGrid}
      gridStartTime={gridStartTime}
      gridEndTime={gridEndTime}
      isLast={isLast}
    />
  )
}

/* ─── Main export ─── */
export function ShiftGrid({
  staff,
  roles,
  sessions,
  assignments,
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
          <Button variant="outline" size="sm" onClick={handlePrint}>
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
