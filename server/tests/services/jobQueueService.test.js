const { cleanDatabase, createTestJob } = require('../helpers');
const jobQueueService = require('../../src/services/jobQueueService');
const { Job } = require('../../src/models');

let uniqueCounter = 0;

const uniqueId = (prefix = 'job') => `${prefix}_${Date.now()}_${uniqueCounter++}`;

const clearSchedules = () => {
  const schedules = jobQueueService.getSchedules();
  Object.keys(schedules).forEach((scheduleId) => jobQueueService.cancelSchedule(scheduleId));
};

describe('jobQueueService', () => {
  beforeEach(async () => {
    await cleanDatabase();
    clearSchedules();
  });

  describe('registerHandler', () => {
    it('registers a handler for a type', async () => {
      const type = uniqueId('register');
      const handler = jest.fn(async (payload) => ({ ok: true, echoed: payload.value }));

      jobQueueService.registerHandler(type, handler);
      const job = await jobQueueService.enqueue(type, { value: 42 });
      await jobQueueService.processNext();

      const stored = await Job.findByPk(job.job_id);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ value: 42 }));
      expect(stored.status).toBe('completed');
      expect(stored.result).toEqual({ ok: true, echoed: 42 });
    });

    it('throws on duplicate registration', () => {
      const type = uniqueId('duplicate');
      const handler = async () => ({ ok: true });

      jobQueueService.registerHandler(type, handler);

      expect(() => jobQueueService.registerHandler(type, handler)).toThrow(
        `Job handler already registered for type: ${type}`
      );
    });
  });

  describe('enqueue', () => {
    it('creates a pending job with default values', async () => {
      const type = uniqueId('enqueue_defaults');
      const job = await jobQueueService.enqueue(type, { foo: 'bar' });

      expect(job.type).toBe(type);
      expect(job.status).toBe('pending');
      expect(job.payload).toEqual({ foo: 'bar' });
      expect(job.priority).toBe(0);
      expect(job.attempts).toBe(0);
      expect(job.max_attempts).toBe(3);
      expect(job.run_at).toBeInstanceOf(Date);
    });

    it('respects priority, maxAttempts, and runAt as a Date', async () => {
      const type = uniqueId('enqueue_date');
      const runAt = new Date(Date.now() + 60_000);
      const job = await jobQueueService.enqueue(type, { delayed: true }, {
        priority: 7,
        maxAttempts: 5,
        runAt
      });

      expect(job.priority).toBe(7);
      expect(job.max_attempts).toBe(5);
      expect(job.run_at.getTime()).toBe(runAt.getTime());
    });

    it('respects runAt when provided as a millisecond delay', async () => {
      const type = uniqueId('enqueue_delay');
      const before = Date.now();
      const job = await jobQueueService.enqueue(type, {}, { runAt: 5_000 });
      const after = Date.now();

      expect(job.run_at.getTime()).toBeGreaterThanOrEqual(before + 4_900);
      expect(job.run_at.getTime()).toBeLessThanOrEqual(after + 5_100);
    });
  });

  describe('processNext', () => {
    it('processes a pending job and marks it completed', async () => {
      const type = uniqueId('process_success');
      const handler = jest.fn(async (payload) => ({ processed: payload.value * 2 }));
      jobQueueService.registerHandler(type, handler);

      const job = await jobQueueService.enqueue(type, { value: 21 });
      const result = await jobQueueService.processNext();
      const stored = await Job.findByPk(job.job_id);

      expect(result.processed).toBe(true);
      expect(result.job.job_id).toBe(job.job_id);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ value: 21 }));
      expect(stored.status).toBe('completed');
      expect(stored.result).toEqual({ processed: 42 });
      expect(stored.attempts).toBe(1);
      expect(stored.started_at).toBeInstanceOf(Date);
      expect(stored.completed_at).toBeInstanceOf(Date);
    });

    it('returns processed false when the queue is empty', async () => {
      await expect(jobQueueService.processNext()).resolves.toEqual({ processed: false });
    });

    it('marks a job as dead when no handler is registered', async () => {
      const type = uniqueId('no_handler');
      const job = await createTestJob({ type });

      const result = await jobQueueService.processNext();
      const stored = await Job.findByPk(job.job_id);

      expect(result.processed).toBe(true);
      expect(stored.status).toBe('dead');
      expect(stored.last_error).toBe(`No handler registered for type: ${type}`);
      expect(stored.completed_at).toBeInstanceOf(Date);
    });

    it('retries with exponential backoff on handler error', async () => {
      const type = uniqueId('retry_backoff');
      jobQueueService.registerHandler(type, async () => {
        throw new Error('boom');
      });

      const before = Date.now();
      const job = await jobQueueService.enqueue(type, { unstable: true });
      await jobQueueService.processNext();
      await job.reload();

      expect(job.status).toBe('pending');
      expect(job.attempts).toBe(1);
      expect(job.last_error).toBe('boom');
      expect(job.run_at.getTime()).toBeGreaterThanOrEqual(before + 4_900);
      expect(job.run_at.getTime()).toBeLessThanOrEqual(before + 8_000);
    });

    it('marks a job as dead after max_attempts are exhausted', async () => {
      const type = uniqueId('retry_dead');
      jobQueueService.registerHandler(type, async () => {
        throw new Error('still failing');
      });

      const job = await createTestJob({
        type,
        attempts: 2,
        max_attempts: 3,
        run_at: new Date(Date.now() - 1_000)
      });

      await jobQueueService.processNext();
      await job.reload();

      expect(job.status).toBe('dead');
      expect(job.attempts).toBe(3);
      expect(job.last_error).toBe('still failing');
      expect(job.completed_at).toBeInstanceOf(Date);
    });

    it('processes the highest priority job first', async () => {
      const type = uniqueId('priority');
      const processed = [];
      jobQueueService.registerHandler(type, async (payload) => {
        processed.push(payload.name);
        return { name: payload.name };
      });

      const lowPriority = await jobQueueService.enqueue(type, { name: 'low' }, { priority: 1 });
      const highPriority = await jobQueueService.enqueue(type, { name: 'high' }, { priority: 10 });

      await jobQueueService.processNext();
      await lowPriority.reload();
      await highPriority.reload();

      expect(processed).toEqual(['high']);
      expect(highPriority.status).toBe('completed');
      expect(lowPriority.status).toBe('pending');
    });

    it('respects run_at scheduling and skips future jobs', async () => {
      const type = uniqueId('future_job');
      const handler = jest.fn(async () => ({ ok: true }));
      jobQueueService.registerHandler(type, handler);

      const job = await jobQueueService.enqueue(type, { future: true }, { runAt: 60_000 });
      const result = await jobQueueService.processNext();
      await job.reload();

      expect(result).toEqual({ processed: false });
      expect(handler).not.toHaveBeenCalled();
      expect(job.status).toBe('pending');
    });

    it('re-enqueues scheduled jobs after completion', async () => {
      const type = uniqueId('scheduled_requeue');
      const scheduleId = uniqueId('schedule');
      jobQueueService.registerHandler(type, async (payload) => ({ handled: payload.kind }));

      await jobQueueService.schedule(scheduleId, type, { kind: 'heartbeat' }, 1_000, { priority: 2 });
      const started = Date.now();
      await jobQueueService.processNext();

      const jobs = await Job.findAll({
        where: { type },
        order: [['created_at', 'ASC']]
      });

      expect(jobs).toHaveLength(2);
      expect(jobs[0].status).toBe('completed');
      expect(jobs[1].status).toBe('pending');
      expect(jobs[1].priority).toBe(2);
      expect(jobs[1].payload).toEqual(expect.objectContaining({
        kind: 'heartbeat',
        _scheduleId: scheduleId
      }));
      expect(jobs[1].run_at.getTime()).toBeGreaterThanOrEqual(started + 900);
    });
  });

  describe('processBatch', () => {
    it('processes multiple jobs up to the provided limit', async () => {
      const type = uniqueId('batch_limit');
      jobQueueService.registerHandler(type, async () => ({ ok: true }));

      await jobQueueService.enqueue(type, { index: 1 });
      await jobQueueService.enqueue(type, { index: 2 });
      await jobQueueService.enqueue(type, { index: 3 });

      const processed = await jobQueueService.processBatch(2);
      const completed = await Job.count({ where: { type, status: 'completed' } });
      const pending = await Job.count({ where: { type, status: 'pending' } });

      expect(processed).toBe(2);
      expect(completed).toBe(2);
      expect(pending).toBe(1);
    });

    it('stops when the queue is empty', async () => {
      const type = uniqueId('batch_empty');
      jobQueueService.registerHandler(type, async () => ({ ok: true }));

      await jobQueueService.enqueue(type, { only: true });
      const processed = await jobQueueService.processBatch(5);

      expect(processed).toBe(1);
    });
  });

  describe('schedule / cancelSchedule', () => {
    it('creates the initial scheduled job', async () => {
      const type = uniqueId('schedule_create');
      const scheduleId = uniqueId('schedule_create_id');

      await jobQueueService.schedule(scheduleId, type, { pulse: true }, 5_000, { priority: 4 });
      const schedules = jobQueueService.getSchedules();
      const jobs = await Job.findAll({ where: { type } });

      expect(schedules[scheduleId]).toEqual(expect.objectContaining({
        type,
        intervalMs: 5_000,
        active: true
      }));
      expect(jobs).toHaveLength(1);
      expect(jobs[0].status).toBe('pending');
      expect(jobs[0].priority).toBe(4);
      expect(jobs[0].payload).toEqual(expect.objectContaining({
        pulse: true,
        _scheduleId: scheduleId
      }));
    });

    it('enqueues the next scheduled job after processing', async () => {
      const type = uniqueId('schedule_followup');
      const scheduleId = uniqueId('schedule_followup_id');
      jobQueueService.registerHandler(type, async () => ({ ok: true }));

      await jobQueueService.schedule(scheduleId, type, { repeat: true }, 500);
      await jobQueueService.processNext();

      const jobs = await Job.findAll({ where: { type } });
      const pendingJobs = jobs.filter((job) => job.status === 'pending');
      const completedJobs = jobs.filter((job) => job.status === 'completed');

      expect(completedJobs).toHaveLength(1);
      expect(pendingJobs).toHaveLength(1);
      expect(pendingJobs[0].payload._scheduleId).toBe(scheduleId);
    });

    it('stops re-enqueueing after a schedule is cancelled', async () => {
      const type = uniqueId('schedule_cancel');
      const scheduleId = uniqueId('schedule_cancel_id');
      jobQueueService.registerHandler(type, async () => ({ ok: true }));

      await jobQueueService.schedule(scheduleId, type, { once: true }, 1_000);
      jobQueueService.cancelSchedule(scheduleId);
      await jobQueueService.processNext();

      const jobs = await Job.findAll({ where: { type } });
      const pendingJobs = jobs.filter((job) => job.status === 'pending');

      expect(jobQueueService.getSchedules()[scheduleId]).toBeUndefined();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].status).toBe('completed');
      expect(pendingJobs).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('returns correct counts for each status', async () => {
      const now = new Date();
      await createTestJob({ type: uniqueId('stats_pending'), status: 'pending', run_at: now });
      await createTestJob({ type: uniqueId('stats_processing'), status: 'processing', run_at: now });
      await createTestJob({ type: uniqueId('stats_completed'), status: 'completed', run_at: now, completed_at: now });
      await createTestJob({ type: uniqueId('stats_failed'), status: 'failed', run_at: now });
      await createTestJob({ type: uniqueId('stats_dead'), status: 'dead', run_at: now, completed_at: now });

      const stats = await jobQueueService.getStats();

      expect(stats).toEqual({
        pending: 1,
        processing: 1,
        completed: 1,
        failed: 1,
        dead: 1,
        total: 5
      });
    });
  });

  describe('cleanup', () => {
    it('deletes completed and dead jobs older than the threshold', async () => {
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await createTestJob({ status: 'completed', completed_at: oldDate, type: uniqueId('cleanup_completed') });
      await createTestJob({ status: 'dead', completed_at: oldDate, type: uniqueId('cleanup_dead') });
      await createTestJob({ status: 'pending', run_at: oldDate, type: uniqueId('cleanup_pending') });

      const deleted = await jobQueueService.cleanup(24 * 60 * 60 * 1000);
      const remainingPending = await Job.count({ where: { status: 'pending' } });
      const remainingTerminal = await Job.count({ where: { status: ['completed', 'dead'] } });

      expect(deleted).toBe(2);
      expect(remainingPending).toBe(1);
      expect(remainingTerminal).toBe(0);
    });

    it('does not delete pending or processing jobs', async () => {
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await createTestJob({ status: 'pending', run_at: oldDate, type: uniqueId('cleanup_keep_pending') });
      await createTestJob({ status: 'processing', started_at: oldDate, type: uniqueId('cleanup_keep_processing') });

      const deleted = await jobQueueService.cleanup(24 * 60 * 60 * 1000);
      const total = await Job.count();

      expect(deleted).toBe(0);
      expect(total).toBe(2);
    });

    it('does not delete recently completed jobs', async () => {
      const recentDate = new Date(Date.now() - 60 * 60 * 1000);
      await createTestJob({ status: 'completed', completed_at: recentDate, type: uniqueId('cleanup_recent') });

      const deleted = await jobQueueService.cleanup(24 * 60 * 60 * 1000);
      const total = await Job.count();

      expect(deleted).toBe(0);
      expect(total).toBe(1);
    });
  });

  describe('getJobs', () => {
    it('returns paginated results', async () => {
      const baseTime = Date.now();
      await createTestJob({ type: uniqueId('page_one'), created_at: new Date(baseTime - 3_000) });
      await createTestJob({ type: uniqueId('page_two'), created_at: new Date(baseTime - 2_000) });
      await createTestJob({ type: uniqueId('page_three'), created_at: new Date(baseTime - 1_000) });

      const result = await jobQueueService.getJobs({ page: 2, limit: 2 });

      expect(result.total).toBe(3);
      expect(result.page).toBe(2);
      expect(result.pages).toBe(2);
      expect(result.jobs).toHaveLength(1);
    });

    it('filters jobs by status', async () => {
      await createTestJob({ status: 'pending', type: uniqueId('status_pending') });
      await createTestJob({ status: 'dead', completed_at: new Date(), type: uniqueId('status_dead') });

      const result = await jobQueueService.getJobs({ status: 'dead' });

      expect(result.total).toBe(1);
      expect(result.jobs[0].status).toBe('dead');
    });

    it('filters jobs by type', async () => {
      const targetType = uniqueId('type_match');
      await createTestJob({ type: targetType });
      await createTestJob({ type: uniqueId('type_other') });

      const result = await jobQueueService.getJobs({ type: targetType });

      expect(result.total).toBe(1);
      expect(result.jobs[0].type).toBe(targetType);
    });
  });
});
