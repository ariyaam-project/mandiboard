import { defineEventHandler } from 'h3'
import { getCurrentUser } from '../utils/auth'
import { getDb } from '../utils/db'
import { ensureSchema } from '../utils/schema'

type SessionRow = {
  id: string
  eaten_at: string
  portions: number
  quarter_units: number
  mayo_units: number
  soft_drinks: number
  soft_drink_type: string | null
  penalty_hours: number
}

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)

  if (!user) {
    return { user: null, sessions: [] }
  }

  const db = getDb(event)
  await ensureSchema(db)
  const sessionsResult = await db
    .prepare(
      `SELECT
         id,
         eaten_at,
         portions,
         quarter_units,
         mayo_units,
         soft_drinks,
         soft_drink_type,
         penalty_hours
       FROM mandi_sessions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .bind(user.id)
    .all<SessionRow>()

  return {
    user,
    sessions: sessionsResult.results.map((session) => ({
      id: session.id,
      eatenAt: session.eaten_at,
      portions: session.quarter_units ? session.quarter_units / 4 : session.portions,
      quarterUnits: session.quarter_units || session.portions * 4,
      mayoUnits: session.mayo_units || 0,
      softDrinks: session.soft_drinks || 0,
      softDrinkType: session.soft_drink_type,
      penaltyHours: session.penalty_hours
    }))
  }
})
