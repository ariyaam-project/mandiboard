import type { H3Event } from 'h3'
import { createError, deleteCookie, getCookie, setCookie } from 'h3'
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from './constants'
import { shouldUseSecureCookies } from './cookies'
import { createToken, sha256 } from './crypto'
import { getDb } from './db'
import { ensureSchema } from './schema'

export type UserRow = {
  id: string
  google_sub: string
  email: string
  display_name: string
  avatar_url: string | null
  initial_life_expectancy_years: number | null
  created_at: string
  updated_at: string
  last_login_at: string
}

export type AuthUser = {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  initialLifeExpectancyYears: number | null
}

export async function createAuthSession(event: H3Event, userId: string) {
  const db = getDb(event)
  await ensureSchema(db)
  const token = createToken()
  const tokenHash = await sha256(token)
  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString()

  await db
    .prepare(
      `INSERT INTO auth_sessions (id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(sessionId, userId, tokenHash, expiresAt)
    .run()

  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookies(event),
    path: '/',
    maxAge: SESSION_TTL_SECONDS
  })
}

export async function getCurrentUser(event: H3Event): Promise<AuthUser | null> {
  const token = getCookie(event, SESSION_COOKIE)

  if (!token) {
    return null
  }

  const db = getDb(event)
  await ensureSchema(db)
  const tokenHash = await sha256(token)
  const row = await db
    .prepare(
      `SELECT users.*
       FROM auth_sessions
       INNER JOIN users ON users.id = auth_sessions.user_id
       WHERE auth_sessions.token_hash = ?
         AND auth_sessions.expires_at > datetime('now')
       LIMIT 1`
    )
    .bind(tokenHash)
    .first<UserRow>()

  if (!row) {
    deleteCookie(event, SESSION_COOKIE, { path: '/' })
    return null
  }

  return mapUser(row)
}

export async function requireCurrentUser(event: H3Event) {
  const user = await getCurrentUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }

  return user
}

export async function clearAuthSession(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE)

  if (token) {
    const tokenHash = await sha256(token)
    const db = getDb(event)
    await ensureSchema(db)
    await db
      .prepare('DELETE FROM auth_sessions WHERE token_hash = ?')
      .bind(tokenHash)
      .run()
  }

  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

function mapUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    initialLifeExpectancyYears: row.initial_life_expectancy_years
  }
}
