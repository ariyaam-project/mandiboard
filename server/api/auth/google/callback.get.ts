import { defineEventHandler, deleteCookie, getCookie, getQuery, sendRedirect } from 'h3'
import { OAUTH_STATE_COOKIE } from '../../../utils/constants'
import { createAuthSession } from '../../../utils/auth'
import { getDb } from '../../../utils/db'
import { exchangeGoogleCode, fetchGoogleProfile } from '../../../utils/google'
import { ensureSchema } from '../../../utils/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const state = typeof query.state === 'string' ? query.state : ''
  const code = typeof query.code === 'string' ? query.code : ''
  const expectedState = getCookie(event, OAUTH_STATE_COOKIE)

  deleteCookie(event, OAUTH_STATE_COOKIE, { path: '/' })

  if (!state || !expectedState || state !== expectedState || !code) {
    return sendRedirect(event, '/?authError=google')
  }

  const tokens = await exchangeGoogleCode(event, code)
  const profile = await fetchGoogleProfile(tokens.access_token)
  const db = getDb(event)
  await ensureSchema(db)
  const existingUser = await db
    .prepare('SELECT id FROM users WHERE google_sub = ? LIMIT 1')
    .bind(profile.sub)
    .first<{ id: string }>()

  const userId = existingUser?.id || crypto.randomUUID()

  await db
    .prepare(
      `INSERT INTO users (id, google_sub, email, display_name, avatar_url, last_login_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(google_sub) DO UPDATE SET
         email = excluded.email,
         display_name = excluded.display_name,
         avatar_url = excluded.avatar_url,
         updated_at = CURRENT_TIMESTAMP,
         last_login_at = CURRENT_TIMESTAMP`
    )
    .bind(userId, profile.sub, profile.email, profile.name, profile.picture || null)
    .run()

  await createAuthSession(event, userId)

  return sendRedirect(event, '/')
})
