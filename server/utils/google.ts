import type { H3Event } from 'h3'
import { createError } from 'h3'
import { useRuntimeConfig } from '#imports'

type GoogleTokenResponse = {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  id_token?: string
}

export type GoogleProfile = {
  sub: string
  email: string
  email_verified: boolean
  name: string
  picture?: string
}

export function getGoogleRedirectUri(event: H3Event) {
  const config = useRuntimeConfig(event)
  return `${config.public.appUrl.replace(/\/$/, '')}/api/auth/google/callback`
}

export function assertGoogleConfig(event: H3Event) {
  const config = useRuntimeConfig(event)

  if (!config.public.googleClientId || !config.googleClientSecret) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'Google OAuth is not configured. Set NUXT_PUBLIC_GOOGLE_CLIENT_ID and NUXT_GOOGLE_CLIENT_SECRET.'
    })
  }

  return config
}

export async function exchangeGoogleCode(event: H3Event, code: string) {
  const config = assertGoogleConfig(event)
  const body = new URLSearchParams({
    code,
    client_id: config.public.googleClientId,
    client_secret: config.googleClientSecret,
    redirect_uri: getGoogleRedirectUri(event),
    grant_type: 'authorization_code'
  })

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  })

  if (!response.ok) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Google token exchange failed'
    })
  }

  return response.json() as Promise<GoogleTokenResponse>
}

export async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Could not read Google profile'
    })
  }

  const profile = (await response.json()) as GoogleProfile

  if (!profile.sub || !profile.email || !profile.email_verified) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Google account email could not be verified'
    })
  }

  return profile
}
