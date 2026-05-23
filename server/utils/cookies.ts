import type { H3Event } from 'h3'
import { useRuntimeConfig } from '#imports'

export function shouldUseSecureCookies(event: H3Event) {
  return useRuntimeConfig(event).public.appUrl.startsWith('https://')
}
