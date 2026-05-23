import { defineEventHandler } from 'h3'
import { clearAuthSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await clearAuthSession(event)
  return { ok: true }
})
