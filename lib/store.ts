'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  ShiftData,
  StaffMember,
  Role,
  Session,
  Assignment,
  Override,
  DayConfig,
} from './types'
import { DEFAULT_SHIFT_DATA, generateId } from './types'

const STORAGE_KEY = 'shift-manager-data-v2'

function migrateData(raw: Record<string, unknown>): ShiftData {
  const data = raw as ShiftData
  // Ensure days array exists (migration from v1)
  if (!data.days || !Array.isArray(data.days)) {
    data.days = [
      { id: 1, label: 'Day 1' },
      { id: 2, label: 'Day 2' },
    ]
  }
  // Ensure all sessions have dayId
  if (data.sessions) {
    data.sessions = data.sessions.map((s: Session) => ({
      ...s,
      dayId: s.dayId || 1,
    }))
  }
  // Ensure all assignments have overrides
  if (data.assignments) {
    data.assignments = data.assignments.map((a: Assignment) => ({
      ...a,
      overrides: a.overrides || [],
    }))
  }
  return data
}

function loadData(): ShiftData {
  if (typeof window === 'undefined') return DEFAULT_SHIFT_DATA
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return migrateData(JSON.parse(stored))
    }
    // Try old key
    const oldStored = localStorage.getItem('shift-manager-data')
    if (oldStored) {
      const migrated = migrateData(JSON.parse(oldStored))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
      return migrated
    }
  } catch {
    // ignore
  }
  return DEFAULT_SHIFT_DATA
}

function saveData(data: ShiftData) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore quota errors
  }
}

