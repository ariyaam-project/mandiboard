import type { D1Database } from '@cloudflare/workers-types'

let schemaReady = false

export async function ensureSchema(db: D1Database) {
  if (schemaReady) {
    return
  }

  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        google_sub TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        initial_life_expectancy_years INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS mandi_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        portions INTEGER NOT NULL,
        penalty_hours INTEGER NOT NULL,
        quarter_units INTEGER NOT NULL DEFAULT 4,
        mayo_units INTEGER NOT NULL DEFAULT 0,
        soft_drinks INTEGER NOT NULL DEFAULT 0,
        soft_drink_type TEXT,
        eaten_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    ),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash)'),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_mandi_sessions_user_created ON mandi_sessions(user_id, created_at DESC)'
    )
  ])

  await addColumnIfMissing(
    db,
    'mandi_sessions',
    'quarter_units',
    'ALTER TABLE mandi_sessions ADD COLUMN quarter_units INTEGER NOT NULL DEFAULT 4'
  )
  await addColumnIfMissing(
    db,
    'mandi_sessions',
    'mayo_units',
    'ALTER TABLE mandi_sessions ADD COLUMN mayo_units INTEGER NOT NULL DEFAULT 0'
  )
  await addColumnIfMissing(
    db,
    'mandi_sessions',
    'soft_drinks',
    'ALTER TABLE mandi_sessions ADD COLUMN soft_drinks INTEGER NOT NULL DEFAULT 0'
  )
  await addColumnIfMissing(
    db,
    'mandi_sessions',
    'soft_drink_type',
    'ALTER TABLE mandi_sessions ADD COLUMN soft_drink_type TEXT'
  )

  schemaReady = true
}

async function addColumnIfMissing(
  db: D1Database,
  tableName: string,
  columnName: string,
  statement: string
) {
  const columns = await db.prepare(`PRAGMA table_info(${tableName})`).all<{ name: string }>()
  const hasColumn = columns.results.some((column) => column.name === columnName)

  if (!hasColumn) {
    await db.prepare(statement).run()
  }
}
