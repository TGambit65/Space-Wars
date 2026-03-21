# GPT 5.4 Sprint: Async Job Queue & Scheduler

> **Working directory:** `server/` (within the Space Wars repo)
> **Runtime:** Node.js 20+, Jest, SQLite in-memory (test), SQLite file (dev)
> **Goal:** Build a general-purpose async job queue with persistent scheduling, replacing scattered `setTimeout`/`setInterval` patterns and enabling future background work (economy ticks, NPC spawning, crafting completion, etc.)

---

## 1. What You're Doing

Build a lightweight, database-backed job queue system that:

1. Stores jobs in a `Job` Sequelize model
2. Provides a `jobQueueService` that enqueues, processes, retries, and cleans up jobs
3. Integrates with the existing tick system as an optional processor
4. Has comprehensive test coverage

**This is pure infrastructure with zero coupling to game logic.** No existing game systems need to be migrated — just build the queue and expose the API. Game systems will integrate with it in future sprints.

---

## 2. Architecture

### Why Not Bull/Agenda/External Queue?

The game runs on SQLite in development and has no Redis dependency. Adding an external queue system would require a new infrastructure dependency. A database-backed queue is sufficient for the current scale (single server, <1000 concurrent users) and can be swapped for Redis-backed later if needed.

### Design Principles

