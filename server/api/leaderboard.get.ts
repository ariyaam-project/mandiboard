import { defineEventHandler } from 'h3'
import { ensureSchema } from '../utils/schema'

type LeaderboardRow = {
  id: string
  display_name: string
  avatar_url: string | null
  total_quarters: number
  session_count: number
}

export default defineEventHandler(async (event) => {
  const db = event.context.cloudflare?.env.DB

  if (!db) {
    return { leaders: [] }
  }

  await ensureSchema(db)

  const result = await db
    .prepare(
      `SELECT
         u.id,
         u.display_name,
         u.avatar_url,
         SUM(COALESCE(m.quarter_units, m.portions * 4)) AS total_quarters,
         COUNT(m.id) AS session_count
       FROM users u
       JOIN mandi_sessions m ON m.user_id = u.id
       GROUP BY u.id
       ORDER BY total_quarters DESC
       LIMIT 3`
    )
    .all<LeaderboardRow>()

  return {
    leaders: result.results.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      mandiCount: (row.total_quarters || 0) / 4,
      sessionCount: row.session_count
    }))
  }
})
