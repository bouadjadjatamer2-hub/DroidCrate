export type ToolCategory = 'platform' | 'flashing' | 'recovery' | 'root' | 'driver'
export type ToolDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type ToolAvailability = 'download' | 'support-only'
export type ToolLinkKind = 'download' | 'source' | 'guide' | 'support'
export type ToolPlatform = 'windows' | 'macos' | 'linux' | 'android' | 'web'

export interface ToolLink {
  label: string
  url: string
  kind: ToolLinkKind
}

export interface ToolEntry {
  id: string
  name: string
  vendor: string
  category: ToolCategory
  difficulty: ToolDifficulty
  availability: ToolAvailability
  summary: string
  brands: string[]
  chipsets: string[]
  platforms: ToolPlatform[]
  links: ToolLink[]
  notes: string[]
  warning?: string
}

export interface ToolLibrary {
  schemaVersion: number
  updated: string
  tools: ToolEntry[]
}
