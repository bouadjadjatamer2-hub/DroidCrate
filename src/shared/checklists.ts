export type ChecklistRisk = 'medium' | 'high'

export interface ChecklistItem {
  id: string
  title: string
  detail: string
  required: boolean
}

export interface Checklist {
  id: string
  title: string
  summary: string
  risk: ChecklistRisk
  warning: string
  items: ChecklistItem[]
}

export interface ChecklistLibrary {
  schemaVersion: number
  updated: string
  checklists: Checklist[]
}