export function useShiftStore() {
  const [data, setData] = useState<ShiftData>(DEFAULT_SHIFT_DATA)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setData(loadData())
    setIsLoaded(true)
  }, [])

  const updateData = useCallback(
    (updater: (prev: ShiftData) => ShiftData) => {
      setData((prev) => {
        const next = updater(prev)
        saveData(next)
        return next
      })
    },
    []
  )

  // Staff operations
  const addStaff = useCallback(
    (name: string) => {
      updateData((prev) => ({
        ...prev,
        staff: [...prev.staff, { id: generateId(), name }],
      }))
    },
    [updateData]
  )

  const updateStaff = useCallback(
    (id: string, name: string) => {
      updateData((prev) => ({
        ...prev,
        staff: prev.staff.map((s) => (s.id === id ? { ...s, name } : s)),
      }))
    },
    [updateData]
  )

  const removeStaff = useCallback(
    (id: string) => {
      updateData((prev) => ({
        ...prev,
        staff: prev.staff.filter((s) => s.id !== id),
        assignments: prev.assignments.filter((a) => a.staffId !== id),
      }))
    },
    [updateData]
  )

  // Role operations
  const addRole = useCallback(
    (name: string, color: string, textColor: string) => {
      updateData((prev) => ({
        ...prev,
        roles: [...prev.roles, { id: generateId(), name, color, textColor }],
      }))
    },
    [updateData]
  )

  const updateRole = useCallback(
    (id: string, updates: Partial<Role>) => {
      updateData((prev) => ({
        ...prev,
        roles: prev.roles.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      }))
    },
    [updateData]
  )

  const removeRole = useCallback(
    (id: string) => {
      updateData((prev) => ({
        ...prev,
        roles: prev.roles.filter((r) => r.id !== id),
        assignments: prev.assignments.filter((a) => a.roleId !== id),
      }))
    },
    [updateData]
  )

  // Day operations
  const updateDay = useCallback(
    (dayId: number, updates: Partial<DayConfig>) => {
      updateData((prev) => ({
        ...prev,
        days: prev.days.map((d) =>
          d.id === dayId ? { ...d, ...updates } : d
        ),
      }))
    },
    [updateData]
  )

  // Session operations - now with dayId
  const addSession = useCallback(
    (dayId: number, title: string, startTime: string, endTime: string) => {
      updateData((prev) => ({
        ...prev,
        sessions: [
          ...prev.sessions,
          { id: generateId(), dayId, title, startTime, endTime },
        ],
      }))
    },
    [updateData]
  )

  const updateSession = useCallback(
    (id: string, updates: Partial<Session>) => {
      updateData((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === id ? { ...s, ...updates } : s
        ),
      }))
    },
    [updateData]
  )

  const removeSession = useCallback(
    (id: string) => {
      updateData((prev) => ({
        ...prev,
        sessions: prev.sessions.filter((s) => s.id !== id),
        assignments: prev.assignments.filter((a) => a.sessionId !== id),
      }))
    },
    [updateData]
  )

  // Assignment operations
  const setAssignment = useCallback(
    (sessionId: string, staffId: string, roleId: string) => {
      updateData((prev) => {
        const existing = prev.assignments.findIndex(
          (a) => a.sessionId === sessionId && a.staffId === staffId
        )
        let newAssignments: Assignment[]
        if (roleId === '') {
          newAssignments = prev.assignments.filter(
            (a) => !(a.sessionId === sessionId && a.staffId === staffId)
          )
        } else if (existing >= 0) {
          newAssignments = prev.assignments.map((a, i) =>
            i === existing ? { ...a, roleId } : a
          )
        } else {
          newAssignments = [
            ...prev.assignments,
            { sessionId, staffId, roleId, overrides: [] },
          ]
        }
        return { ...prev, assignments: newAssignments }
      })
    },
    [updateData]
  )

  const getAssignment = useCallback(
    (sessionId: string, staffId: string): Assignment | null => {
      return (
        data.assignments.find(
          (a) => a.sessionId === sessionId && a.staffId === staffId
        ) ?? null
      )
    },
    [data.assignments]
  )

  const getAssignmentRoleId = useCallback(
    (sessionId: string, staffId: string): string => {
      const found = data.assignments.find(
        (a) => a.sessionId === sessionId && a.staffId === staffId
      )
      return found?.roleId ?? ''
    },
    [data.assignments]
  )

  // Override operations
  const addOverride = useCallback(
    (
      sessionId: string,
      staffId: string,
      override: Omit<Override, 'id'>
    ) => {
      updateData((prev) => ({
        ...prev,
        assignments: prev.assignments.map((a) =>
          a.sessionId === sessionId && a.staffId === staffId
            ? {
                ...a,
                overrides: [
                  ...(a.overrides || []),
                  { ...override, id: generateId() },
                ],
              }
            : a
        ),
      }))
    },
    [updateData]
  )

  const updateOverride = useCallback(
    (
      sessionId: string,
      staffId: string,
      overrideId: string,
      updates: Partial<Omit<Override, 'id'>>
    ) => {
      updateData((prev) => ({
        ...prev,
        assignments: prev.assignments.map((a) =>
          a.sessionId === sessionId && a.staffId === staffId
            ? {
                ...a,
                overrides: (a.overrides || []).map((o) =>
                  o.id === overrideId ? { ...o, ...updates } : o
                ),
              }
            : a
        ),
      }))
    },
    [updateData]
  )

  const removeOverride = useCallback(
    (sessionId: string, staffId: string, overrideId: string) => {
      updateData((prev) => ({
        ...prev,
        assignments: prev.assignments.map((a) =>
          a.sessionId === sessionId && a.staffId === staffId
            ? {
                ...a,
                overrides: (a.overrides || []).filter(
                  (o) => o.id !== overrideId
                ),
              }
            : a
        ),
      }))
    },
    [updateData]
  )

  // Grid time settings
  const setGridTimes = useCallback(
    (startTime: string, endTime: string) => {
      updateData((prev) => ({
        ...prev,
        gridStartTime: startTime,
        gridEndTime: endTime,
      }))
    },
    [updateData]
  )

  // Import data
  const importData = useCallback(
    (importedData: Partial<ShiftData>) => {
      updateData((prev) => ({
        ...prev,
        ...importedData,
      }))
    },
    [updateData]
  )

  // Reset data
  const resetData = useCallback(() => {
    updateData(() => DEFAULT_SHIFT_DATA)
  }, [updateData])

  return {
    data,
    isLoaded,
    addStaff,
    updateStaff,
    removeStaff,
    addRole,
    updateRole,
    removeRole,
    updateDay,
    addSession,
    updateSession,
    removeSession,
    setAssignment,
    getAssignment,
    getAssignmentRoleId,
    addOverride,
    updateOverride,
    removeOverride,
    setGridTimes,
    importData,
    resetData,
  }
}
