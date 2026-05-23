import { createError, defineEventHandler, readBody } from 'h3'
import { requireCurrentUser } from '../utils/auth'
import { getDb } from '../utils/db'
import { assertSameOrigin } from '../utils/security'
import { ensureSchema } from '../utils/schema'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)

  const user = await requireCurrentUser(event)
  const body = await readBody<{ initialLifeExpectancyYears?: number; displayName?: string }>(event)
  const initialLifeExpectancyYears = Number(body.initialLifeExpectancyYears)

  if (!Number.isFinite(initialLifeExpectancyYears) || initialLifeExpectancyYears < 1 || initialLifeExpectancyYears > 150) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Initial life expectancy must be between 1 and 150 years'
    })
  }

  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  const nextDisplayName = displayName ? displayName.slice(0, 80) : user.displayName

  const db = getDb(event)
  await ensureSchema(db)

  await db
    .prepare(
      `UPDATE users
       SET initial_life_expectancy_years = ?,
           display_name = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(Math.floor(initialLifeExpectancyYears), nextDisplayName, user.id)
    .run()

  return {
    user: {
      ...user,
      displayName: nextDisplayName,
      initialLifeExpectancyYears: Math.floor(initialLifeExpectancyYears)
    }
  }
})
