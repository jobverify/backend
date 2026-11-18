// No setInterval: each event runs a bounded pass. Durable records deduplicate
// ticks; the existing MongoDB leases still protect individual queue entries.
export async function runMaintenance({ tasks, storage, scheduledTime, now = Date.now, budgetMs = 10 * 60_000 }) {
  const started = now();
  const failures = [];
  const completed = [];
  for (const task of tasks) {
    if (now() - started >= budgetMs) throw new Error('Maintenance time budget exhausted; remaining tasks will retry next tick.');
    const slot = Math.floor(scheduledTime / ((task.everyMinutes || 1) * 60_000));
    const key = `maintenance:${task.name}`;
    if ((await storage.get(key)) >= slot) continue;
    try {
      await task.run();
      await storage.put(key, slot);
      completed.push(task.name);
    } catch {
      console.error(JSON.stringify({ event: 'maintenance_failed', task: task.name }));
      failures.push(task.name);
    }
  }
  if (failures.length) throw new Error(`Maintenance tasks failed: ${failures.join(', ')}`);
  return completed;
}

export async function loadMaintenanceTasks() {
  const [outbox, channel, alerts, resumes, pipeline, plans, hiring, scheduler] = await Promise.all([
    import('../../../src/services/jobAlertOutboxService.js'),
    import('../../../src/services/telegramChannelService.js'),
    import('../../../src/services/jobAlertService.js'),
    import('../../../src/services/resumeTailoringService.js'),
    import('../../../src/pipeline/recovery.js'),
    import('../../../src/services/planService.js'),
    import('../../../src/services/hiringObservationService.js'),
    import('../../../src/pipeline/scheduler.js'),
  ]);
  return [
    { name: 'alert-outbox', run: () => outbox.recoverJobAlertOutbox({ limit: 1 }) },
    { name: 'telegram-channel', run: channel.recoverTelegramChannelAlerts },
    { name: 'user-alerts', run: () => alerts.recoverQueuedJobAlerts({ maxDeliveries: 5, deadline: Date.now() + 20_000 }) },
    { name: 'resume-recovery', run: resumes.recoverTailoredResumes },
    { name: 'pipeline-recovery', run: pipeline.reconcileActivePipeline },
    { name: 'scraper-schedule', run: () => scheduler.scraperSchedulerEnabled() ? scheduler.tickScraperSchedule() : undefined },
    { name: 'expired-plans', run: plans.downgradeExpiredPlans, everyMinutes: 60 },
    { name: 'hiring-observation', run: hiring.captureHiringObservation, everyMinutes: 60 },
  ];
}
