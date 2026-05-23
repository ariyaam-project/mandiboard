import { createError, defineEventHandler, readBody } from 'h3'
import { requireCurrentUser } from '../utils/auth'
import { getDb } from '../utils/db'
import { ensureSchema } from '../utils/schema'

export default defineEventHandler(async (event) => {
  const user = await requireCurrentUser(event)
  const body = await readBody<{ initialLifeExpectancyYears?: number }>(event)
  const initialLifeExpectancyYears = Number(body.initialLifeExpectancyYears)

  if (!Number.isFinite(initialLifeExpectancyYears) || initialLifeExpectancyYears < 1 || initialLifeExpectancyYears > 140) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Initial life expectancy must be between 1 and 140 years'
    })
  }

  const db = getDb(event)
  await ensureSchema(db)

  await db
    .prepare(
      `UPDATE users
       SET initial_life_expectancy_years = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(Math.floor(initialLifeExpectancyYears), user.id)
    .run()

  return {
    user: {
      ...user,
      initialLifeExpectancyYears: Math.floor(initialLifeExpectancyYears)
    }
  }
})
