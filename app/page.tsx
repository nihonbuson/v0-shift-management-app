'use client'

import { useState } from 'react'
import { Settings, CalendarDays, Grid3x3, FileUp, RotateCcw } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useShiftStore } from '@/lib/store'
import { SettingsPanel } from '@/components/settings-panel'
import { SessionEditor } from '@/components/session-editor'
import { ShiftGrid } from '@/components/shift-grid'
import { CsvImporter } from '@/components/csv-importer'
import { ProjectIO } from '@/components/project-io'

export default function Page() {
  const store = useShiftStore()
  const [resetOpen, setResetOpen] = useState(false)

  if (!store.isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      </div>
    )
  }

  const sessionCount = store.data.sessions.length
  const staffCount = store.data.staff.length
  const dayCount = store.data.days.length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="no-print border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
              <Grid3x3 className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">
                シフト管理
              </h1>
              <p className="text-xs text-muted-foreground">
                {staffCount + '名 / ' + dayCount + '日間 / ' + sessionCount + 'セッション'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ProjectIO data={store.data} onReplace={store.replaceData} />
            <div className="w-px h-5 bg-border" aria-hidden="true" />
            <Dialog open={resetOpen} onOpenChange={setResetOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  リセット
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>データをリセットしますか？</DialogTitle>
                  <DialogDescription>
                    すべてのスタッフ、セッション、アサインメント情報が初期状態に戻ります。この操作は取り消せません。
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setResetOpen(false)}>
                    キャンセル
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      store.resetData()
                      setResetOpen(false)
                    }}
                  >
                    リセット
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Tabs defaultValue="sessions" className="flex flex-col gap-4">
          <div className="no-print">
            <TabsList className="grid w-full grid-cols-4 max-w-xl">
              <TabsTrigger value="settings" className="flex items-center gap-1.5">
                <Settings className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">設定</span>
              </TabsTrigger>
              <TabsTrigger value="sessions" className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">セッション</span>
              </TabsTrigger>
              <TabsTrigger value="grid" className="flex items-center gap-1.5">
                <Grid3x3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">シフト表</span>
              </TabsTrigger>
              <TabsTrigger value="import" className="flex items-center gap-1.5">
                <FileUp className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">インポート</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="settings">
            <SettingsPanel
              staff={store.data.staff}
              roles={store.data.roles}
              days={store.data.days}
              gridStartTime={store.data.gridStartTime}
              gridEndTime={store.data.gridEndTime}
              onAddStaff={store.addStaff}
              onUpdateStaff={store.updateStaff}
              onRemoveStaff={store.removeStaff}
              onAddRole={store.addRole}
              onUpdateRole={store.updateRole}
              onRemoveRole={store.removeRole}
              onUpdateDay={store.updateDay}
              onSetGridTimes={store.setGridTimes}
            />
          </TabsContent>

          <TabsContent value="sessions">
            <SessionEditor
              sessions={store.data.sessions}
              staff={store.data.staff}
              roles={store.data.roles}
              days={store.data.days}
              onAddSession={store.addSession}
              onUpdateSession={store.updateSession}
              onRemoveSession={store.removeSession}
              onReorderSession={store.reorderSession}
              onUpdateDay={store.updateDay}
              getAssignment={store.getAssignment}
              getAssignmentRoleId={store.getAssignmentRoleId}
              setAssignment={store.setAssignment}
              setAssignmentNote={store.setAssignmentNote}
              addOverride={store.addOverride}
              updateOverride={store.updateOverride}
              removeOverride={store.removeOverride}
              addMilestone={store.addMilestone}
              updateMilestone={store.updateMilestone}
              removeMilestone={store.removeMilestone}
            />
          </TabsContent>

          <TabsContent value="grid">
            <ShiftGrid
              staff={store.data.staff}
              roles={store.data.roles}
              sessions={store.data.sessions}
              assignments={store.data.assignments}
              days={store.data.days}
              gridStartTime={store.data.gridStartTime}
              gridEndTime={store.data.gridEndTime}
            />
          </TabsContent>

          <TabsContent value="import">
            <CsvImporter
              currentRoles={store.data.roles}
              onImport={store.importData}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
