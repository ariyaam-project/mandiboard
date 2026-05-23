import { createError, type H3Event } from 'h3'
import type { D1Database } from '@cloudflare/workers-types'

export function getDb(event: H3Event): D1Database {
  const db = event.context.cloudflare?.env.DB

  if (!db) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'Missing Cloudflare D1 binding DB. Run with `npm run dev:cf` or deploy with the DB binding configured.'
    })
  }

  return db
}
