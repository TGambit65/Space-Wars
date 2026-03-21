const { Op } = require('sequelize');
const { Job } = require('../models');

const handlers = new Map();
const schedules = new Map();

function registerHandler(type, handlerFn) {
  if (!type) {
    throw new Error('Job type is required');
  }

  if (typeof handlerFn !== 'function') {
    throw new Error(`Job handler must be a function for type: ${type}`);
  }

  if (handlers.has(type)) {
    throw new Error(`Job handler already registered for type: ${type}`);
  }

  handlers.set(type, handlerFn);
}

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

/**
 * Process the next eligible job.
 * @returns {Promise<{ processed: boolean, job?: Job }>}
 */
async function processNext() {
  const now = new Date();

  const job = await Job.findOne({
    where: {
      status: 'pending',
      run_at: { [Op.lte]: now }
    },
    order: [['priority', 'DESC'], ['run_at', 'ASC']]
  });

  if (!job) {
    return { processed: false };
  }

  const attemptNumber = job.attempts + 1;
  await job.update({
    status: 'processing',
    started_at: now,
    attempts: attemptNumber
  });

  const handler = handlers.get(job.type);
  if (!handler) {
    await job.update({
      status: 'dead',
      last_error: `No handler registered for type: ${job.type}`,
      completed_at: new Date()
    });
    await job.reload();
    return { processed: true, job };
  }

  try {
    const result = await handler(job.payload);
    await job.update({
      status: 'completed',
      result: result ?? null,
      completed_at: new Date()
    });

    if (job.payload && job.payload._scheduleId && schedules.has(job.payload._scheduleId)) {
      const scheduleId = job.payload._scheduleId;
      const scheduleConfig = schedules.get(scheduleId);
      if (scheduleConfig && scheduleConfig.active) {
        await enqueue(
          scheduleConfig.type,
          {
            ...scheduleConfig.payload,
            _scheduleId: scheduleId
          },
          {
            ...scheduleConfig.opts,
            runAt: scheduleConfig.intervalMs
          }
        );
      }
    }
  } catch (error) {
    const errorMessage = error && error.message ? error.message : String(error);

    if (attemptNumber >= job.max_attempts) {
      await job.update({
        status: 'dead',
        last_error: errorMessage,
        completed_at: new Date()
      });
    } else {
      const backoffMs = Math.pow(5, attemptNumber) * 1000;
      await job.update({
        status: 'pending',
        last_error: errorMessage,
        run_at: new Date(Date.now() + backoffMs)
      });
    }
  }

  await job.reload();
  return { processed: true, job };
}

async function processBatch(limit = 10) {
  let processed = 0;

  for (let i = 0; i < limit; i += 1) {
    const { processed: didProcess } = await processNext();
    if (!didProcess) {
      break;
    }
    processed += 1;
  }

  return processed;
}

/**
 * Register a recurring job.
 * @param {string} scheduleId - Unique ID for this schedule
 * @param {string} type - Job type
 * @param {object} payload
 * @param {number} intervalMs - Repeat interval in ms
 * @param {object} [opts] - Same as enqueue opts
 */
async function schedule(scheduleId, type, payload = {}, intervalMs, opts = {}) {
  schedules.set(scheduleId, {
    type,
    payload,
    intervalMs,
    opts,
    active: true
  });

  return enqueue(type, { ...payload, _scheduleId: scheduleId }, opts);
}

function cancelSchedule(scheduleId) {
  schedules.delete(scheduleId);
}

function getSchedules() {
  return Object.fromEntries(schedules);
}

async function getStats() {
  const [pending, processing, completed, failed, dead] = await Promise.all([
    Job.count({ where: { status: 'pending' } }),
    Job.count({ where: { status: 'processing' } }),
    Job.count({ where: { status: 'completed' } }),
    Job.count({ where: { status: 'failed' } }),
    Job.count({ where: { status: 'dead' } })
  ]);

  return {
    pending,
    processing,
    completed,
    failed,
    dead,
    total: pending + processing + completed + failed + dead
  };
}

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
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const pageLimit = Math.max(1, parseInt(limit, 10) || 50);

  if (status) {
    where.status = status;
  }

  if (type) {
    where.type = type;
  }

  const { count, rows } = await Job.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: pageLimit,
    offset: (pageNumber - 1) * pageLimit
  });

  return {
    jobs: rows,
    total: count,
    page: pageNumber,
    pages: Math.ceil(count / pageLimit)
  };
}

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
