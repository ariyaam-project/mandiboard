import { defineEventHandler, sendRedirect, setCookie } from 'h3'
import { OAUTH_STATE_COOKIE } from '../../../utils/constants'
import { shouldUseSecureCookies } from '../../../utils/cookies'
import { createToken } from '../../../utils/crypto'
import { assertGoogleConfig, getGoogleRedirectUri } from '../../../utils/google'

export default defineEventHandler(async (event) => {
  const config = assertGoogleConfig(event)
  const state = createToken(24)
  const params = new URLSearchParams({
    client_id: config.public.googleClientId,
    redirect_uri: getGoogleRedirectUri(event),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account'
  })

  setCookie(event, OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookies(event),
    path: '/',
    maxAge: 60 * 10
  })

  return sendRedirect(event, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
})
