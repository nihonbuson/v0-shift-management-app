'use client'

import React from "react"

import { useRef, useState, useCallback } from 'react'
import { Save, FolderOpen, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ShiftData } from '@/lib/types'

interface ProjectIOProps {
  data: ShiftData
  onReplace: (data: ShiftData) => void
}

const REQUIRED_FIELDS: (keyof ShiftData)[] = [
  'staff',
  'roles',
  'sessions',
  'assignments',
  'days',
  'gridStartTime',
  'gridEndTime',
]

function validateProjectData(
  data: unknown
): { valid: true; data: ShiftData } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'ファイルの内容がJSON形式ではありません。' }
  }

  const obj = data as Record<string, unknown>

  const missing = REQUIRED_FIELDS.filter((key) => !(key in obj))
  if (missing.length > 0) {
    return {
      valid: false,
      error: `必須フィールドが不足しています: ${missing.join(', ')}`,
    }
  }

  if (!Array.isArray(obj.staff)) {
    return { valid: false, error: 'staff フィールドが配列ではありません。' }
  }
  if (!Array.isArray(obj.roles)) {
    return { valid: false, error: 'roles フィールドが配列ではありません。' }
  }
  if (!Array.isArray(obj.sessions)) {
    return { valid: false, error: 'sessions フィールドが配列ではありません。' }
  }
  if (!Array.isArray(obj.assignments)) {
    return { valid: false, error: 'assignments フィールドが配列ではありません。' }
  }
  if (!Array.isArray(obj.days)) {
    return { valid: false, error: 'days フィールドが配列ではありません。' }
  }

  return { valid: true, data: data as ShiftData }
}

function formatDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function ProjectIO({ data, onReplace }: ProjectIOProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingData, setPendingData] = useState<ShiftData | null>(null)
  const [pendingFileName, setPendingFileName] = useState('')
  const [resultDialog, setResultDialog] = useState<{
    open: boolean
    success: boolean
    message: string
  }>({ open: false, success: false, message: '' })

  // --- Export ---
  const handleExport = useCallback(() => {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workshop_project_${formatDate()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [data])

  // --- Import ---
  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input so the same file can be re-selected
    e.target.value = ''

    if (!file.name.endsWith('.json')) {
      setResultDialog({
        open: true,
        success: false,
        message: 'JSONファイル（.json）を選択してください。',
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string)
        const result = validateProjectData(parsed)

        if (!result.valid) {
          setResultDialog({
            open: true,
            success: false,
            message: result.error,
          })
          return
        }

        // Show confirmation dialog
        setPendingData(result.data)
        setPendingFileName(file.name)
        setConfirmOpen(true)
      } catch {
        setResultDialog({
          open: true,
          success: false,
          message: 'JSONの解析に失敗しました。ファイルが破損している可能性があります。',
        })
      }
    }
    reader.onerror = () => {
      setResultDialog({
        open: true,
        success: false,
        message: 'ファイルの読み込みに失敗しました。',
      })
    }
    reader.readAsText(file)
  }

  const handleConfirmImport = () => {
    if (pendingData) {
      onReplace(pendingData)
      setConfirmOpen(false)
      setPendingData(null)

      const staffCount = pendingData.staff.length
      const sessionCount = pendingData.sessions.length
      const dayCount = pendingData.days?.length ?? 0

      setResultDialog({
        open: true,
        success: true,
        message: `プロジェクトを復元しました。スタッフ ${staffCount}名、${dayCount}日間、${sessionCount}セッション。`,
      })
    }
  }

  const handleCancelImport = () => {
    setConfirmOpen(false)
    setPendingData(null)
    setPendingFileName('')
  }

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
        aria-label="プロジェクトファイルを選択"
      />

      {/* Export button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        className="gap-1.5 bg-transparent"
      >
        <Save className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">保存</span>
      </Button>

      {/* Import button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleImportClick}
        className="gap-1.5 bg-transparent"
      >
        <FolderOpen className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">復元</span>
      </Button>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              データの上書き確認
            </DialogTitle>
            <DialogDescription className="pt-2">
              <strong>{pendingFileName}</strong> を読み込みます。
              現在のデータはすべて上書きされます。この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          {pendingData && (
            <div className="rounded-md border bg-muted/50 p-3 text-sm">
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                <span className="text-muted-foreground">スタッフ</span>
                <span className="font-medium">{pendingData.staff.length}名</span>
                <span className="text-muted-foreground">役割</span>
                <span className="font-medium">{pendingData.roles.length}件</span>
                <span className="text-muted-foreground">日程</span>
                <span className="font-medium">{pendingData.days?.length ?? 0}日間</span>
                <span className="text-muted-foreground">セッション</span>
                <span className="font-medium">{pendingData.sessions.length}件</span>
                <span className="text-muted-foreground">アサイン</span>
                <span className="font-medium">{pendingData.assignments.length}件</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelImport}>
              キャンセル
            </Button>
            <Button onClick={handleConfirmImport}>
              上書きして復元
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result dialog */}
      <Dialog
        open={resultDialog.open}
        onOpenChange={(open) => setResultDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {resultDialog.success ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              {resultDialog.success ? '復元完了' : 'エラー'}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {resultDialog.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setResultDialog((prev) => ({ ...prev, open: false }))}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
