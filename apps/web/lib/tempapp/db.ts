import { createClient, type Client, type InValue } from "@libsql/client";

let _client: Client | null = null;

export function getClient(): Client {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (url) {
      _client = createClient({
        url,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
    } else {
      _client = createClient({ url: "file:tempapp.db" });
    }
  }
  return _client;
}

export async function dbAll<T = Record<string, unknown>>(
  sql: string,
  args: InValue[] = [],
): Promise<T[]> {
  const result = await getClient().execute({ sql, args });
  return result.rows as unknown as T[];
}

export async function dbGet<T = Record<string, unknown>>(
  sql: string,
  args: InValue[] = [],
): Promise<T | null> {
  const rows = await dbAll<T>(sql, args);
  return rows[0] ?? null;
}

export async function dbRun(
  sql: string,
  args: InValue[] = [],
): Promise<{ changes: number; lastInsertRowid: bigint | number }> {
  const result = await getClient().execute({ sql, args });
  return {
    changes: result.rowsAffected,
    lastInsertRowid: result.lastInsertRowid ?? 0,
  };
}

export async function dbBatch(
  statements: Array<{ sql: string; args?: InValue[] }>,
): Promise<void> {
  await getClient().batch(
    statements.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
    "write",
  );
}

export async function initSchema(): Promise<void> {
  const client = getClient();
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      equipment TEXT DEFAULT '',
      context_label TEXT DEFAULT '',
      default_block_type TEXT DEFAULT 'strength',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(name, equipment, context_label)
    );

    CREATE TABLE IF NOT EXISTS exercise_tracker_contributions (
      id TEXT PRIMARY KEY,
      exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      tracker_key TEXT NOT NULL,
      value_per_instance REAL NOT NULL DEFAULT 1,
      UNIQUE(exercise_id, tracker_key)
    );

    CREATE TABLE IF NOT EXISTS tracker_goals (
      id TEXT PRIMARY KEY,
      tracker_key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      target_value REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'sets'
    );

    CREATE TABLE IF NOT EXISTS workout_plans (
      id TEXT PRIMARY KEY,
      specific_date TEXT,
      day_of_week INTEGER,
      is_biweekly INTEGER DEFAULT 0,
      biweekly_start_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workout_blocks (
      id TEXT PRIMARY KEY,
      workout_plan_id TEXT NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      block_type TEXT NOT NULL DEFAULT 'strength',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workout_exercises (
      id TEXT PRIMARY KEY,
      workout_block_id TEXT NOT NULL REFERENCES workout_blocks(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises(id),
      sets INTEGER,
      reps TEXT,
      weight REAL,
      weight_unit TEXT DEFAULT 'lbs',
      time_seconds INTEGER,
      rpe REAL,
      rest_seconds INTEGER,
      is_superset_with_next INTEGER DEFAULT 0,
      reminder TEXT,
      comment TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS completed_workouts (
      id TEXT PRIMARY KEY,
      workout_plan_id TEXT REFERENCES workout_plans(id),
      date TEXT NOT NULL,
      completed_at TEXT DEFAULT (datetime('now')),
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS completed_exercises (
      id TEXT PRIMARY KEY,
      completed_workout_id TEXT NOT NULL REFERENCES completed_workouts(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises(id),
      block_name TEXT NOT NULL,
      block_type TEXT NOT NULL DEFAULT 'strength',
      sets INTEGER,
      reps TEXT,
      weight REAL,
      weight_unit TEXT DEFAULT 'lbs',
      time_seconds INTEGER,
      rpe REAL,
      rest_seconds INTEGER,
      was_superset INTEGER DEFAULT 0,
      comment TEXT,
      skipped INTEGER DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS routines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS routine_blocks (
      id TEXT PRIMARY KEY,
      routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      block_type TEXT NOT NULL DEFAULT 'strength',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS routine_exercises (
      id TEXT PRIMARY KEY,
      routine_block_id TEXT NOT NULL REFERENCES routine_blocks(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises(id),
      sets INTEGER,
      reps TEXT,
      weight REAL,
      weight_unit TEXT DEFAULT 'lbs',
      time_seconds INTEGER,
      rpe REAL,
      rest_seconds INTEGER,
      is_superset_with_next INTEGER DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    -- Training blocks: multi-day cycle templates
    CREATE TABLE IF NOT EXISTS training_blocks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      cycle_days INTEGER NOT NULL DEFAULT 7,
      is_recurring INTEGER DEFAULT 1,
      start_date TEXT,
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS training_block_days (
      id TEXT PRIMARY KEY,
      training_block_id TEXT NOT NULL REFERENCES training_blocks(id) ON DELETE CASCADE,
      day_offset INTEGER NOT NULL,
      label TEXT NOT NULL,
      is_rest_day INTEGER DEFAULT 0,
      UNIQUE(training_block_id, day_offset)
    );

    CREATE TABLE IF NOT EXISTS training_block_day_blocks (
      id TEXT PRIMARY KEY,
      training_block_day_id TEXT NOT NULL REFERENCES training_block_days(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      block_type TEXT NOT NULL DEFAULT 'strength',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS training_block_day_exercises (
      id TEXT PRIMARY KEY,
      training_block_day_block_id TEXT NOT NULL REFERENCES training_block_day_blocks(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises(id),
      sets INTEGER,
      reps TEXT,
      weight REAL,
      weight_unit TEXT DEFAULT 'lbs',
      time_seconds INTEGER,
      rpe REAL,
      rest_seconds INTEGER,
      is_superset_with_next INTEGER DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_training_blocks_active ON training_blocks(is_active);
    CREATE INDEX IF NOT EXISTS idx_training_block_days_block ON training_block_days(training_block_id);

    CREATE INDEX IF NOT EXISTS idx_workout_plans_date ON workout_plans(specific_date);
    CREATE INDEX IF NOT EXISTS idx_workout_plans_dow ON workout_plans(day_of_week);
    CREATE INDEX IF NOT EXISTS idx_completed_workouts_date ON completed_workouts(date);
    CREATE INDEX IF NOT EXISTS idx_completed_exercises_exercise ON completed_exercises(exercise_id);
    CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise ON workout_exercises(exercise_id);
  `);
}

let _schemaInitialized = false;

export async function ensureSchema(): Promise<void> {
  if (!_schemaInitialized) {
    await initSchema();
    _schemaInitialized = true;
  }
}
