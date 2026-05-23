import { defineEventHandler } from 'h3'
import { clearAuthSession } from '../../utils/auth'
import { assertSameOrigin } from '../../utils/security'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)

  await clearAuthSession(event)
  return { ok: true }
})
