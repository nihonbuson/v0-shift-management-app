'use client'

import React from 'react'
import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { Upload, FileUp, AlertCircle, CheckCircle2, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { ShiftData, StaffMember, Session, Role, Assignment, DayConfig } from '@/lib/types'
import { generateId, DEFAULT_ROLES } from '@/lib/types'

interface CsvImporterProps {
  currentRoles: Role[]
  onImport: (data: Partial<ShiftData>) => void
}

interface DayResult {
  dayId: number
  dateLabel: string
  sessions: Session[]
  assignments: Assignment[]
  sessionCount: number
}

interface ParsedResult {
  staff: StaffMember[]
  days: DayConfig[]
  sessions: Session[]
  roles: Role[]
  assignments: Assignment[]
  dayResults: DayResult[]
  warnings: string[]
}

// Regex patterns
const TIME_REGEX = /^\d{1,2}:\d{2}$/
const DATE_REGEX = /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/
const JP_DATE_REGEX = /(\d{1,2})月(\d{1,2})日/

function detectDateInRow(row: string[]): string | null {
  for (const cell of row) {
    const trimmed = (cell || '').trim()
    const match = trimmed.match(DATE_REGEX)
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
    const jpMatch = trimmed.match(JP_DATE_REGEX)
    if (jpMatch) return `${jpMatch[1]}月${jpMatch[2]}日`
  }
  return null
}

function isStaffHeaderRow(row: string[]): boolean {
  if (!row || row.length < 3) return false
  let nameCount = 0
  for (let c = 1; c < row.length; c++) {
    const cell = (row[c] || '').trim()
    if (
      cell &&
      !TIME_REGEX.test(cell) &&
      !DATE_REGEX.test(cell) &&
      !JP_DATE_REGEX.test(cell) &&
      cell.length < 20
    ) {
      nameCount++
    }
  }
  return nameCount >= 2
}

function isTimeRow(row: string[]): boolean {
  if (!row || row.length === 0) return false
  return TIME_REGEX.test((row[0] || '').trim())
}

/**
 * State-machine CSV parser that detects multi-day boundaries.
 *
 * States:
 * - SEEK_DAY: looking for a date row or staff header
 * - SEEK_HEADER: found a date, looking for staff header row
 * - READING_DATA: reading time-based data rows
 *
 * When a new date row is found while in READING_DATA, we finish
 * the current day and transition to SEEK_HEADER for the next day.
 */
function parseCSV(csvText: string, currentRoles: Role[]): ParsedResult {
  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: false,
  })

  const rows = result.data
  const warnings: string[] = []

  // Role name -> role mapping
  const roleNameMap = new Map<string, Role>(currentRoles.map((r) => [r.name, r]))
  const allRoles = [...currentRoles]

  const getOrCreateRole = (name: string): Role | null => {
    if (!name) return null
    let role = roleNameMap.get(name)
    if (!role) {
      const colors = [
        '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7',
        '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
      ]
      role = {
        id: generateId(),
        name,
        color: colors[allRoles.length % colors.length],
        textColor: '#ffffff',
      }
      roleNameMap.set(name, role)
      allRoles.push(role)
    }
    return role
  }

  // Unified staff list (discovered from first header row, verified with subsequent)
  let globalStaffNames: string[] = []
  let globalStaff: StaffMember[] = []
  const staffStartCol = 1

  // Per-day accumulators
  const dayResults: DayResult[] = []
  const allSessions: Session[] = []
  const allAssignments: Assignment[] = []
  const allDays: DayConfig[] = []

  // State machine
  type State = 'SEEK_DAY' | 'SEEK_HEADER' | 'READING_DATA'
  let state: State = 'SEEK_DAY'
  let currentDayId = 0
  let currentDateLabel = ''

  // For tracking active cell runs in data mode
  let activePerStaff: (
    | { roleName: string; startTime: string }
    | null
  )[] = []
  let lastTime = ''
  let daySessionCount = 0

  const finishActiveRuns = (endTime: string) => {
    for (let si = 0; si < globalStaffNames.length; si++) {
      const a = activePerStaff[si]
      if (!a) continue

      // Create or find session
      let session = allSessions.find(
        (s) =>
          s.dayId === currentDayId &&
          s.startTime === a.startTime &&
          s.endTime === endTime
      )
      if (!session) {
        session = {
          id: generateId(),
          dayId: currentDayId,
          title: a.roleName || 'セッション',
          startTime: a.startTime,
          endTime: endTime,
        }
        allSessions.push(session)
        daySessionCount++
      }

      const role = getOrCreateRole(a.roleName)
      if (role) {
        allAssignments.push({
          sessionId: session.id,
          staffId: globalStaff[si].id,
          roleId: role.id,
          overrides: [],
        })
      }
      activePerStaff[si] = null
    }
  }

  const finalizeCurrentDay = () => {
    if (currentDayId === 0) return

    // Close remaining active runs
    if (lastTime) {
      const [h, m] = lastTime.split(':').map(Number)
      const endMin = h * 60 + m + 5
      const endH = Math.floor(endMin / 60)
      const endM = endMin % 60
      const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`
      finishActiveRuns(endTime)
    }

    // Deduplicate sessions for this day
    const daySessions = allSessions.filter((s) => s.dayId === currentDayId)
    const dayAssignments = allAssignments.filter((a) =>
      daySessions.some((s) => s.id === a.sessionId)
    )

    dayResults.push({
      dayId: currentDayId,
      dateLabel: currentDateLabel,
      sessions: daySessions,
      assignments: dayAssignments,
      sessionCount: daySessions.length,
    })
  }

  const startNewDay = (dateLabel: string) => {
    finalizeCurrentDay()
    currentDayId++
    currentDateLabel = dateLabel
    allDays.push({ id: currentDayId, label: `Day ${currentDayId}`, date: dateLabel })
    activePerStaff = globalStaffNames.map(() => null)
    lastTime = ''
    daySessionCount = 0
  }

  // Process rows
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx]
    if (!row) continue

    switch (state) {
      case 'SEEK_DAY': {
        // Check for date
        const date = detectDateInRow(row)
        if (date) {
          startNewDay(date)
          state = 'SEEK_HEADER'
          break
        }
        // Check if this is a staff header without a preceding date
        if (isStaffHeaderRow(row)) {
          startNewDay('')
          // Parse staff names from this row
          if (globalStaffNames.length === 0) {
            for (let c = staffStartCol; c < row.length; c++) {
              const name = (row[c] || '').trim()
              if (name) globalStaffNames.push(name)
            }
            globalStaff = globalStaffNames.map((name) => ({
              id: generateId(),
              name,
            }))
            activePerStaff = globalStaffNames.map(() => null)
          }
          state = 'READING_DATA'
          break
        }
        break
      }

      case 'SEEK_HEADER': {
        if (isStaffHeaderRow(row)) {
          if (globalStaffNames.length === 0) {
            for (let c = staffStartCol; c < row.length; c++) {
              const name = (row[c] || '').trim()
              if (name) globalStaffNames.push(name)
            }
            globalStaff = globalStaffNames.map((name) => ({
              id: generateId(),
              name,
            }))
            activePerStaff = globalStaffNames.map(() => null)
          }
          state = 'READING_DATA'
          break
        }
        // Also check for time rows directly (header might be missing on day 2+)
        if (isTimeRow(row) && globalStaffNames.length > 0) {
          activePerStaff = globalStaffNames.map(() => null)
          state = 'READING_DATA'
          // Don't break - fall through to process this time row in READING_DATA
          // We need to re-process this row
          rowIdx--
          state = 'READING_DATA'
          break
        }
        break
      }

      case 'READING_DATA': {
        // Check if we hit a new date boundary
        const date = detectDateInRow(row)
        if (date && !isTimeRow(row)) {
          startNewDay(date)
          state = 'SEEK_HEADER'
          break
        }

        if (!isTimeRow(row)) continue

        const timeCell = (row[0] || '').trim().padStart(5, '0')

        // For each staff column, check if content changed
        for (let si = 0; si < globalStaffNames.length; si++) {
          const cellValue = (row[si + staffStartCol] || '').trim()
          const prevActive = activePerStaff[si]

          if (prevActive && prevActive.roleName !== cellValue) {
            // Content changed - finish previous run
            const a = prevActive
            let session = allSessions.find(
              (s) =>
                s.dayId === currentDayId &&
                s.startTime === a.startTime &&
                s.endTime === timeCell
            )
            if (!session) {
              session = {
                id: generateId(),
                dayId: currentDayId,
                title: a.roleName || 'セッション',
                startTime: a.startTime,
                endTime: timeCell,
              }
              allSessions.push(session)
              daySessionCount++
            }
            const role = getOrCreateRole(a.roleName)
            if (role) {
              allAssignments.push({
                sessionId: session.id,
                staffId: globalStaff[si].id,
                roleId: role.id,
                overrides: [],
              })
            }
            activePerStaff[si] = null
          }

          if (cellValue && (!activePerStaff[si] || activePerStaff[si]?.roleName !== cellValue)) {
            activePerStaff[si] = {
              roleName: cellValue,
              startTime: timeCell,
            }
          } else if (!cellValue && activePerStaff[si]) {
            // Empty cell - close active
            const a = activePerStaff[si]!
            let session = allSessions.find(
              (s) =>
                s.dayId === currentDayId &&
                s.startTime === a.startTime &&
                s.endTime === timeCell
            )
            if (!session) {
              session = {
                id: generateId(),
                dayId: currentDayId,
                title: a.roleName || 'セッション',
                startTime: a.startTime,
                endTime: timeCell,
              }
              allSessions.push(session)
              daySessionCount++
            }
            const role = getOrCreateRole(a.roleName)
            if (role) {
              allAssignments.push({
                sessionId: session.id,
                staffId: globalStaff[si].id,
                roleId: role.id,
                overrides: [],
              })
            }
            activePerStaff[si] = null
          }
        }

        lastTime = timeCell
        break
      }
    }
  }

  // Finalize last day
  finalizeCurrentDay()

  // Deduplicate sessions with same dayId + time range
  const mergedSessions: Session[] = []
  const sessionIdRemap = new Map<string, string>()

  for (const session of allSessions) {
    const existing = mergedSessions.find(
      (s) =>
        s.dayId === session.dayId &&
        s.startTime === session.startTime &&
        s.endTime === session.endTime
    )
    if (existing) {
      sessionIdRemap.set(session.id, existing.id)
    } else {
      mergedSessions.push(session)
      sessionIdRemap.set(session.id, session.id)
    }
  }

  const remappedAssignments = allAssignments.map((a) => ({
    ...a,
    sessionId: sessionIdRemap.get(a.sessionId) || a.sessionId,
  }))

  // Build feedback messages
  if (globalStaff.length > 0) {
    warnings.push(`${globalStaff.length}名のスタッフを検出しました。`)
  }
  for (const dr of dayResults) {
    const label = dr.dateLabel ? `${dr.dateLabel}` : `Day ${dr.dayId}`
    const sessCount = mergedSessions.filter(
      (s) => s.dayId === dr.dayId
    ).length
    warnings.push(`${label}: ${sessCount}セッションを読み込みました。`)
  }
  if (dayResults.length === 0 && globalStaff.length === 0) {
    warnings.push(
      'データを検出できませんでした。日付行やスタッフ名行があるCSV形式を使用してください。'
    )
  }

  // If no days were created, default
  const finalDays =
    allDays.length > 0
      ? allDays
      : [{ id: 1, label: 'Day 1' }, { id: 2, label: 'Day 2' }]

  return {
    staff: globalStaff,
    days: finalDays,
    sessions: mergedSessions,
    roles: allRoles,
    assignments: remappedAssignments,
    dayResults,
    warnings,
  }
}

export function CsvImporter({ currentRoles, onImport }: CsvImporterProps) {
  const [dragOver, setDragOver] = useState(false)
  const [parseResult, setParseResult] = useState<ParsedResult | null>(null)
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (text) {
        const result = parseCSV(text, currentRoles)
        setParseResult(result)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFile(file)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleImport = () => {
    if (!parseResult) return
    onImport({
      staff: parseResult.staff,
      sessions: parseResult.sessions,
      roles: parseResult.roles,
      assignments: parseResult.assignments,
      days: parseResult.days,
    })
    setParseResult(null)
    setFileName('')
  }

  const hasData = parseResult && parseResult.staff.length > 0

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSVインポート</CardTitle>
          <CardDescription>
            既存のスプレッドシート（CSV形式）をアップロードして、2日分のスタッフ名とセッション情報を自動取り込みします。
            日付行を検出して自動的にDay 1 / Day 2に振り分けます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click()
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              CSVファイルをドラッグ&ドロップ
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              またはクリックしてファイルを選択
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Parse Result Preview */}
      {parseResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileUp className="h-4 w-4" />
              {'インポートプレビュー: ' + fileName}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Feedback messages */}
            {parseResult.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {hasData ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                )}
                <span className="text-foreground">{w}</span>
              </div>
            ))}

            {/* Day summary cards */}
            {parseResult.dayResults.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {parseResult.dayResults.map((dr) => (
                  <div
                    key={dr.dayId}
                    className="flex items-center gap-3 rounded-lg border px-4 py-3"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {'Day ' + dr.dayId}
                        {dr.dateLabel ? ` (${dr.dateLabel})` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {parseResult.sessions.filter(
                          (s) => s.dayId === dr.dayId
                        ).length + 'セッション'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Staff preview */}
            {parseResult.staff.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-foreground">
                  スタッフ
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {parseResult.staff.map((s) => (
                    <span
                      key={s.id}
                      className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs font-medium"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Sessions preview per day */}
            {parseResult.days.map((day) => {
              const daySessions = parseResult.sessions
                .filter((s) => s.dayId === day.id)
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
              if (daySessions.length === 0) return null
              return (
                <div key={day.id}>
                  <h4 className="text-sm font-medium mb-2 text-foreground">
                    {day.label}
                    {day.date ? ` (${day.date})` : ''} - セッション
                  </h4>
                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {daySessions.map((s) => (
                      <div
                        key={s.id}
                        className="text-xs text-muted-foreground flex items-center gap-2"
                      >
                        <span className="font-mono">
                          {s.startTime + ' - ' + s.endTime}
                        </span>
                        <span className="font-medium text-foreground">
                          {s.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Roles */}
            {parseResult.roles.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-foreground">
                  役割
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {parseResult.roles.map((r) => (
                    <span
                      key={r.id}
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: r.color,
                        color: r.textColor,
                      }}
                    >
                      {r.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleImport} disabled={!hasData}>
                インポート実行
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setParseResult(null)
                  setFileName('')
                }}
              >
                キャンセル
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CSV Format Help */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">対応CSV形式</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground flex flex-col gap-2">
            <p className="text-foreground">
              日付行でDay 1 / Day 2を自動判別します:
            </p>
            <div className="bg-muted rounded p-3 font-mono overflow-auto text-foreground">
              <div className="text-muted-foreground">{'# Day 1'}</div>
              <div>2025-07-01,,,</div>
              <div>,田中,鈴木,佐藤,高橋</div>
              <div>09:00,発表,サポート,,撮影</div>
              <div>09:05,発表,サポート,,撮影</div>
              <div>...</div>
              <div className="text-muted-foreground mt-2">{'# Day 2'}</div>
              <div>2025-07-02,,,</div>
              <div>,田中,鈴木,佐藤,高橋</div>
              <div>09:00,サポート,発表,撮影,</div>
              <div>...</div>
            </div>
            <ul className="list-disc list-inside flex flex-col gap-1 mt-1">
              <li>日付行（YYYY-MM-DD or MM月DD日）を検出して日程を分割</li>
              <li>スタッフ名行: 2列目以降にスタッフ名</li>
              <li>データ行: 1列目にHH:MM形式の時刻、2列目以降に役割名</li>
              <li>連続する同じ役割名を自動でセッション結合</li>
              <li>空セルは「未割当」として扱います</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