- **Persistent:** Jobs survive server restarts (they're in the database)
- **Reliable:** Failed jobs retry with exponential backoff
- **Observable:** Job status, attempts, errors are queryable
- **Simple:** No worker processes — the main server polls and processes
- **Typed:** Job `type` field maps to registered handler functions

---

## 3. Model: `Job`

Create `server/src/models/Job.js`:

```javascript
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Job = sequelize.define('Job', {
  job_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  type: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Handler key: economy_tick, crafting_complete, npc_spawn, etc.'
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'processing', 'completed', 'failed', 'dead']]
    }
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {}
  },
  result: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Higher = processed first'
  },
  attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  max_attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3
  },
  last_error: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  run_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Earliest time this job can run (for scheduling)'
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'jobs',
  timestamps: false,
  indexes: [
    { fields: ['status', 'run_at', 'priority'], name: 'idx_jobs_pending_queue' },
    { fields: ['type'] },
    { fields: ['status'] },
    { fields: ['created_at'] }
  ]
});

module.exports = Job;
```

### Registration

Add `Job` to `server/src/models/index.js`:
- Import: `const Job = require('./Job');`
- Export in `module.exports`: add `Job`
- No associations needed (jobs are standalone)

---

## 4. Service: `jobQueueService.js`

Create `server/src/services/jobQueueService.js` with these exports:

### `registerHandler(type, handlerFn)`

Registers a handler function for a job type. Handler receives `(payload)` and returns a result object or throws.

```javascript
// Handler registry (in-memory map)
const handlers = new Map();

function registerHandler(type, handlerFn) {
  if (handlers.has(type)) {
    throw new Error(`Job handler already registered for type: ${type}`);
  }
  handlers.set(type, handlerFn);
}
```

### `enqueue(type, payload, opts)`

Creates a job in the database.

```javascript
/**
 * @param {string} type - Job type (must have a registered handler)
 * @param {object} payload - JSON-serializable data for the handler
 * @param {object} [opts]
 * @param {number} [opts.priority=0] - Higher = processed first
 * @param {number} [opts.maxAttempts=3]
 * @param {Date|number} [opts.runAt] - Date or delay in ms from now
 * @returns {Promise<Job>}
 */
async function enqueue(type, payload = {}, opts = {}) {
  const { priority = 0, maxAttempts = 3, runAt } = opts;

  let runAtDate = new Date();
  if (runAt instanceof Date) {
    runAtDate = runAt;
  } else if (typeof runAt === 'number') {
    runAtDate = new Date(Date.now() + runAt);
  }

  return Job.create({
    type,
    payload,
    priority,
    max_attempts: maxAttempts,
    run_at: runAtDate,
    status: 'pending'
  });
}
```

### `processNext()`

Finds the next eligible job, locks it, runs the handler, updates status.

```javascript
/**
 * Process the next eligible job.
 * @returns {Promise<{ processed: boolean, job?: Job }>}
 */
async function processNext() {
  const now = new Date();

  // Find next eligible job (pending, run_at <= now, ordered by priority desc, run_at asc)
  const job = await Job.findOne({
    where: {
      status: 'pending',
      run_at: { [Op.lte]: now }
    },
    order: [['priority', 'DESC'], ['run_at', 'ASC']]
  });

  if (!job) return { processed: false };

  // Lock it
  await job.update({ status: 'processing', started_at: now, attempts: job.attempts + 1 });

  const handler = handlers.get(job.type);
  if (!handler) {
    await job.update({
      status: 'dead',
      last_error: `No handler registered for type: ${job.type}`,
      completed_at: new Date()
    });
    return { processed: true, job };
  }

  try {
    const result = await handler(job.payload);
    await job.update({
      status: 'completed',
      result: result || null,
      completed_at: new Date()
    });
  } catch (error) {
    if (job.attempts >= job.max_attempts) {
      await job.update({
        status: 'dead',
        last_error: error.message,
        completed_at: new Date()
      });
    } else {
      // Exponential backoff: 5s, 25s, 125s...
      const backoffMs = Math.pow(5, job.attempts) * 1000;
      await job.update({
        status: 'pending',
        last_error: error.message,
        run_at: new Date(Date.now() + backoffMs)
      });
    }
  }

  return { processed: true, job };
}
```

### `processBatch(limit)`

Processes up to `limit` jobs in sequence. Returns count processed.

```javascript
async function processBatch(limit = 10) {
  let processed = 0;
  for (let i = 0; i < limit; i++) {
    const { processed: didProcess } = await processNext();
    if (!didProcess) break;
    processed++;
  }
  return processed;
}
```

### `schedule(type, payload, intervalMs, opts)`

Creates a recurring job pattern. After a job of this type completes, automatically enqueues the next one.

```javascript
// Tracked schedules (in-memory)
const schedules = new Map();

/**
 * Register a recurring job.
 * @param {string} scheduleId - Unique ID for this schedule
 * @param {string} type - Job type
 * @param {object} payload
 * @param {number} intervalMs - Repeat interval in ms
 * @param {object} [opts] - Same as enqueue opts
 */
async function schedule(scheduleId, type, payload = {}, intervalMs, opts = {}) {
  schedules.set(scheduleId, { type, payload, intervalMs, opts, active: true });

  // Enqueue the first job
  return enqueue(type, { ...payload, _scheduleId: scheduleId }, opts);
}

function cancelSchedule(scheduleId) {
  schedules.delete(scheduleId);
}

function getSchedules() {
  return Object.fromEntries(schedules);
}
```

The `processNext` function should check for `_scheduleId` in completed jobs and re-enqueue:

```javascript
// After successful completion, check for recurring schedule
if (job.payload._scheduleId && schedules.has(job.payload._scheduleId)) {
  const sched = schedules.get(job.payload._scheduleId);
  if (sched.active) {
    await enqueue(sched.type, job.payload, {
      ...sched.opts,
      runAt: sched.intervalMs
    });
  }
}
```

### `getStats()`

Returns queue statistics.

```javascript
async function getStats() {
  const [pending, processing, completed, failed, dead] = await Promise.all([
    Job.count({ where: { status: 'pending' } }),
    Job.count({ where: { status: 'processing' } }),
    Job.count({ where: { status: 'completed' } }),
    Job.count({ where: { status: 'failed' } }),
    Job.count({ where: { status: 'dead' } }),
  ]);
  return { pending, processing, completed, failed, dead, total: pending + processing + completed + failed + dead };
}
```

### `cleanup(olderThanMs)`

Deletes completed/dead jobs older than the given age.

```javascript
async function cleanup(olderThanMs = 24 * 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - olderThanMs);
  const deleted = await Job.destroy({
    where: {
      status: { [Op.in]: ['completed', 'dead'] },
      completed_at: { [Op.lt]: cutoff }
    }
  });
  return deleted;
}
```

### `getJobs(opts)`

Paginated job listing with filters.

```javascript
/**
 * @param {object} opts
 * @param {string} [opts.status] - Filter by status
 * @param {string} [opts.type] - Filter by type
 * @param {number} [opts.page=1]
 * @param {number} [opts.limit=50]
 * @returns {Promise<{ jobs, total, page, pages }>}
 */
async function getJobs(opts = {}) {
  const { status, type, page = 1, limit = 50 } = opts;
  const where = {};
  if (status) where.status = status;
  if (type) where.type = type;

  const { count, rows } = await Job.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset: (page - 1) * limit
  });

  return { jobs: rows, total: count, page, pages: Math.ceil(count / limit) };
}
```

### Full exports

```javascript
module.exports = {
  registerHandler,
  enqueue,
  processNext,
  processBatch,
  schedule,
  cancelSchedule,
  getSchedules,
  getStats,
  cleanup,
  getJobs
};
```

---

## 5. Admin API Endpoints

Add to `server/src/routes/adminRoutes.js` (existing file — append to existing routes):

```javascript
// Job Queue admin endpoints
router.get('/admin/jobs/stats', adminController.getJobStats);
router.get('/admin/jobs', adminController.getJobs);
router.post('/admin/jobs/cleanup', adminController.cleanupJobs);
router.post('/admin/jobs/:jobId/retry', adminController.retryJob);
```

Add handlers in `server/src/controllers/adminController.js`:

```javascript
const jobQueueService = require('../services/jobQueueService');

async function getJobStats(req, res) {
  try {
    const stats = await jobQueueService.getStats();
    const schedules = jobQueueService.getSchedules();
    res.json({ success: true, data: { stats, schedules } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getJobs(req, res) {
  try {
    const { status, type, page, limit } = req.query;
    const data = await jobQueueService.getJobs({
      status, type,
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 50, 200)
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function cleanupJobs(req, res) {
  try {
    const { older_than_hours } = req.body;
    const ms = (parseInt(older_than_hours) || 24) * 60 * 60 * 1000;
    const deleted = await jobQueueService.cleanup(ms);
    res.json({ success: true, data: { deleted } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function retryJob(req, res) {
  try {
    const { Job } = require('../models');
    const job = await Job.findByPk(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (job.status !== 'dead' && job.status !== 'failed') {
      return res.status(400).json({ success: false, message: 'Only dead/failed jobs can be retried' });
    }
    await job.update({ status: 'pending', run_at: new Date(), attempts: 0, last_error: null });
    res.json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
```

---

## 6. Test Files to Create

### `server/tests/services/jobQueueService.test.js` (~300-400 lines)

Test every exported function:

**registerHandler:**
- Registers a handler for a type
- Throws on duplicate registration

**enqueue:**
- Creates a pending job with default values
- Respects priority, maxAttempts, runAt (Date)
- Respects runAt (ms delay)

**processNext:**
- Processes a pending job and marks completed
- Calls the correct handler with the payload
- Returns `{ processed: false }` when queue is empty
- Marks job as dead when no handler registered
- Retries with exponential backoff on handler error
- Marks job as dead after max_attempts exhausted
- Stores error message in last_error
- Processes highest priority first
- Respects run_at scheduling (doesn't process future jobs)
- Re-enqueues scheduled jobs after completion

**processBatch:**
- Processes multiple jobs up to limit
- Stops when queue is empty

**schedule / cancelSchedule:**
- Creates initial job
- After processing, a new job is enqueued with delay
- Cancelling stops re-enqueue

**getStats:**
- Returns correct counts for each status

**cleanup:**
- Deletes completed/dead jobs older than threshold
- Does not delete pending/processing jobs
- Does not delete recent completed jobs

**getJobs:**
- Returns paginated results
- Filters by status
- Filters by type

### Test helpers

Add to `server/tests/helpers.js`:

```javascript
async function createTestJob(overrides = {}) {
  const { Job } = require('../src/models');
  return Job.create({
    type: 'test_job',
    payload: { test: true },
    status: 'pending',
    priority: 0,
    max_attempts: 3,
    run_at: new Date(),
    ...overrides
  });
}
```

Add `Job` to the `cleanDatabase()` function's truncation list.

---

## 7. Verification

```bash
cd server
npx jest --forceExit                                    # All tests pass (including new ones)
npx jest -- tests/services/jobQueueService.test.js      # Job queue tests pass alone
```

---

## 8. Important Notes

- **Do NOT modify any existing game services** — this is new infrastructure only
- **Do NOT add Redis or any external dependency** — use SQLite/Sequelize only
- The `Op` import is needed from Sequelize: `const { Op } = require('sequelize');`
- The queue uses optimistic locking (no row-level locks). With `maxWorkers: 1` in tests and single-process in dev, this is fine
- All jobs use UUID primary keys like every other model in this codebase
- Follow existing patterns: CommonJS, `tableName` explicit, `timestamps: false` with manual `created_at`
- The `_scheduleId` pattern in payload is intentional — keeps scheduling metadata alongside job data without a separate table
- Test database is in-memory SQLite — the Job model will be auto-synced by `tests/setup.js`

---

## 9. Quick Reference: Key File Paths

```
server/
├── src/
│   ├── models/
│   │   ├── Job.js                          # NEW — create this
│   │   └── index.js                        # MODIFY — add Job import + export
│   ├── services/
│   │   └── jobQueueService.js              # NEW — create this
│   ├── controllers/
│   │   └── adminController.js              # MODIFY — add 4 new handlers
│   └── routes/
│       └── adminRoutes.js                  # MODIFY — add 4 new routes
└── tests/
    ├── helpers.js                          # MODIFY — add createTestJob, add Job to cleanDatabase
    └── services/
        └── jobQueueService.test.js         # NEW — create this
```
