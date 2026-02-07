'use client'

import { useMemo, useRef } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { StaffMember, Role, Session, Assignment } from '@/lib/types'
import { timeToMinutes, generateTimeSlots } from '@/lib/types'

interface ShiftGridProps {
  staff: StaffMember[]
  roles: Role[]
  sessions: Session[]
  assignments: Assignment[]
  gridStartTime: string
  gridEndTime: string
}

interface CellInfo {
  sessionId: string | null
  roleId: string | null
  roleName: string
  roleColor: string
  roleTextColor: string
  sessionTitle: string
  isOverride: boolean
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
}

export function ShiftGrid({
  staff,
  roles,
  sessions,
  assignments,
  gridStartTime,
  gridEndTime,
}: ShiftGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const timeSlots = useMemo(
    () => generateTimeSlots(gridStartTime, gridEndTime, 5),
    [gridStartTime, gridEndTime]
  )

  // Precompute: for each time slot -> for each staff -> cell info
  // Now with override priority logic
  const gridData = useMemo(() => {
    const roleMap = new Map(roles.map(r => [r.id, r]))

    // Build assignment lookup: sessionId::staffId -> Assignment
    const assignMap = new Map<string, Assignment>()
    for (const a of assignments) {
      assignMap.set(`${a.sessionId}::${a.staffId}`, a)
    }

    const sortedSessions = [...sessions].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    )

    // For each time slot, for each staff, compute cell info
    const grid: CellInfo[][] = timeSlots.map((slot) => {
      const slotMin = timeToMinutes(slot)
      return staff.map((s) => {
        // Find which session covers this slot
        for (const session of sortedSessions) {
          const start = timeToMinutes(session.startTime)
          const end = timeToMinutes(session.endTime)
          if (slotMin >= start && slotMin < end) {
            const assignment = assignMap.get(`${session.id}::${s.id}`)
            if (!assignment) {
              // In session but not assigned
              return {
                sessionId: session.id,
                roleId: null,
                roleName: '',
                roleColor: '',
                roleTextColor: '',
                sessionTitle: session.title,
                isOverride: false,
              }
            }

            // Check if any override applies to this time slot
            // Overrides take priority over the default role
            const overrides = assignment.overrides || []
            for (const ov of overrides) {
              const ovStart = timeToMinutes(ov.startTime)
              const ovEnd = timeToMinutes(ov.endTime)
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
                }
              }
            }

            // No override matches - use default role
            const role = assignment.roleId ? roleMap.get(assignment.roleId) : null
            return {
              sessionId: session.id,
              roleId: assignment.roleId || null,
              roleName: role?.name ?? '',
              roleColor: role?.color ?? '',
              roleTextColor: role?.textColor ?? '',
              sessionTitle: session.title,
              isOverride: false,
            }
          }
        }
        return EMPTY_CELL
      })
    })

    return grid
  }, [timeSlots, staff, sessions, assignments, roles])

  // Compute merged cells with rowspan for each staff column
  const mergedGrid = useMemo(() => {
    const result: MergedCell[][] = timeSlots.map(() =>
      staff.map(() => ({ rowSpan: 1, info: EMPTY_CELL, isFirst: true }))
    )

    for (let col = 0; col < staff.length; col++) {
      let spanStart = 0
      for (let row = 1; row <= timeSlots.length; row++) {
        const prev = row > 0 ? gridData[row - 1]?.[col] : null
        const curr = row < timeSlots.length ? gridData[row]?.[col] : null

        // Check if current cell is same group as previous
        // Must match session, role, AND override status for proper merging
        const sameGroup =
          curr &&
          prev &&
          curr.sessionId === prev.sessionId &&
          curr.roleId === prev.roleId &&
          curr.isOverride === prev.isOverride

        if (!sameGroup || row === timeSlots.length) {
          const spanEnd = row
          const spanLength = spanEnd - spanStart
          if (spanLength > 0 && gridData[spanStart]) {
            result[spanStart][col] = {
              rowSpan: spanLength,
              info: gridData[spanStart][col],
              isFirst: true,
            }
            for (let r = spanStart + 1; r < spanEnd; r++) {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between no-print">
        <div>
          <h3 className="font-semibold text-sm">シフト表プレビュー</h3>
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

      <Card className="overflow-hidden">
        <div ref={gridRef} className="shift-grid-container overflow-auto max-h-[75vh]">
          <table className="shift-grid-table w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="border border-border bg-secondary text-secondary-foreground px-2 py-1.5 text-left font-semibold sticky left-0 z-20 min-w-[60px]">
                  時刻
                </th>
                {staff.map((s) => (
                  <th
                    key={s.id}
                    className="border border-border bg-secondary text-secondary-foreground px-2 py-1.5 text-center font-semibold min-w-[80px]"
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
                      className={`border border-border px-2 py-0 text-right font-mono sticky left-0 z-[5] ${
                        isHour
                          ? 'bg-secondary text-secondary-foreground font-semibold'
                          : isHalfHour
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-card text-muted-foreground'
                      }`}
                      style={{ height: '18px', lineHeight: '18px' }}
                    >
                      {isHour || isHalfHour ? slot : ''}
                    </td>
                    {staff.map((s, colIdx) => {
                      const cell = mergedGrid[rowIdx]?.[colIdx]
                      if (!cell || !cell.isFirst) return null

                      const { info, rowSpan } = cell
                      const hasRole = info.roleId && info.roleColor

                      return (
                        <td
                          key={s.id}
                          rowSpan={rowSpan}
                          className={`border border-border text-center ${
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
                                  height: `${rowSpan * 18}px`,
                                }
                              : { height: `${rowSpan * 18}px` }
                          }
                        >
                          {hasRole && rowSpan >= 3 ? (
                            <div className="flex flex-col items-center justify-center h-full leading-tight">
                              <span className="font-semibold text-[10px]">{info.roleName}</span>
                              {rowSpan >= 6 && (
                                <span className="text-[9px] opacity-80">{info.sessionTitle}</span>
                              )}
                              {info.isOverride && rowSpan >= 4 && (
                                <span className="text-[8px] opacity-60 italic">{'(個別調整)'}</span>
                              )}
                            </div>
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
