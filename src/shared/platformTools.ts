export type PlatformToolsStage =
  | 'idle'
  | 'downloading'
  | 'verifying'
  | 'extracting'
  | 'installing'
  | 'ready'
  | 'error'

export interface PlatformToolsProgress {
  receivedBytes: number
  totalBytes: number
  percent: number
}

export interface PlatformToolsStatus {
  stage: PlatformToolsStage
  installed: boolean
  version: string | null
  expectedVersion: string
  releasePage: string
  sourceUrl: string
  sourceSizeBytes: number
  expectedSha256: string
  installPath: string | null
  progress: PlatformToolsProgress | null
  error: string | null
  checkedAt: string
}

export interface PlatformToolsCatalogSource {
  releasePage: string
  catalog: string
  collectedAt: string
  note: string
}

export interface PlatformToolsCatalog {
  schemaVersion: 1
  checkedAt: string
  version: string
  released: string
  fileName: string
  url: string
  sha256: string
  sha1?: string
  sizeBytes: number
  source: PlatformToolsCatalogSource
}
