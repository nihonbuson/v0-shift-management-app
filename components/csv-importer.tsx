'use client'

import React from "react"

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { Upload, FileUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { ShiftData, StaffMember, Session, Role, Assignment } from '@/lib/types'
import { generateId, DEFAULT_ROLES } from '@/lib/types'

interface CsvImporterProps {
  currentRoles: Role[]
  onImport: (data: Partial<ShiftData>) => void
}

interface ParsedResult {
  staff: StaffMember[]
  sessions: Session[]
  roles: Role[]
  assignments: Assignment[]
  warnings: string[]
}

function parseCSV(csvText: string, currentRoles: Role[]): ParsedResult {
  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: false,
  })

  const rows = result.data
  const warnings: string[] = []

  // Strategy: Find the row with staff names (header row)
  // and the time-based data rows below it.
  // The staff names row typically has empty first cell, then staff names in subsequent cells.
  // Time rows have HH:MM in the first cell.

  let staffHeaderRowIdx = -1
  let staffNames: string[] = []
  let staffStartCol = 1

  // Find staff header row: look for a row where multiple cells have non-empty, non-time, non-date text
  const timeRegex = /^\d{1,2}:\d{2}$/
  const dateRegex = /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    if (!row || row.length < 2) continue

    // Skip rows that look like dates or are mostly empty
    if (dateRegex.test((row[0] || '').trim())) continue

    // Count non-empty, non-time cells starting from col 1
    let nameCount = 0
    for (let c = 1; c < row.length; c++) {
      const cell = (row[c] || '').trim()
      if (cell && !timeRegex.test(cell) && !dateRegex.test(cell) && cell.length < 20) {
        nameCount++
      }
    }

    if (nameCount >= 2) {
      staffHeaderRowIdx = i
      break
    }
  }

  if (staffHeaderRowIdx === -1) {
    warnings.push('スタッフ名の行が見つかりませんでした。2行目以降にスタッフ名がある形式のCSVを使用してください。')
    return { staff: [], sessions: [], roles: currentRoles, assignments: [], warnings }
  }

  // Extract staff names
  const headerRow = rows[staffHeaderRowIdx]
  for (let c = staffStartCol; c < headerRow.length; c++) {
    const name = (headerRow[c] || '').trim()
    if (name) {
      staffNames.push(name)
    }
  }

  const staffMembers: StaffMember[] = staffNames.map(name => ({
    id: generateId(),
    name,
  }))

  // Build a role name -> role mapping from existing roles
  const roleNameMap = new Map<string, Role>(currentRoles.map(r => [r.name, r]))
  const newRoles = [...currentRoles]

  // Parse time-based rows
  const dataStartRow = staffHeaderRowIdx + 1
  const sessions: Session[] = []
  const assignments: Assignment[] = []

  // Track ongoing sessions per staff
  interface ActiveSession {
    staffIdx: number
    roleName: string
    startTime: string
    sessionId: string
  }

  const active: (ActiveSession | null)[] = staffNames.map(() => null)

  const finishSession = (staffIdx: number, endTime: string) => {
    const a = active[staffIdx]
    if (!a) return

    // Find or create session
    let session = sessions.find(
      s => s.startTime === a.startTime && s.endTime === endTime
    )
    if (!session) {
      // Try to find one with matching title/time
      session = {
        id: generateId(),
        title: a.roleName || `セッション`,
        startTime: a.startTime,
        endTime: endTime,
      }
      sessions.push(session)
    }

    // Find or create role
    let role = roleNameMap.get(a.roleName)
    if (!role && a.roleName) {
      const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#14b8a6', '#f97316']
      role = {
        id: generateId(),
        name: a.roleName,
        color: colors[newRoles.length % colors.length],
        textColor: '#ffffff',
      }
      roleNameMap.set(a.roleName, role)
      newRoles.push(role)
    }

    if (role) {
      assignments.push({
        sessionId: session.id,
        staffId: staffMembers[staffIdx].id,
        roleId: role.id,
      })
    }

    active[staffIdx] = null
  }

  let lastTime = ''

  for (let row = dataStartRow; row < rows.length; row++) {
    const rowData = rows[row]
    if (!rowData || rowData.length === 0) continue

    const timeCell = (rowData[0] || '').trim()
    if (!timeRegex.test(timeCell)) continue

    const currentTime = timeCell.padStart(5, '0')

    // For each staff column, check if the content changed
    for (let si = 0; si < staffNames.length; si++) {
      const cellValue = (rowData[si + staffStartCol] || '').trim()
      const prevActive = active[si]

      if (prevActive && prevActive.roleName !== cellValue) {
        // Content changed - finish previous
        finishSession(si, currentTime)
      }

      if (cellValue && (!active[si] || active[si]?.roleName !== cellValue)) {
        // Start new active
        active[si] = {
          staffIdx: si,
          roleName: cellValue,
          startTime: currentTime,
          sessionId: '',
        }
      } else if (!cellValue && active[si]) {
        finishSession(si, currentTime)
      }
    }

    lastTime = currentTime
  }

  // Finish any remaining active sessions with +5 minutes from last time
  if (lastTime) {
    const [h, m] = lastTime.split(':').map(Number)
    const endMin = h * 60 + m + 5
    const endH = Math.floor(endMin / 60)
    const endM = endMin % 60
    const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`
    for (let si = 0; si < staffNames.length; si++) {
      if (active[si]) {
        finishSession(si, endTime)
      }
    }
  }

  // Deduplicate sessions with same time range - merge them
  const mergedSessions: Session[] = []
  const sessionIdRemap = new Map<string, string>()

  for (const session of sessions) {
    const existing = mergedSessions.find(
      s => s.startTime === session.startTime && s.endTime === session.endTime
    )
    if (existing) {
      sessionIdRemap.set(session.id, existing.id)
    } else {
      mergedSessions.push(session)
      sessionIdRemap.set(session.id, session.id)
    }
  }

  // Remap assignment session IDs
  const remappedAssignments = assignments.map(a => ({
    ...a,
    sessionId: sessionIdRemap.get(a.sessionId) || a.sessionId,
  }))

  if (staffMembers.length > 0) {
    warnings.push(`${staffMembers.length}名のスタッフをインポートしました。`)
  }
  if (mergedSessions.length > 0) {
    warnings.push(`${mergedSessions.length}件のセッションを検出しました。`)
  }

  return {
    staff: staffMembers,
    sessions: mergedSessions,
    roles: newRoles,
    assignments: remappedAssignments,
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
    // Try Shift_JIS first for Japanese CSV files
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
    })
    setParseResult(null)
    setFileName('')
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSVインポート</CardTitle>
          <CardDescription>
            既存のスプレッドシート（CSV形式）をアップロードして、スタッフ名とセッション情報を自動取り込みします。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
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
            <p className="text-sm font-medium">CSVファイルをドラッグ&ドロップ</p>
            <p className="text-xs text-muted-foreground mt-1">またはクリックしてファイルを選択</p>
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
            {/* Warnings */}
            {parseResult.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {parseResult.staff.length > 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                )}
                <span>{w}</span>
              </div>
            ))}

            {/* Staff preview */}
            {parseResult.staff.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">スタッフ</h4>
                <div className="flex flex-wrap gap-1.5">
                  {parseResult.staff.map((s) => (
                    <span key={s.id} className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs font-medium">
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Sessions preview */}
            {parseResult.sessions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">セッション</h4>
                <div className="flex flex-col gap-1">
                  {parseResult.sessions.map((s) => (
                    <div key={s.id} className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="font-mono">{s.startTime + ' - ' + s.endTime}</span>
                      <span className="font-medium text-foreground">{s.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Roles */}
            {parseResult.roles.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">役割</h4>
                <div className="flex flex-wrap gap-1.5">
                  {parseResult.roles.map((r) => (
                    <span
                      key={r.id}
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: r.color, color: r.textColor }}
                    >
                      {r.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleImport} disabled={parseResult.staff.length === 0}>
                インポート実行
              </Button>
              <Button variant="outline" onClick={() => { setParseResult(null); setFileName('') }}>
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
            <p>以下の形式のCSVに対応しています:</p>
            <div className="bg-muted rounded p-3 font-mono overflow-auto">
              <div>,田中,鈴木,佐藤,高橋</div>
              <div>09:00,発表,サポート,,撮影</div>
              <div>09:05,発表,サポート,,撮影</div>
              <div>09:10,発表,サポート,,撮影</div>
              <div>...</div>
            </div>
            <ul className="list-disc list-inside flex flex-col gap-1 mt-1">
              <li>1行目: 日付行や空行（自動スキップ）</li>
              <li>スタッフ名行: 2列目以降にスタッフ名</li>
              <li>データ行: 1列目にHH:MM形式の時刻、2列目以降に役割名</li>
              <li>空のセルは「未割当」として扱います</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
