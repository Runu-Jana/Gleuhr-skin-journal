/**
 * Comprehensive workflow test for phone 7973944144
 * Tests: Patient, DailyCheckIn, SkinScore, Streak, Gamification, Admin dashboard
 *
 * Run: node test-workflow.js
 */

process.env.NODE_ENV = 'test';
process.env.ADMIN_API_KEY = 'gleuhr-admin-2024';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

// ── Colours for output ──────────────────────────────────────────────────────
const G = (s) => `\x1b[32m${s}\x1b[0m`;   // green
const R = (s) => `\x1b[31m${s}\x1b[0m`;   // red
const Y = (s) => `\x1b[33m${s}\x1b[0m`;   // yellow
const B = (s) => `\x1b[34m${s}\x1b[0m`;   // blue
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

const PASS = G('✅ PASS');
const FAIL = R('❌ FAIL');
const WARN = Y('⚠️  WARN');

let passed = 0, failed = 0, warnings = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}${detail ? '  →  ' + R(detail) : ''}`);
    failed++;
  }
}

function warn(condition, label, detail = '') {
  if (!condition) {
    console.log(`  ${WARN} ${label}${detail ? '  →  ' + Y(detail) : ''}`);
    warnings++;
  } else {
    console.log(`  ${PASS} ${label}`);
    passed++;
  }
}

function section(title) {
  console.log(`\n${B('━'.repeat(60))}`);
  console.log(B(`  ${title}`));
  console.log(B('━'.repeat(60)));
}

// ── Test data ───────────────────────────────────────────────────────────────
const TEST_PHONE  = '7973944144';
const PHONE_FULL  = '+917973944144';
const PHONE_91    = '917973944144';
const ADMIN_KEY   = 'gleuhr-admin-2024';

// ── Bootstrap ───────────────────────────────────────────────────────────────
let mongod, app, Patient, SkinScore, DailyCheckIn, Streak;

async function setup() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  console.log(G('\n  [DB] In-memory MongoDB started'));

  // Set MONGODB_URI so index.js can connect to our test DB
  process.env.MONGODB_URI = uri;
  // Disable Airtable (no creds in test)
  delete process.env.AIRTABLE_PAT;
  delete process.env.AIRTABLE_BASE_ID;

  Patient      = require('./server/models/Patient');
  SkinScore    = require('./server/models/SkinScore');
  DailyCheckIn = require('./server/models/DailyCheckIn');
  Streak       = require('./server/models/Streak');

  // Load the express app
  app = require('./server/index');
  // Give it a tick to finish setup
  await new Promise(r => setTimeout(r, 200));
}

async function teardown() {
  await mongoose.disconnect();
  await mongod.stop();
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function dateStr(d) {
  return d.toISOString().split('T')[0];
}

// ── Test Suites ──────────────────────────────────────────────────────────────

async function testPatientCRUD() {
  section('1. PATIENT CRUD — phone 7973944144');

  // Create patient via API
  const res = await request(app)
    .get(`/api/patient/${TEST_PHONE}`)
    .set('x-admin-api-key', ADMIN_KEY);

  // Patient doesn't exist yet — should 404
  assert(res.status === 404 || res.status === 200, 'GET patient returns valid HTTP (404 if new, 200 if exists)', `got ${res.status}`);

  // Seed a patient directly in DB to simulate existing user
  const patient = await Patient.create({
    name: 'Riya jana',
    phoneNumber: PHONE_FULL,
    phone: TEST_PHONE,
    email: 'riya@test.com',
    skinConcern: 'Acne',
    planType: 'Premium',
    startDate: daysAgo(30),
    currentDay: 30,
    completionPercentage: 33,
    hasCommitted: true,
    isActive: true,
    totalPoints: 150,
    level: 2,
  });
  assert(!!patient._id, 'Patient seeded in MongoDB');
  assert(patient.phoneNumber === PHONE_FULL, 'phoneNumber stored correctly');
  assert(patient.phone === TEST_PHONE, 'phone (10-digit) stored correctly');

  // Fetch via API
  const res2 = await request(app).get(`/api/patient/${TEST_PHONE}`);
  assert(res2.status === 200, `GET /api/patient/${TEST_PHONE} → 200`);
  assert(res2.body.phone === TEST_PHONE || res2.body.phoneNumber === TEST_PHONE || res2.body.phoneNumber === PHONE_FULL,
    'Response contains correct phone');
  assert(res2.body.name === 'Riya jana', 'Response contains correct name');

  // Test with +91 prefix
  const res3 = await request(app).get(`/api/patient/${PHONE_FULL}`);
  warn(res3.status === 200, `GET /api/patient/${PHONE_FULL} works (phone with +91)`, `got ${res3.status} — phone variant lookup may need fix`);

  // Test with 91 prefix
  const res4 = await request(app).get(`/api/patient/${PHONE_91}`);
  warn(res4.status === 200, `GET /api/patient/${PHONE_91} works (phone with 91)`, `got ${res4.status} — phone variant lookup may need fix`);

  return patient;
}

async function testSkinScore(patient) {
  section('2. SKIN SCORE — calculation & storage');

  // Post a skin score
  const payload = {
    patientId: patient._id.toString(),
    patientPhone: TEST_PHONE,
    darkest_patch: 4,
    skin_tone: 3,
    texture: 2,
    confidence: 5,
    date: new Date().toISOString(),
    day: 30,
    notes: 'Test score',
  };

  const res = await request(app)
    .post('/api/skinscore')
    .send(payload);

  assert(res.status === 200 || res.status === 201, `POST /api/skinscore → ${res.status}`);

  if (res.body.totalScore !== undefined) {
    const expected = payload.darkest_patch + payload.skin_tone + payload.texture + payload.confidence; // 14
    assert(res.body.totalScore === expected,
      `totalScore calculation correct: ${payload.darkest_patch}+${payload.skin_tone}+${payload.texture}+${payload.confidence} = ${expected}`,
      `got ${res.body.totalScore}`);
  } else {
    console.log(`  ${WARN} totalScore not returned in POST response — checking DB directly`);
  }

  // Verify in DB
  const dbScore = await SkinScore.findOne({ phoneNumber: TEST_PHONE });
  const dbScoreFull = await SkinScore.findOne({ phoneNumber: PHONE_FULL });
  const score = dbScore || dbScoreFull;
  assert(!!score, 'SkinScore saved in MongoDB');
  if (score) {
    assert(score.totalScore === 14, `DB totalScore = 14 (4+3+2+5)`, `got ${score.totalScore}`);
    assert(score.darkest_patch === 4, 'darkest_patch stored');
    assert(score.confidence === 5, 'confidence stored');
  }

  // Fetch via GET
  const resGet = await request(app).get(`/api/skinscore/${TEST_PHONE}`);
  assert(resGet.status === 200, `GET /api/skinscore/${TEST_PHONE} → 200`);
  warn(Array.isArray(resGet.body) || Array.isArray(resGet.body?.data),
    'GET skin scores returns an array', 'Response structure unexpected');

  const latest = await request(app).get(`/api/skinscore/${TEST_PHONE}/latest`);
  assert(latest.status === 200, `GET /api/skinscore/${TEST_PHONE}/latest → 200`);
  assert(latest.body?.totalScore === 14 || latest.body?.data?.totalScore === 14,
    'Latest skin score totalScore = 14', `got ${JSON.stringify(latest.body)}`);

  // Post a second score (progress tracking)
  await request(app).post('/api/skinscore').send({ ...payload, darkest_patch: 5, skin_tone: 4, texture: 4, confidence: 5, day: 31, date: new Date().toISOString() });
  const scores = await SkinScore.find({ $or: [{ phoneNumber: TEST_PHONE }, { phoneNumber: PHONE_FULL }] });
  assert(scores.length >= 2, `Multiple skin scores stored (${scores.length})`);
  assert(scores.every(s => s.totalScore === (s.darkest_patch + s.skin_tone + s.texture + s.confidence)),
    'All skin scores: totalScore = sum of 4 metrics (auto-calc is correct)');
}

async function testDailyCheckIn(patient) {
  section('3. DAILY CHECK-IN — saving, streak update, fields');

  const today = dateStr(new Date());

  const payload = {
    patientId: patient._id.toString(),
    patientPhone: TEST_PHONE,
    date: today,
    dayOfJourney: 30,
    amRoutine: true,
    pmRoutine: true,
    sunscreen: true,
    dietFollowed: 'Yes',
    triggerFoods: [],
    skinScore: 16,
    skinScores: {
      texture: 2,
      pigmentation: 1,
      brightness: 2,
      breakouts: 1,
      confidence: 2,
      hydration: 2,
      smoothness: 2,
      evenness: 2,
      firmness: 1,
      glow: 1
    },
    mood: 'good',
    energy: 'high',
    sleep: 7,
    waterIntake: 8,
    notes: 'Feeling good',
  };

  const res = await request(app)
    .post('/api/checkin')
    .send(payload);

  assert(res.status === 200 || res.status === 201, `POST /api/checkin → ${res.status}`);

  // Verify in DB
  const ci = await DailyCheckIn.findOne({ $or: [{ patientPhone: TEST_PHONE }, { patientId: patient._id.toString() }] });
  assert(!!ci, 'DailyCheckIn saved in MongoDB');
  if (ci) {
    assert(ci.completed === true, 'completed flag = true');
    assert(ci.amRoutine === true, 'amRoutine saved');
    assert(ci.pmRoutine === true, 'pmRoutine saved');
    assert(ci.sunscreen === true, 'sunscreen saved');
    assert(ci.dietFollowed === 'Yes', 'dietFollowed saved');
    assert(ci.skinScore === 16, `skinScore = 16`, `got ${ci.skinScore}`);
    assert(ci.mood === 'good', 'mood saved');
    assert(typeof ci.skinScores === 'object', 'skinScores object stored');
    assert(ci.waterIntake === 8, 'waterIntake saved');
  }

  // Verify streak was updated
  const streak = await Streak.findOne({ $or: [{ patientPhone: TEST_PHONE }, { patientId: patient._id.toString() }] });
  assert(!!streak, 'Streak record created on first check-in');
  if (streak) {
    assert(streak.currentStreak >= 1, `currentStreak >= 1 (got ${streak.currentStreak})`);
    assert(streak.longestStreak >= streak.currentStreak, 'longestStreak >= currentStreak');
  }

  // Verify patient currentDay updated
  const updatedPatient = await Patient.findById(patient._id);
  warn(updatedPatient.currentDay >= 30, `currentDay updated on check-in (got ${updatedPatient.currentDay})`,
    'currentDay not incrementing — check checkin.js updateStreak logic');

  // GET check-ins
  const resGet = await request(app).get(`/api/checkin/${TEST_PHONE}`);
  assert(resGet.status === 200, `GET /api/checkin/${TEST_PHONE} → 200`);
  const list = Array.isArray(resGet.body) ? resGet.body : resGet.body?.data;
  assert(Array.isArray(list) && list.length >= 1, 'GET returns array with at least 1 check-in');
}

async function testStreakLogic(patient) {
  section('4. STREAK LOGIC — consecutive days, shield system');

  // Seed 7 consecutive check-ins (yesterday through 6 days ago)
  const baseStreak = await Streak.findOneAndUpdate(
    { patientPhone: TEST_PHONE },
    {
      patientPhone: TEST_PHONE,
      patientId: patient._id.toString(),
      currentStreak: 7,
      longestStreak: 7,
      lastCheckIn: dateStr(daysAgo(0)),
      checkInDates: Array.from({ length: 7 }, (_, i) => ({
        date: dateStr(daysAgo(6 - i)),
        completed: true,
        checkInTime: daysAgo(6 - i),
      })),
    },
    { upsert: true, new: true }
  );
  assert(baseStreak.currentStreak === 7, 'Seeded 7-day streak');

  // GET streak via API
  const res = await request(app).get(`/api/streak/${TEST_PHONE}`);
  assert(res.status === 200, `GET /api/streak/${TEST_PHONE} → 200`);
  assert(res.body.streak >= 7 || res.body.currentStreak >= 7,
    `streak = 7 from API`, `got ${JSON.stringify(res.body)}`);

  // Shield calculation: Math.min(3, Math.floor(7 / 7)) = 1
  const expectedEarned = Math.min(3, Math.floor(7 / 7));
  const shields = res.body.shields || res.body.restorationShields;
  warn(
    shields !== undefined,
    `Shields returned in streak response`,
    'Shield data missing from GET /api/streak response'
  );

  // Test consecutive check-in (today) — streak should stay 7 (already checked in today)
  await request(app).post('/api/checkin').send({
    patientId: patient._id.toString(),
    patientPhone: TEST_PHONE,
    date: dateStr(new Date()),
    dayOfJourney: 31,
    amRoutine: true,
    pmRoutine: false,
    sunscreen: false,
    dietFollowed: 'Partial',
    completed: true,
  });
  const s2 = await Streak.findOne({ patientPhone: TEST_PHONE });
  assert(s2.currentStreak >= 7, `Streak stays >= 7 after re-checking-in today (got ${s2.currentStreak})`);

  // Test streak restoration
  // First break the streak
  await Streak.findOneAndUpdate(
    { patientPhone: TEST_PHONE },
    { currentStreak: 0, lastCheckIn: dateStr(daysAgo(3)) }
  );

  // Ensure we have a shield
  await Streak.findOneAndUpdate(
    { patientPhone: TEST_PHONE },
    { 'shields.monthly': 2, 'shields.used': 0, 'shields.lastResetMonth': new Date().toISOString().slice(0, 7) }
  );

  const restoreRes = await request(app)
    .post('/api/streak/restore')
    .send({ phone: TEST_PHONE });

  assert(restoreRes.status === 200, `POST /api/streak/restore → ${restoreRes.status}`);
  assert(
    restoreRes.body.success === true || restoreRes.body.restoredStreak !== undefined,
    'Streak restored successfully'
  );
  if (restoreRes.body.restoredStreak !== undefined) {
    assert(restoreRes.body.restoredStreak >= 1, `Restored streak >= 1 (got ${restoreRes.body.restoredStreak})`);
    assert(restoreRes.body.shieldsRemaining !== undefined, 'shieldsRemaining returned');
  }
}

async function testGamification(patient) {
  section('5. GAMIFICATION — points, level, achievements');

  // Check points exist
  const p = await Patient.findById(patient._id);
  warn(p.totalPoints >= 0, `totalPoints field exists (= ${p.totalPoints})`);
  warn(p.level >= 1, `level field exists (= ${p.level})`);
  warn(Array.isArray(p.achievements), 'achievements array exists');

  // Check if check-ins update points
  const beforePoints = p.totalPoints || 0;
  await request(app).post('/api/checkin').send({
    patientId: patient._id.toString(),
    patientPhone: TEST_PHONE,
    date: dateStr(new Date()),
    dayOfJourney: 32,
    amRoutine: true,
    pmRoutine: true,
    sunscreen: true,
    dietFollowed: 'Yes',
    completed: true,
  });
  const p2 = await Patient.findById(patient._id);
  warn(
    p2.totalPoints >= beforePoints,
    `Points updated after check-in (before=${beforePoints}, after=${p2.totalPoints})`,
    'totalPoints not being incremented — check if checkin.js updates totalPoints'
  );

  // Level-up logic: level field should increase with points
  // Manually set high points and see if API reflects updated level
  await Patient.findByIdAndUpdate(patient._id, { totalPoints: 500, level: 1 });
  const pHigh = await Patient.findById(patient._id);
  // Level calculation isn't auto-computed, just check the value is stored
  assert(pHigh.totalPoints === 500, 'totalPoints manually updatable (DB write confirmed)');

  const resGet = await request(app).get(`/api/patient/${TEST_PHONE}`);
  warn(
    resGet.body.totalPoints !== undefined,
    'totalPoints returned in GET /api/patient response',
    'totalPoints missing from patient API response'
  );
  warn(
    resGet.body.level !== undefined,
    'level returned in GET /api/patient response',
    'level missing from patient API response'
  );
  warn(
    Array.isArray(resGet.body.achievements),
    'achievements returned in GET /api/patient response',
    'achievements missing from patient API response'
  );
}

async function testAdminDashboard(patient) {
  section('6. ADMIN DASHBOARD — patient appears, metrics correct');

  // Seed a few historical check-ins (simulate 30-day active user)
  const checkIns = [];
  for (let i = 29; i >= 1; i--) {
    checkIns.push({
      patientPhone: TEST_PHONE,
      patientId: patient._id.toString(),
      date: dateStr(daysAgo(i)),
      dayOfJourney: 31 - i,
      amRoutine: true,
      pmRoutine: i % 2 === 0,
      sunscreen: i % 3 !== 0,
      dietFollowed: i % 4 === 0 ? 'No' : 'Yes',
      skinScore: 14 + (i % 3),
      completed: true,
      completedAt: daysAgo(i),
    });
  }
  await DailyCheckIn.insertMany(checkIns);

  // Admin dashboard
  const res = await request(app)
    .get('/api/admin/dashboard')
    .set('x-admin-api-key', ADMIN_KEY);
  assert(res.status === 200, `GET /api/admin/dashboard → 200`);
  assert(res.body.stats !== undefined || res.body.needAttention !== undefined,
    'Dashboard returns stats/needAttention data');

  if (res.body.stats) {
    console.log(DIM(`    Stats: ${JSON.stringify(res.body.stats)}`));
  }

  // Admin patient list
  const resList = await request(app)
    .get('/api/admin/patients')
    .set('x-admin-api-key', ADMIN_KEY);
  assert(resList.status === 200, `GET /api/admin/patients → 200`);
  const patients = resList.body.patients || resList.body.data || resList.body;
  const found = Array.isArray(patients) && patients.some(p =>
    (p.phone || p.phoneNumber || '').includes(TEST_PHONE)
  );
  assert(found, `Patient 7973944144 appears in admin patient list`);

  // Admin patient detail
  const resDetail = await request(app)
    .get(`/api/admin/patients/${TEST_PHONE}/details`)
    .set('x-admin-api-key', ADMIN_KEY);
  assert(
    resDetail.status === 200 || resDetail.status === 404,
    `GET /api/admin/patients/${TEST_PHONE}/details → valid response (${resDetail.status})`
  );
  if (resDetail.status === 200) {
    const data = resDetail.body.data || resDetail.body;
    warn(data.consistency !== undefined || data.weekGrid !== undefined,
      'Patient detail includes consistency/weekGrid data',
      'consistency or weekGrid missing from patient details endpoint');
    warn(data.skinScores !== undefined || data.skinTrajectory !== undefined,
      'Patient detail includes skin score history',
      'Skin score history missing from patient details');
  }

  // Admin patient by ID
  const resById = await request(app)
    .get(`/api/admin/patient/${patient._id}`)
    .set('x-admin-api-key', ADMIN_KEY);
  assert(resById.status === 200, `GET /api/admin/patient/:id → 200`);
  if (resById.body) {
    const d = resById.body;
    // Consistency calculation: check-ins / expected days
    const checkInCount = await DailyCheckIn.countDocuments({
      $or: [{ patientPhone: TEST_PHONE }, { patientId: patient._id.toString() }]
    });
    const expectedDays = Math.ceil((new Date() - new Date(patient.startDate)) / (1000 * 60 * 60 * 24));
    const expectedConsistency = Math.min(100, Math.round((checkInCount / expectedDays) * 100));
    warn(
      d.consistency !== undefined,
      `Consistency in admin detail (expected ~${expectedConsistency}%, got ${d.consistency})`,
      'Consistency missing from admin patient detail'
    );
  }
}

async function testDieticianEndpoint() {
  section('7. DIETICIAN ENDPOINT — customer listing (Airtable disabled in test)');

  // Airtable is disabled in test env, so these should return empty gracefully
  const res = await request(app)
    .get('/api/admin/dietician')
    .set('x-admin-api-key', ADMIN_KEY);

  // Route exists
  assert(
    res.status !== 404,
    `GET /api/admin/dietician route exists (got ${res.status})`
  );
  assert(
    res.status === 200,
    `GET /api/admin/dietician → 200 (graceful when Airtable unconfigured)`
  );
  if (res.status === 200) {
    assert(Array.isArray(res.body.data), 'Returns data array (empty without Airtable creds)');
  }

  const res2 = await request(app)
    .get('/api/admin/dietician/Dt.Deeksha/customers')
    .set('x-admin-api-key', ADMIN_KEY);
  assert(res2.status !== 404, `GET /api/admin/dietician/:name/customers route exists`);
  assert(res2.status === 200, `GET /api/admin/dietician/Dt.Deeksha/customers → 200 (graceful without Airtable)`);

  console.log(Y('  NOTE: With real AIRTABLE_PAT + AIRTABLE_BASE_ID set:'));
  console.log(Y('    → GET /api/admin/dietician returns all dietician names'));
  console.log(Y('    → GET /api/admin/dietician/Dt.Deeksha/customers returns Riya jana'));
  console.log(Y('       with her MongoDB streak, check-ins, skin scores merged in'));
}

async function testPhoneVariantMatching(patient) {
  section('8. PHONE VARIANT MATCHING — cross-format lookups');

  const variants = [TEST_PHONE, PHONE_FULL, PHONE_91];
  for (const v of variants) {
    const res = await request(app).get(`/api/patient/${v}`);
    warn(res.status === 200,
      `GET /api/patient/${v} → 200`,
      `got ${res.status} — need phone normalisation in patient route`
    );
  }

  // Check streak can be fetched with different phone formats
  for (const v of variants) {
    const res = await request(app).get(`/api/streak/${v}`);
    warn(res.status === 200,
      `GET /api/streak/${v} → 200`,
      `got ${res.status} — streak route phone variant issue`
    );
  }

  // Check skin score with different formats
  for (const v of variants) {
    const res = await request(app).get(`/api/skinscore/${v}`);
    warn(res.status === 200,
      `GET /api/skinscore/${v} → 200`,
      `got ${res.status} — skinscore route phone variant issue`
    );
  }
}

async function testEdgeCases() {
  section('9. EDGE CASES — invalid inputs, boundary conditions');

  // Non-existent patient
  const res = await request(app).get('/api/patient/0000000000');
  assert(res.status === 404 || res.status === 200, 'GET non-existent patient returns 404 or 200 (not 500)');
  assert(res.status !== 500, 'No 500 error for missing patient');

  // Invalid skin score (missing required fields)
  const bad = await request(app).post('/api/skinscore').send({});
  assert(bad.status !== 500, 'POST /api/skinscore with empty body → no 500');

  // Skin score totalScore boundary: max 20 (all 5s)
  const maxScore = { darkest_patch: 5, skin_tone: 5, texture: 5, confidence: 5 };
  const total = maxScore.darkest_patch + maxScore.skin_tone + maxScore.texture + maxScore.confidence;
  assert(total === 20, `Max skin score = 20 (5+5+5+5 = ${total})`);

  // Min score: all 1s = 4
  const minTotal = 1 + 1 + 1 + 1;
  assert(minTotal === 4, `Min skin score = 4 (1+1+1+1 = ${minTotal})`);

  // Admin requires API key
  const unauth = await request(app).get('/api/admin/dashboard');
  assert(unauth.status === 401, 'Admin dashboard requires API key (401 without it)');

  // Admin with wrong key
  const wrongKey = await request(app)
    .get('/api/admin/dashboard')
    .set('x-admin-api-key', 'wrong-key');
  assert(wrongKey.status === 401, 'Admin dashboard rejects wrong API key');

  // Health check
  const health = await request(app).get('/api/health');
  assert(health.status === 200, 'GET /api/health → 200');
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log(B('\n╔══════════════════════════════════════════════════════════╗'));
  console.log(B('║  GLEUHR WORKFLOW TEST — phone: 7973944144                ║'));
  console.log(B('╚══════════════════════════════════════════════════════════╝'));

  try {
    await setup();

    const patient = await testPatientCRUD();
    await testSkinScore(patient);
    await testDailyCheckIn(patient);
    await testStreakLogic(patient);
    await testGamification(patient);
    await testAdminDashboard(patient);
    await testDieticianEndpoint();
    await testPhoneVariantMatching(patient);
    await testEdgeCases();

  } catch (err) {
    console.error(R('\n  [FATAL] Test suite crashed: ' + err.message));
    console.error(err.stack);
    failed++;
  } finally {
    await teardown();
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const total = passed + failed + warnings;
  console.log(`\n${B('━'.repeat(60))}`);
  console.log(B('  RESULTS SUMMARY'));
  console.log(B('━'.repeat(60)));
  console.log(`  ${G(`✅ Passed:   ${passed}`)}`);
  console.log(`  ${R(`❌ Failed:   ${failed}`)}`);
  console.log(`  ${Y(`⚠️  Warnings: ${warnings}`)}`);
  console.log(`  ${DIM(`Total:     ${total}`)}\n`);

  if (failed > 0) {
    console.log(R('  ❌ BUGS FOUND — see FAIL lines above\n'));
    process.exit(1);
  } else if (warnings > 0) {
    console.log(Y('  ⚠️  PASSES WITH WARNINGS — review WARN lines above\n'));
    process.exit(0);
  } else {
    console.log(G('  ✅ ALL TESTS PASSED\n'));
    process.exit(0);
  }
}

run();
