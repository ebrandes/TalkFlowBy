import type { TalkflowApi } from './index'

declare global {
  interface Window {
    talkflow: TalkflowApi
  }
}

export {}
