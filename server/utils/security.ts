import type { H3Event } from 'h3'
import { createError, getRequestHeader, getRequestURL } from 'h3'
import { useRuntimeConfig } from '#imports'

export function assertSameOrigin(event: H3Event) {
  const origin = getRequestHeader(event, 'origin')

  if (!origin) {
    return
  }

  const requestOrigin = getRequestURL(event).origin
  const configuredOrigin = new URL(useRuntimeConfig(event).public.appUrl).origin

  if (origin !== configuredOrigin && origin !== requestOrigin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Cross-origin request blocked'
    })
  }
}
