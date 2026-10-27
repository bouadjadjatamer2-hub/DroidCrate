import type { DroidCrateApi } from '@shared/api'

declare global {
  interface Window {
    droidcrate: DroidCrateApi
  }
}

export {}
