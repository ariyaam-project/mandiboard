import { createError, defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import {
  DEFAULT_MAYO_PENALTY_HOURS,
  DEFAULT_PENALTY_HOURS_PER_QUARTER,
  DEFAULT_SOFT_DRINK_PENALTY_HOURS
} from '../../utils/constants'
import { requireCurrentUser } from '../../utils/auth'
import { getDb } from '../../utils/db'
import { assertSameOrigin } from '../../utils/security'
import { ensureSchema } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)

  const user = await requireCurrentUser(event)
  const config = useRuntimeConfig(event)
  const body = await readBody<{
    quarterUnits?: number
    mayoUnits?: number
    softDrinks?: number
    softDrinkType?: string
  }>(event)
  const quarterUnits = Math.min(4, Math.floor(Number(body.quarterUnits)))
  const mayoUnits = Math.min(20, Math.max(0, Math.floor(Number(body.mayoUnits) || 0)))
  const softDrinks = Math.min(20, Math.max(0, Math.floor(Number(body.softDrinks) || 0)))
  const softDrinkType = normalizeSoftDrinkType(body.softDrinkType)

  if (!Number.isFinite(quarterUnits) || quarterUnits < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Mandi quantity must be between 1 and 4 quarters'
    })
  }

  const db = getDb(event)
  await ensureSchema(db)

  const todayCount = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM mandi_sessions WHERE user_id = ? AND date(eaten_at) = date('now')`
    )
    .bind(user.id)
    .first<{ count: number }>()

  if ((todayCount?.count ?? 0) >= 4) {
    throw createError({
      statusCode: 429,
      statusMessage: 'ne jeevikan vendi thinnano atho thinnan vendi jeevikano? 🙂'
    })
  }

  const penaltyHoursPerQuarter =
    Number(config.public.penaltyHoursPerQuarter) || DEFAULT_PENALTY_HOURS_PER_QUARTER
  const mayoPenaltyHours =
    Number(config.public.mayoPenaltyHours) || DEFAULT_MAYO_PENALTY_HOURS
  const softDrinkPenaltyHours =
    Number(config.public.softDrinkPenaltyHours) || DEFAULT_SOFT_DRINK_PENALTY_HOURS
  const penaltyHours =
    quarterUnits * penaltyHoursPerQuarter +
    mayoUnits * mayoPenaltyHours +
    softDrinks * softDrinkPenaltyHours
  const session = {
    id: crypto.randomUUID(),
    eatenAt: new Date().toISOString(),
    portions: quarterUnits / 4,
    quarterUnits,
    mayoUnits,
    softDrinks,
    softDrinkType,
    penaltyHours
  }

  await db
    .prepare(
      `INSERT INTO mandi_sessions (
        id,
        user_id,
        portions,
        quarter_units,
        mayo_units,
        soft_drinks,
        soft_drink_type,
        penalty_hours,
        eaten_at
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      session.id,
      user.id,
      session.portions,
      session.quarterUnits,
      session.mayoUnits,
      session.softDrinks,
      session.softDrinkType,
      session.penaltyHours,
      session.eatenAt
    )
    .run()

  return { session }
})

function normalizeSoftDrinkType(value?: string) {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  const allowedTypes = new Set(['pepsi', 'coca-cola', 'other'])

  return allowedTypes.has(normalized) ? normalized : 'other'
}
