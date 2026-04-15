import { dbRun, dbGet, ensureSchema } from "@/lib/tempapp/db";

export const dynamic = "force-dynamic";

const BLOCK_NAME = "Biweekly Full Body Program";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Insert an exercise if it doesn't exist (unique on name+equipment+context_label),
 * then return its id.
 */
async function upsertExercise(
  name: string,
  equipment: string,
  contextLabel: string,
  defaultBlockType: string,
): Promise<string> {
  const id = crypto.randomUUID();
  await dbRun(
    `INSERT OR IGNORE INTO exercises (id, name, equipment, context_label, default_block_type)
     VALUES (?, ?, ?, ?, ?)`,
    [id, name, equipment, contextLabel, defaultBlockType],
  );
  const row = await dbGet<{ id: string }>(
    `SELECT id FROM exercises WHERE name = ? AND equipment = ? AND context_label = ?`,
    [name, equipment, contextLabel],
  );
  return row!.id;
}

async function insertDay(
  trainingBlockId: string,
  dayOffset: number,
  label: string,
  isRestDay: number,
): Promise<string> {
  const id = crypto.randomUUID();
  await dbRun(
    `INSERT INTO training_block_days (id, training_block_id, day_offset, label, is_rest_day)
     VALUES (?, ?, ?, ?, ?)`,
    [id, trainingBlockId, dayOffset, label, isRestDay],
  );
  return id;
}

async function insertBlock(
  dayId: string,
  name: string,
  blockType: string,
  sortOrder: number,
): Promise<string> {
  const id = crypto.randomUUID();
  await dbRun(
    `INSERT INTO training_block_day_blocks (id, training_block_day_id, name, block_type, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [id, dayId, name, blockType, sortOrder],
  );
  return id;
}

interface ExerciseEntry {
  exerciseId: string;
  sets?: number | null;
  reps?: string | null;
  weight?: number | null;
  weightUnit?: string;
  timeSeconds?: number | null;
  rpe?: number | null;
  restSeconds?: number | null;
}

async function insertExercises(
  blockId: string,
  exercises: ExerciseEntry[],
): Promise<void> {
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i]!;
    await dbRun(
      `INSERT INTO training_block_day_exercises
         (id, training_block_day_block_id, exercise_id, sets, reps, weight, weight_unit, time_seconds, rpe, rest_seconds, is_superset_with_next, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        crypto.randomUUID(),
        blockId,
        ex.exerciseId,
        ex.sets ?? null,
        ex.reps ?? null,
        ex.weight ?? null,
        ex.weightUnit ?? "lbs",
        ex.timeSeconds ?? null,
        ex.rpe ?? null,
        ex.restSeconds ?? null,
        i,
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function POST() {
  try {
    await ensureSchema();

    // Idempotency: bail if already seeded
    const existing = await dbGet<{ id: string }>(
      `SELECT id FROM training_blocks WHERE name = ?`,
      [BLOCK_NAME],
    );
    if (existing) {
      return Response.json(
        { id: existing.id, message: "Training block already exists" },
        { status: 200 },
      );
    }

    // ------------------------------------------------------------------
    // 1. Upsert all exercises
    // ------------------------------------------------------------------

    // -- Warmup / utility exercises --
    const dynamicWarmup = await upsertExercise("Dynamic Warmup", "", "", "warmup");
    const bandPullAparts = await upsertExercise("Band Pull-Aparts", "band", "", "warmup");
    const shoulderCircles = await upsertExercise("Shoulder Circles", "", "", "warmup");
    const pushUpWalkouts = await upsertExercise("Push-Up Walkouts", "", "", "warmup");
    const bwSquats = await upsertExercise("Bodyweight Squats", "", "", "warmup");
    const legSwings = await upsertExercise("Leg Swings", "", "", "warmup");
    const gluteBridges = await upsertExercise("Glute Bridges", "", "", "warmup");
    const armCircles = await upsertExercise("Arm Circles", "", "", "warmup");
    const catCow = await upsertExercise("Cat-Cow", "", "", "warmup");
    const wristCircles = await upsertExercise("Wrist Circles", "", "", "warmup");
    const lightCurls = await upsertExercise("Light Curls", "dumbbell", "", "warmup");
    const hipCircles = await upsertExercise("Hip Circles", "", "", "warmup");
    const ankleCircles = await upsertExercise("Ankle Circles", "", "", "warmup");

    // -- Stretching --
    const fullBodyStretch = await upsertExercise("Full Body Stretch", "", "", "stretching");
    const upperBodyStretch = await upsertExercise("Upper Body Stretch", "", "", "stretching");
    const lowerBodyStretch = await upsertExercise("Lower Body Stretch", "", "", "stretching");

    // -- Running --
    const easyLongRun = await upsertExercise("Easy Long Run", "", "easy long", "cardio");
    const tempoRun = await upsertExercise("Tempo Run", "", "tempo", "cardio");
    const hillRepeats = await upsertExercise("Hill Repeats", "", "hills", "cardio");

    // -- Core --
    const plank = await upsertExercise("Plank", "", "", "strength");
    const hangingLegRaise = await upsertExercise("Hanging Leg Raise", "", "", "strength");
    const abWheelRollout = await upsertExercise("Ab Wheel Rollout", "ab wheel", "", "strength");
    const russianTwists = await upsertExercise("Russian Twists", "", "", "strength");
    const deadBug = await upsertExercise("Dead Bug", "", "", "strength");
    const cableWoodchop = await upsertExercise("Cable Woodchop", "cable", "", "strength");
    const bicycleCrunch = await upsertExercise("Bicycle Crunch", "", "", "strength");
    const sidePlank = await upsertExercise("Side Plank", "", "", "strength");

    // -- Upper body --
    const barbellBenchPress = await upsertExercise("Barbell Bench Press", "barbell", "", "strength");
    const pullUps = await upsertExercise("Pull-Ups", "", "", "strength");
    const overheadPress = await upsertExercise("Overhead Press", "barbell", "", "strength");
    const singleArmDBRow = await upsertExercise("Single-Arm Dumbbell Row", "dumbbell", "", "strength");
    const dumbbellCurl = await upsertExercise("Dumbbell Curl", "dumbbell", "", "strength");
    const tricepDips = await upsertExercise("Tricep Dips", "", "", "strength");
    const inclineDBPress = await upsertExercise("Incline Dumbbell Press", "dumbbell", "", "strength");
    const cableRow = await upsertExercise("Cable Row", "cable", "", "strength");
    const dumbbellFly = await upsertExercise("Dumbbell Fly", "dumbbell", "", "strength");
    const latPulldown = await upsertExercise("Lat Pulldown", "cable", "", "strength");
    const cableCrossover = await upsertExercise("Cable Crossover", "cable", "", "strength");
    const seatedCableRow = await upsertExercise("Seated Cable Row", "cable", "", "strength");
    const lateralRaise = await upsertExercise("Lateral Raise", "dumbbell", "", "strength");
    const barbellCurl = await upsertExercise("Barbell Curl", "barbell", "", "strength");
    const skullCrusher = await upsertExercise("Skull Crusher", "barbell", "", "strength");
    const rearDeltFly = await upsertExercise("Rear Delt Fly", "dumbbell", "", "strength");
    const hammerCurl = await upsertExercise("Hammer Curl", "dumbbell", "", "strength");
    const overheadTricepExtension = await upsertExercise("Overhead Tricep Extension", "dumbbell", "", "strength");
    const wristCurl = await upsertExercise("Wrist Curl", "dumbbell", "", "strength");
    const reverseWristCurl = await upsertExercise("Reverse Wrist Curl", "dumbbell", "", "strength");

    // Week 2 upper swaps
    const dumbbellBenchPress = await upsertExercise("Dumbbell Bench Press", "dumbbell", "", "strength");
    const singleArmLatPulldown = await upsertExercise("Single-Arm Lat Pulldown", "cable", "", "strength");
    const singleArmOverheadPress = await upsertExercise("Single-Arm Overhead Press", "dumbbell", "", "strength");
    const barbellRow = await upsertExercise("Barbell Row", "barbell", "", "strength");
    const altDBCurl = await upsertExercise("Alternating Dumbbell Curl", "dumbbell", "", "strength");
    const closeGripBench = await upsertExercise("Close-Grip Bench Press", "barbell", "", "strength");
    const flatDBPress = await upsertExercise("Flat Dumbbell Press", "dumbbell", "", "strength");
    const tBarRow = await upsertExercise("T-Bar Row", "t-bar", "", "strength");
    const pecDeck = await upsertExercise("Pec Deck", "machine", "", "strength");
    const singleArmCableRow = await upsertExercise("Single-Arm Cable Row", "cable", "", "strength");
    const pushUp = await upsertExercise("Push-Up", "", "", "strength");
    const facePull = await upsertExercise("Face Pull", "cable", "", "strength");
    const arnoldPress = await upsertExercise("Arnold Press", "dumbbell", "", "strength");
    const preacherCurl = await upsertExercise("Preacher Curl", "barbell", "", "strength");
    const cableTricepPushdown = await upsertExercise("Cable Tricep Pushdown", "cable", "", "strength");
    const cableLateralRaise = await upsertExercise("Cable Lateral Raise", "cable", "", "strength");
    const concentrationCurl = await upsertExercise("Concentration Curl", "dumbbell", "", "strength");
    const overheadCableTricepExt = await upsertExercise("Overhead Cable Tricep Extension", "cable", "", "strength");
    const farmersWalk = await upsertExercise("Farmer's Walk", "dumbbell", "", "strength");
    const reverseCurl = await upsertExercise("Reverse Curl", "barbell", "", "strength");

    // -- Lower body --
    const barbellBackSquat = await upsertExercise("Barbell Back Squat", "barbell", "", "strength");
    const singleLegRDL = await upsertExercise("Single-Leg RDL", "dumbbell", "", "strength");
    const walkingLunges = await upsertExercise("Walking Lunges", "dumbbell", "", "strength");
    const legCurl = await upsertExercise("Leg Curl", "machine", "", "strength");
    const barbellHipThrust = await upsertExercise("Barbell Hip Thrust", "barbell", "", "strength");
    const standingCalfRaise = await upsertExercise("Standing Calf Raise", "machine", "", "strength");
    const legPress = await upsertExercise("Leg Press", "machine", "", "strength");
    const romanianDeadlift = await upsertExercise("Romanian Deadlift", "barbell", "", "strength");
    const legExtension = await upsertExercise("Leg Extension", "machine", "", "strength");
    const bulgarianSplitSquat = await upsertExercise("Bulgarian Split Squat", "dumbbell", "", "strength");
    const seatedCalfRaise = await upsertExercise("Seated Calf Raise", "machine", "", "strength");

    // Week 2 lower swaps
    const conventionalDeadlift = await upsertExercise("Conventional Deadlift", "barbell", "", "strength");
    const stepUps = await upsertExercise("Step-Ups", "dumbbell", "", "strength");
    const nordicHamstringCurl = await upsertExercise("Nordic Hamstring Curl", "", "", "strength");
    const singleLegGluteBridge = await upsertExercise("Single-Leg Glute Bridge", "", "", "strength");
    const singleLegCalfRaise = await upsertExercise("Single-Leg Calf Raise", "", "", "strength");
    const hackSquat = await upsertExercise("Hack Squat", "machine", "", "strength");
    const stiffLegDeadlift = await upsertExercise("Stiff-Leg Deadlift", "barbell", "", "strength");
    const sissySquat = await upsertExercise("Sissy Squat", "", "", "strength");
    const lyingLegCurl = await upsertExercise("Lying Leg Curl", "machine", "", "strength");
    const singleLegLegPress = await upsertExercise("Single-Leg Leg Press", "machine", "", "strength");
    const donkeyCalfRaise = await upsertExercise("Donkey Calf Raise", "machine", "", "strength");

    // ------------------------------------------------------------------
    // 2. Create training block
    // ------------------------------------------------------------------

    const trainingBlockId = crypto.randomUUID();
    await dbRun(
      `INSERT INTO training_blocks (id, name, description, cycle_days, is_recurring)
       VALUES (?, ?, ?, 14, 1)`,
      [trainingBlockId, BLOCK_NAME, "Two-week rotating full body program with bilateral/unilateral swaps"],
    );

    // ------------------------------------------------------------------
    // 3. Seed each day
    // ------------------------------------------------------------------

    // ======================== DAY 0 — Sun W1 — Long Run ========================
    {
      const dayId = await insertDay(trainingBlockId, 0, "Week 1 - Sunday (Long Run)", 0);
      const warmupBlock = await insertBlock(dayId, "Warmup / Prehab", "warmup", 0);
      await insertExercises(warmupBlock, [
        { exerciseId: dynamicWarmup, timeSeconds: 900 },
      ]);
      const mainBlock = await insertBlock(dayId, "Main", "cardio", 1);
      await insertExercises(mainBlock, [
        { exerciseId: easyLongRun, sets: 1, timeSeconds: 5400, rpe: 5 },
      ]);
      const coreBlock = await insertBlock(dayId, "Core", "strength", 2);
      await insertExercises(coreBlock, [
        { exerciseId: plank, sets: 3, timeSeconds: 60 },
      ]);
      const stretchBlock = await insertBlock(dayId, "Stretching", "stretching", 3);
      await insertExercises(stretchBlock, [
        { exerciseId: fullBodyStretch, timeSeconds: 600 },
      ]);
    }

    // ======================== DAY 1 — Mon W1 — Upper Strength (Heavy) ========================
    {
      const dayId = await insertDay(trainingBlockId, 1, "Week 1 - Monday (Upper Strength)", 0);
      const warmupBlock = await insertBlock(dayId, "Warmup / Prehab", "warmup", 0);
      await insertExercises(warmupBlock, [
        { exerciseId: bandPullAparts, sets: 2, reps: "15" },
        { exerciseId: shoulderCircles, sets: 2, reps: "10" },
        { exerciseId: pushUpWalkouts, sets: 2, reps: "5" },
      ]);
      const mainBlock = await insertBlock(dayId, "Main", "strength", 1);
      await insertExercises(mainBlock, [
        { exerciseId: barbellBenchPress, sets: 4, reps: "5", weight: 185, rpe: 8 },
        { exerciseId: pullUps, sets: 4, reps: "8", rpe: 7 },
        { exerciseId: overheadPress, sets: 3, reps: "6", weight: 95, rpe: 7 },
        { exerciseId: singleArmDBRow, sets: 3, reps: "10", weight: 60, rpe: 7 },
        { exerciseId: dumbbellCurl, sets: 3, reps: "10", weight: 30, rpe: 7 },
        { exerciseId: tricepDips, sets: 3, reps: "10", rpe: 7 },
      ]);
      const coreBlock = await insertBlock(dayId, "Core", "strength", 2);
      await insertExercises(coreBlock, [
        { exerciseId: hangingLegRaise, sets: 3, reps: "12" },
      ]);
      const stretchBlock = await insertBlock(dayId, "Stretching", "stretching", 3);
      await insertExercises(stretchBlock, [
        { exerciseId: upperBodyStretch, timeSeconds: 600 },
      ]);
    }

    // ======================== DAY 2 — Tue W1 — Lower Strength (Heavy) ========================
    {
      const dayId = await insertDay(trainingBlockId, 2, "Week 1 - Tuesday (Lower Strength)", 0);
      const warmupBlock = await insertBlock(dayId, "Warmup / Prehab", "warmup", 0);
      await insertExercises(warmupBlock, [
        { exerciseId: bwSquats, sets: 2, reps: "10" },
        { exerciseId: legSwings, sets: 2, reps: "10" },
        { exerciseId: gluteBridges, sets: 2, reps: "10" },
      ]);
      const mainBlock = await insertBlock(dayId, "Main", "strength", 1);
      await insertExercises(mainBlock, [
        { exerciseId: barbellBackSquat, sets: 4, reps: "5", weight: 225, rpe: 8 },
        { exerciseId: singleLegRDL, sets: 3, reps: "10", weight: 50, rpe: 7 },
        { exerciseId: walkingLunges, sets: 3, reps: "12", weight: 40, rpe: 7 },
        { exerciseId: legCurl, sets: 3, reps: "12", weight: 90, rpe: 7 },
        { exerciseId: barbellHipThrust, sets: 3, reps: "10", weight: 185, rpe: 7 },
        { exerciseId: standingCalfRaise, sets: 4, reps: "15", weight: 135, rpe: 7 },
      ]);
      const coreBlock = await insertBlock(dayId, "Core", "strength", 2);
      await insertExercises(coreBlock, [
        { exerciseId: abWheelRollout, sets: 3, reps: "10" },
      ]);
      const stretchBlock = await insertBlock(dayId, "Stretching", "stretching", 3);
      await insertExercises(stretchBlock, [
        { exerciseId: lowerBodyStretch, timeSeconds: 600 },
      ]);
    }

    // ======================== DAY 3 — Wed W1 — Tempo Run ========================
    {
      const dayId = await insertDay(trainingBlockId, 3, "Week 1 - Wednesday (Tempo Run)", 0);
      const warmupBlock = await insertBlock(dayId, "Warmup / Prehab", "warmup", 0);
      await insertExercises(warmupBlock, [
        { exerciseId: dynamicWarmup, timeSeconds: 900 },
      ]);
      const mainBlock = await insertBlock(dayId, "Main", "cardio", 1);
      await insertExercises(mainBlock, [
        { exerciseId: tempoRun, sets: 1, timeSeconds: 2400, rpe: 7 },
      ]);
      const coreBlock = await insertBlock(dayId, "Core", "strength", 2);
      await insertExercises(coreBlock, [
        { exerciseId: russianTwists, sets: 3, reps: "20" },
      ]);
      const stretchBlock = await insertBlock(dayId, "Stretching", "stretching", 3);
      await insertExercises(stretchBlock, [
        { exerciseId: fullBodyStretch, timeSeconds: 600 },
      ]);
    }

    // ======================== DAY 4 — Thu W1 — Upper Volume ========================
    {
      const dayId = await insertDay(trainingBlockId, 4, "Week 1 - Thursday (Upper Volume)", 0);
      const warmupBlock = await insertBlock(dayId, "Warmup / Prehab", "warmup", 0);
      await insertExercises(warmupBlock, [
        { exerciseId: bandPullAparts, sets: 2, reps: "15" },
        { exerciseId: armCircles, sets: 2, reps: "10" },
        { exerciseId: catCow, sets: 2, reps: "10" },
      ]);
      const mainBlock = await insertBlock(dayId, "Main", "strength", 1);
      await insertExercises(mainBlock, [
        { exerciseId: inclineDBPress, sets: 4, reps: "12", weight: 60, rpe: 7 },
        { exerciseId: cableRow, sets: 4, reps: "12", weight: 120, rpe: 7 },
        { exerciseId: dumbbellFly, sets: 3, reps: "15", weight: 30, rpe: 6 },
        { exerciseId: latPulldown, sets: 3, reps: "12", weight: 130, rpe: 7 },
        { exerciseId: cableCrossover, sets: 3, reps: "15", weight: 30, rpe: 6 },
        { exerciseId: seatedCableRow, sets: 3, reps: "12", weight: 100, rpe: 7 },
      ]);
      const coreBlock = await insertBlock(dayId, "Core", "strength", 2);
      await insertExercises(coreBlock, [
        { exerciseId: deadBug, sets: 3, reps: "12" },
      ]);
      const stretchBlock = await insertBlock(dayId, "Stretching", "stretching", 3);
      await insertExercises(stretchBlock, [
        { exerciseId: upperBodyStretch, timeSeconds: 600 },
      ]);
    }

    // ======================== DAY 5 — Fri W1 — Arms ========================
    {
      const dayId = await insertDay(trainingBlockId, 5, "Week 1 - Friday (Arms)", 0);
      const warmupBlock = await insertBlock(dayId, "Warmup / Prehab", "warmup", 0);
      await insertExercises(warmupBlock, [
        { exerciseId: wristCircles, sets: 2, reps: "10" },
        { exerciseId: lightCurls, sets: 2, reps: "10" },
        { exerciseId: bandPullAparts, sets: 2, reps: "15" },
      ]);
      const mainBlock = await insertBlock(dayId, "Main", "strength", 1);
      await insertExercises(mainBlock, [
        { exerciseId: lateralRaise, sets: 4, reps: "15", weight: 20, rpe: 7 },
        { exerciseId: barbellCurl, sets: 4, reps: "10", weight: 65, rpe: 7 },
        { exerciseId: skullCrusher, sets: 4, reps: "10", weight: 60, rpe: 7 },
        { exerciseId: rearDeltFly, sets: 3, reps: "15", weight: 15, rpe: 6 },
        { exerciseId: hammerCurl, sets: 3, reps: "12", weight: 30, rpe: 7 },
        { exerciseId: overheadTricepExtension, sets: 3, reps: "12", weight: 50, rpe: 7 },
        { exerciseId: wristCurl, sets: 3, reps: "15", weight: 25, rpe: 6 },
        { exerciseId: reverseWristCurl, sets: 3, reps: "15", weight: 15, rpe: 6 },
      ]);
      const coreBlock = await insertBlock(dayId, "Core", "strength", 2);
      await insertExercises(coreBlock, [
        { exerciseId: cableWoodchop, sets: 3, reps: "12" },
      ]);
      const stretchBlock = await insertBlock(dayId, "Stretching", "stretching", 3);
      await insertExercises(stretchBlock, [
        { exerciseId: upperBodyStretch, timeSeconds: 600 },
      ]);
    }

    // ======================== DAY 6 — Sat W1 — Leg Volume ========================
    {
      const dayId = await insertDay(trainingBlockId, 6, "Week 1 - Saturday (Leg Volume)", 0);
      const warmupBlock = await insertBlock(dayId, "Warmup / Prehab", "warmup", 0);
      await insertExercises(warmupBlock, [
        { exerciseId: bwSquats, sets: 2, reps: "10" },
        { exerciseId: hipCircles, sets: 2, reps: "10" },
        { exerciseId: ankleCircles, sets: 2, reps: "10" },
      ]);
      const mainBlock = await insertBlock(dayId, "Main", "strength", 1);
      await insertExercises(mainBlock, [
        { exerciseId: legPress, sets: 4, reps: "12", weight: 315, rpe: 7 },
        { exerciseId: romanianDeadlift, sets: 4, reps: "10", weight: 155, rpe: 7 },
        { exerciseId: legExtension, sets: 3, reps: "15", weight: 100, rpe: 7 },
        { exerciseId: legCurl, sets: 3, reps: "15", weight: 80, rpe: 7 },
        { exerciseId: bulgarianSplitSquat, sets: 3, reps: "10", weight: 30, rpe: 7 },
        { exerciseId: seatedCalfRaise, sets: 4, reps: "15", weight: 90, rpe: 7 },
      ]);
      const coreBlock = await insertBlock(dayId, "Core", "strength", 2);
      await insertExercises(coreBlock, [
        { exerciseId: bicycleCrunch, sets: 3, reps: "20" },
      ]);
      const stretchBlock = await insertBlock(dayId, "Stretching", "stretching", 3);
      await insertExercises(stretchBlock, [
        { exerciseId: lowerBodyStretch, timeSeconds: 600 },
      ]);
    }

    // ======================== DAY 7 — Sun W2 — Long Run (same as Day 0) ========================
    {
      const dayId = await insertDay(trainingBlockId, 7, "Week 2 - Sunday (Long Run)", 0);
      const warmupBlock = await insertBlock(dayId, "Warmup / Prehab", "warmup", 0);
      await insertExercises(warmupBlock, [
        { exerciseId: dynamicWarmup, timeSeconds: 900 },
      ]);
      const mainBlock = await insertBlock(dayId, "Main", "cardio", 1);
      await insertExercises(mainBlock, [
        { exerciseId: easyLongRun, sets: 1, timeSeconds: 5400, rpe: 5 },
      ]);
      const coreBlock = await insertBlock(dayId, "Core", "strength", 2);
      await insertExercises(coreBlock, [
        { exerciseId: plank, sets: 3, timeSeconds: 60 },
      ]);
      const stretchBlock = await insertBlock(dayId, "Stretching", "stretching", 3);
      await insertExercises(stretchBlock, [
        { exerciseId: fullBodyStretch, timeSeconds: 600 },
      ]);
    }

    // ======================== DAY 8 — Mon W2 — Upper Strength (Swapped) ========================
    {
      const dayId = await insertDay(trainingBlockId, 8, "Week 2 - Monday (Upper Strength)", 0);
      const warmupBlock = await insertBlock(dayId, "Warmup / Prehab", "warmup", 0);
      await insertExercises(warmupBlock, [
        { exerciseId: bandPullAparts, sets: 2, reps: "15" },
        { exerciseId: shoulderCircles, sets: 2, reps: "10" },
        { exerciseId: pushUpWalkouts, sets: 2, reps: "5" },
      ]);
      const mainBlock = await insertBlock(dayId, "Main", "strength", 1);
      await insertExercises(mainBlock, [
        { exerciseId: dumbbellBenchPress, sets: 4, reps: "6", weight: 75, rpe: 8 },
        { exerciseId: singleArmLatPulldown, sets: 4, reps: "10", weight: 60, rpe: 7 },
        { exerciseId: singleArmOverheadPress, sets: 3, reps: "8", weight: 40, rpe: 7 },
        { exerciseId: barbellRow, sets: 3, reps: "8", weight: 135, rpe: 7 },
        { exerciseId: altDBCurl, sets: 3, reps: "10", weight: 30 },
        { exerciseId: closeGripBench, sets: 3, reps: "10", weight: 115 },
      ]);
      const coreBlock = await insertBlock(dayId, "Core", "strength", 2);
      await insertExercises(coreBlock, [
        { exerciseId: hangingLegRaise, sets: 3, reps: "12" },
      ]);
      const stretchBlock = await insertBlock(dayId, "Stretching", "stretching", 3);
      await insertExercises(stretchBlock, [
        { exerciseId: upperBodyStretch, timeSeconds: 600 },
      ]);
    }

    // ======================== DAY 9 — Tue W2 — Lower Strength (Swapped) ========================
    {
      const dayId = await insertDay(trainingBlockId, 9, "Week 2 - Tuesday (Lower Strength)", 0);
      const warmupBlock = await insertBlock(dayId, "Warmup / Prehab", "warmup", 0);
      await insertExercises(warmupBlock, [
        { exerciseId: bwSquats, sets: 2, reps: "10" },
        { exerciseId: legSwings, sets: 2, reps: "10" },
        { exerciseId: gluteBridges, sets: 2, reps: "10" },
      ]);
      const mainBlock = await insertBlock(dayId, "Main", "strength", 1);
      await insertExercises(mainBlock, [
        { exerciseId: bulgarianSplitSquat, sets: 4, reps: "8", weight: 40, rpe: 8 },
        { exerciseId: conventionalDeadlift, sets: 4, reps: "5", weight: 275, rpe: 8 },
        { exerciseId: stepUps, sets: 3, reps: "10", weight: 35, rpe: 7 },
        { exerciseId: nordicHamstringCurl, sets: 3, reps: "6", rpe: 8 },
        { exerciseId: singleLegGluteBridge, sets: 3, reps: "12", rpe: 7 },
        { exerciseId: singleLegCalfRaise, sets: 4, reps: "12", rpe: 7 },
      ]);
      const coreBlock = await insertBlock(dayId, "Core", "strength", 2);
      await insertExercises(coreBlock, [
        { exerciseId: abWheelRollout, sets: 3, reps: "10" },
      ]);
      const stretchBlock = await insertBlock(dayId, "Stretching", "stretching", 3);
      await insertExercises(stretchBlock, [
        { exerciseId: lowerBodyStretch, timeSeconds: 600 },
      ]);
    }

    // ======================== DAY 10 — Wed W2 — Hill Repeats ========================
    {
      const dayId = await insertDay(trainingBlockId, 10, "Week 2 - Wednesday (Hill Repeats)", 0);
      const warmupBlock = await insertBlock(dayId, "Warmup / Prehab", "warmup", 0);
      await insertExercises(warmupBlock, [
        { exerciseId: dynamicWarmup, timeSeconds: 900 },
      ]);
      const mainBlock = await insertBlock(dayId, "Main", "cardio", 1);
      await insertExercises(mainBlock, [
        { exerciseId: hillRepeats, sets: 1, timeSeconds: 2400, rpe: 8 },
      ]);
      const coreBlock = await insertBlock(dayId, "Core", "strength", 2);
      await insertExercises(coreBlock, [
        { exerciseId: sidePlank, sets: 3, timeSeconds: 30 },
      ]);
      const stretchBlock = await insertBlock(dayId, "Stretching", "stretching", 3);
      await insertExercises(stretchBlock, [
        { exerciseId: fullBodyStretch, timeSeconds: 600 },
      ]);
    }

    // ======================== DAY 11 — Thu W2 — Upper Volume (Variation) ========================
    {
      const dayId = await insertDay(trainingBlockId, 11, "Week 2 - Thursday (Upper Volume)", 0);
      const warmupBlock = await insertBlock(dayId, "Warmup / Prehab", "warmup", 0);
      await insertExercises(warmupBlock, [
        { exerciseId: bandPullAparts, sets: 2, reps: "15" },
        { exerciseId: armCircles, sets: 2, reps: "10" },
        { exerciseId: catCow, sets: 2, reps: "10" },
      ]);
      const mainBlock = await insertBlock(dayId, "Main", "strength", 1);
      await insertExercises(mainBlock, [
        { exerciseId: flatDBPress, sets: 4, reps: "12", weight: 55 },
        { exerciseId: tBarRow, sets: 4, reps: "12", weight: 90 },
        { exerciseId: pecDeck, sets: 3, reps: "15", weight: 120 },
        { exerciseId: singleArmCableRow, sets: 3, reps: "12", weight: 40 },
        { exerciseId: pushUp, sets: 3, reps: "15" },
        { exerciseId: facePull, sets: 3, reps: "15", weight: 40 },
      ]);
      const coreBlock = await insertBlock(dayId, "Core", "strength", 2);
      await insertExercises(coreBlock, [
        { exerciseId: deadBug, sets: 3, reps: "12" },
      ]);
      const stretchBlock = await insertBlock(dayId, "Stretching", "stretching", 3);
      await insertExercises(stretchBlock, [
        { exerciseId: upperBodyStretch, timeSeconds: 600 },
      ]);
    }

    // ======================== DAY 12 — Fri W2 — Arms (Variation) ========================
    {
      const dayId = await insertDay(trainingBlockId, 12, "Week 2 - Friday (Arms)", 0);
      const warmupBlock = await insertBlock(dayId, "Warmup / Prehab", "warmup", 0);
      await insertExercises(warmupBlock, [
        { exerciseId: wristCircles, sets: 2, reps: "10" },
        { exerciseId: lightCurls, sets: 2, reps: "10" },
        { exerciseId: bandPullAparts, sets: 2, reps: "15" },
      ]);
      const mainBlock = await insertBlock(dayId, "Main", "strength", 1);
      await insertExercises(mainBlock, [
        { exerciseId: arnoldPress, sets: 4, reps: "12", weight: 35 },
        { exerciseId: preacherCurl, sets: 4, reps: "10", weight: 50 },
        { exerciseId: cableTricepPushdown, sets: 4, reps: "12", weight: 50 },
        { exerciseId: cableLateralRaise, sets: 3, reps: "15", weight: 15 },
        { exerciseId: concentrationCurl, sets: 3, reps: "12", weight: 25 },
        { exerciseId: overheadCableTricepExt, sets: 3, reps: "12", weight: 40 },
        { exerciseId: farmersWalk, sets: 3, timeSeconds: 40, weight: 60 },
        { exerciseId: reverseCurl, sets: 3, reps: "15", weight: 30 },
      ]);
      const coreBlock = await insertBlock(dayId, "Core", "strength", 2);
      await insertExercises(coreBlock, [
        { exerciseId: cableWoodchop, sets: 3, reps: "12" },
      ]);
      const stretchBlock = await insertBlock(dayId, "Stretching", "stretching", 3);
      await insertExercises(stretchBlock, [
        { exerciseId: upperBodyStretch, timeSeconds: 600 },
      ]);
    }

    // ======================== DAY 13 — Sat W2 — Leg Volume (Variation) ========================
    {
      const dayId = await insertDay(trainingBlockId, 13, "Week 2 - Saturday (Leg Volume)", 0);
      const warmupBlock = await insertBlock(dayId, "Warmup / Prehab", "warmup", 0);
      await insertExercises(warmupBlock, [
        { exerciseId: bwSquats, sets: 2, reps: "10" },
        { exerciseId: hipCircles, sets: 2, reps: "10" },
        { exerciseId: ankleCircles, sets: 2, reps: "10" },
      ]);
      const mainBlock = await insertBlock(dayId, "Main", "strength", 1);
      await insertExercises(mainBlock, [
        { exerciseId: hackSquat, sets: 4, reps: "12", weight: 180 },
        { exerciseId: stiffLegDeadlift, sets: 4, reps: "10", weight: 135 },
        { exerciseId: sissySquat, sets: 3, reps: "12" },
        { exerciseId: lyingLegCurl, sets: 3, reps: "15", weight: 75 },
        { exerciseId: singleLegLegPress, sets: 3, reps: "10", weight: 150 },
        { exerciseId: donkeyCalfRaise, sets: 4, reps: "15", weight: 90 },
      ]);
      const coreBlock = await insertBlock(dayId, "Core", "strength", 2);
      await insertExercises(coreBlock, [
        { exerciseId: bicycleCrunch, sets: 3, reps: "20" },
      ]);
      const stretchBlock = await insertBlock(dayId, "Stretching", "stretching", 3);
      await insertExercises(stretchBlock, [
        { exerciseId: lowerBodyStretch, timeSeconds: 600 },
      ]);
    }

    return Response.json({ id: trainingBlockId }, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
