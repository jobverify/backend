import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertLiveMongoUriConfigured,
  getZeroJobEvidence,
  isAuthoritativeEmptyScrape,
  MissingMongoUriError,
  resolveLivePublicExperienceEnabled,
  resolveScraperRetryAttempts,
  resolveScraperTimeoutMs,
  resolveSourceLifecycleTimeoutMs,
  ScraperSourceLifecycleTimeoutError,
  runScraperWithTimeout,
  selectScrapersForRun,
  shouldClearExistingJobsBeforeRun,
  withSourceLifecycleTimeout,
} from '../runner.js'
import { buildScrapers } from '../providers/index.js'
import { attachInventoryEvidence } from '../utils/inventoryEvidence.js'

const sampleScrapers = [
  { name: 'alpha' },
  { name: 'danfoss' },
  { name: 'elgi' },
  { name: 'zeta' },
]

test('queued classification pauses the source lifecycle clock and writes resume the remaining clock', async () => {
  const result = await withSourceLifecycleTimeout({ name: 'classification' }, async ({ pauseTimeout, resumeTimeout }) => {
    pauseTimeout();
    await new Promise(resolve => setTimeout(resolve, 70));
    resumeTimeout();
    return 'saved';
  }, 40);
  assert.equal(result, 'saved');
  await assert.rejects(withSourceLifecycleTimeout({ name: 'write-hang' }, async ({ pauseTimeout, resumeTimeout, signal }) => {
    pauseTimeout();
    await new Promise(resolve => setTimeout(resolve, 70));
    resumeTimeout();
    await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
  }, 40), { name: 'ScraperSourceLifecycleTimeoutError' });
});

test('cancellation still interrupts classification while the lifecycle clock is paused', async () => {
  const controller = new AbortController();
  const reason = new Error('cancel model scan');
  const operation = withSourceLifecycleTimeout({ name: 'cancelled' }, async ({ pauseTimeout, signal }) => {
    pauseTimeout();
    await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
  }, 40, { signal: controller.signal });
  setTimeout(() => controller.abort(reason), 15);
  await assert.rejects(operation, reason);
});

test('selectScrapersForRun returns the full catalog when no resume source is set', () => {
  const result = selectScrapersForRun(sampleScrapers, {})

  assert.deepEqual(result.scrapers.map((scraper) => scraper.name), [
    'alpha',
    'danfoss',
    'elgi',
    'zeta',
  ])
  assert.equal(result.resumeMessage, null)
})

test('selectScrapersForRun resumes inclusively from SCRAPER_START_AT', () => {
  const result = selectScrapersForRun(sampleScrapers, { startAt: 'ELGI' })

  assert.deepEqual(result.scrapers.map((scraper) => scraper.name), ['elgi', 'zeta'])
  assert.match(result.resumeMessage, /Resuming at elgi \(2\/4 scrapers selected\)/)
})

test('selectScrapersForRun resumes exclusively after SCRAPER_START_AFTER', () => {
  const result = selectScrapersForRun(sampleScrapers, { startAfter: 'danfoss' })

  assert.deepEqual(result.scrapers.map((scraper) => scraper.name), ['elgi', 'zeta'])
  assert.match(result.resumeMessage, /Resuming at elgi \(2\/4 scrapers selected\)/)
})

test('selectScrapersForRun runs an explicit SCRAPER_ONLY list', () => {
  const result = selectScrapersForRun(sampleScrapers, { onlySources: 'zeta, danfoss, zeta' })

  assert.deepEqual(result.scrapers.map((scraper) => scraper.name), ['zeta', 'danfoss'])
  assert.match(result.resumeMessage, /Running selected sources \(2\/4 scrapers selected\): zeta, danfoss\./)
})

test('selectScrapersForRun rejects ambiguous or missing resume sources', () => {
  assert.throws(
    () => selectScrapersForRun(sampleScrapers, { startAt: 'danfoss', startAfter: 'elgi' }),
    /Use only one/,
  )
  assert.throws(
    () => selectScrapersForRun(sampleScrapers, { startAt: 'missing' }),
    /not found/,
  )
  assert.throws(
    () => selectScrapersForRun(sampleScrapers, { onlySources: 'alpha,missing' }),
    /SCRAPER_ONLY source\(s\) not found/,
  )
  assert.throws(
    () => selectScrapersForRun(sampleScrapers, { onlySources: 'alpha', startAfter: 'danfoss' }),
    /SCRAPER_ONLY by itself/,
  )
})

test('shouldClearExistingJobsBeforeRun clears only a full live run', () => {
  assert.equal(shouldClearExistingJobsBeforeRun({}), true)
  assert.equal(
    shouldClearExistingJobsBeforeRun({ onlySources: 'alpha, zeta' }),
    false,
  )
  assert.equal(shouldClearExistingJobsBeforeRun({ startAt: 'elgi' }), false)
  assert.equal(shouldClearExistingJobsBeforeRun({ startAfter: 'danfoss' }), false)
})

test('assertLiveMongoUriConfigured fails fast for live runs without Mongo credentials', () => {
  assert.throws(
    () => assertLiveMongoUriConfigured({ dryRun: false, value: '' }),
    (error) => {
      assert.ok(error instanceof MissingMongoUriError)
      assert.match(error.message, /MONGO_URI environment variable is required/)
      assert.equal(error.abortPipeline, true)
      return true
    },
  )
  assert.throws(
    () => assertLiveMongoUriConfigured({ dryRun: false, value: '   ' }),
    MissingMongoUriError,
  )
})

test('assertLiveMongoUriConfigured allows dry runs and configured live runs', () => {
  assert.doesNotThrow(() => assertLiveMongoUriConfigured({ dryRun: true, value: '' }))
  assert.doesNotThrow(() => assertLiveMongoUriConfigured({ dryRun: false, value: 'mongodb://localhost/test' }))
})

test('resolveScraperTimeoutMs keeps a bounded default and accepts explicit values', () => {
  assert.equal(resolveScraperTimeoutMs(), 300000)
  assert.equal(resolveScraperTimeoutMs('0'), 0)
  assert.equal(resolveScraperTimeoutMs('45000'), 45000)
  assert.equal(resolveScraperTimeoutMs('not-a-number'), 300000)
  assert.equal(resolveScraperTimeoutMs('-1'), 300000)
})

test('Persistent can finish its paced full inventory before the source deadline', () => {
  const scraper = buildScrapers().find(item => item.name === 'persistent')
  // The current native inventory has 630 roles, nine per listing page. Each
  // role needs a detail and requisition read, plus initial/closing pagination.
  const minimumPacedDuration = (630 * 2 + 70 * 2 - 1) * 1000
  const sourceTimeout = resolveScraperTimeoutMs(null, scraper, null)
  assert.ok(sourceTimeout > minimumPacedDuration,
    `Persistent needs at least ${minimumPacedDuration}ms at its default public request spacing; got ${sourceTimeout}ms`)
  assert.ok(sourceTimeout < resolveSourceLifecycleTimeoutMs(null, scraper),
    'the lifecycle must retain time for persistence after extraction')
})

test('resolveScraperTimeoutMs gives Workday adapters a shorter default budget', () => {
  const workdayScraper = {
    name: 'airbus',
    provider: { adapter: 'workday' },
  }

  assert.equal(resolveScraperTimeoutMs(null, workdayScraper, null), 210000)
  assert.equal(
    resolveScraperTimeoutMs(
      null,
      {
        name: 'cerence',
        provider: { adapter: 'script', atsPlatform: 'workday' },
      },
      null,
    ),
    210000,
  )
  assert.equal(resolveScraperTimeoutMs('45000', workdayScraper, null), 45000)
})

test('resolveScraperTimeoutMs honors provider timeout overrides before falling back to the Workday default', () => {
  const workdayScraper = {
    name: 'cadence',
    provider: {
      adapter: 'workday',
      scraperTimeoutMs: 300000,
    },
  }

  assert.equal(resolveScraperTimeoutMs(null, workdayScraper, null), 300000)
  assert.equal(resolveScraperTimeoutMs(undefined, workdayScraper, '180000'), 300000)
})

test('resolveScraperTimeoutMs uses extended catalog budgets for high-volume Workday sources', () => {
  const scrapersByName = new Map(
    buildScrapers().map((scraper) => [scraper.name, scraper]),
  )

  assert.deepEqual(
    Object.fromEntries(
      [
        'cadence',
        'mastercard',
        'nvidia',
        'northerntrust',
        'nxp',
        'paloalto',
        'salesforce',
        'target',
        'valeo',
        'visa',
      ].map((source) => {
        const scraper = scrapersByName.get(source)
        assert.ok(scraper, `${source} scraper should exist`)
        return [source, resolveScraperTimeoutMs(null, scraper, null)]
      }),
    ),
    {
      cadence: 1200000,
      mastercard: 1200000,
      nvidia: 1200000,
      northerntrust: 1200000,
      nxp: 1200000,
      paloalto: 1200000,
      salesforce: 1200000,
      target: 1200000,
      valeo: 1200000,
      visa: 1200000,
    },
  )
})

test('resolveSourceLifecycleTimeoutMs bounds the full per-source lifecycle by default', () => {
  assert.equal(resolveSourceLifecycleTimeoutMs(null), 1800000)
  assert.equal(resolveSourceLifecycleTimeoutMs('0'), 0)
  assert.equal(resolveSourceLifecycleTimeoutMs('45000'), 45000)
  assert.equal(resolveSourceLifecycleTimeoutMs('not-a-number'), 1800000)
  assert.equal(resolveSourceLifecycleTimeoutMs('-1'), 1800000)
  assert.equal(
    resolveSourceLifecycleTimeoutMs(null, {
      name: 'long-source',
      provider: { sourceLifecycleTimeoutMs: 900000 },
    }),
    900000,
  )
})

test('resolveLivePublicExperienceEnabled honors provider opt-outs for live persistence', () => {
  assert.equal(resolveLivePublicExperienceEnabled(null, ''), true)
  assert.equal(resolveLivePublicExperienceEnabled(null, 'true'), false)
  assert.equal(resolveLivePublicExperienceEnabled({ provider: { enrichPublicExperience: false } }, ''), false)
  assert.equal(resolveLivePublicExperienceEnabled({ provider: { enrichPublicExperience: true } }, 'true'), true)
})

test('retired AMNS provider stays out of the active runner catalog', () => {
  assert.equal(buildScrapers().some((candidate) => candidate.name === 'arcelormittalnipponsteelindia'), false)
})

test('resolveScraperRetryAttempts avoids multiplying the Workday source budget', () => {
  assert.equal(
    resolveScraperRetryAttempts({
      provider: { adapter: 'workday', atsPlatform: 'workday' },
    }),
    1,
  )
  assert.equal(
    resolveScraperRetryAttempts({
      provider: { adapter: 'script', atsPlatform: 'workday' },
    }),
    1,
  )
  assert.equal(
    resolveScraperRetryAttempts({
      provider: { adapter: 'script', atsPlatform: 'custom' },
    }),
    4,
  )
})

test('isAuthoritativeEmptyScrape trusts only valid structured verified-empty evidence', () => {
  const confirmedEmpty = attachInventoryEvidence([], {
    status: 'verified-empty',
    surface: 'https://example.test/jobs',
    firstParty: true,
    listingComplete: true,
    pagesFetched: 1,
    reportedTotal: 0,
    indiaFacetCount: 0,
    verifiedAt: new Date().toISOString(),
    reason: 'validated-test-empty',
  })
  const legacyEmpty = []
  Object.defineProperty(legacyEmpty, Symbol.for('jobverify.workday.authoritative-empty'), { value: true })

  assert.equal(
    isAuthoritativeEmptyScrape(
      { provider: { adapter: 'workday', atsPlatform: 'workday' } },
      [],
    ),
    false,
  )
  assert.equal(
    isAuthoritativeEmptyScrape({ provider: {} }, confirmedEmpty),
    true,
  )
  assert.equal(
    isAuthoritativeEmptyScrape({ provider: { adapter: 'workday' } }, legacyEmpty),
    false,
  )
  assert.equal(
    isAuthoritativeEmptyScrape(
      { provider: { adapter: 'workday', atsPlatform: 'workday' } },
      [{ title: 'Engineer' }],
    ),
    false,
  )
})

test('runScraperWithTimeout rejects hung source runs with the configured source label', async () => {
  await assert.rejects(
    runScraperWithTimeout({
      name: 'hung-source',
      run: () => new Promise(() => {}),
    }, 5, { abortGraceMs: 0 }),
    (error) => {
      assert.match(error.message, /\[hung-source\] timed out after 5ms/)
      assert.equal(error.localTimeout, true)
      assert.equal(error.abortRetries, true)
      assert.equal(error.failureKind, 'runner_timeout')
      return true
    },
  )
})

test('runScraperWithTimeout waits for cooperative abort cleanup before rejecting', async () => {
  let cleanupFinished = false

  await assert.rejects(
    runScraperWithTimeout({
      name: 'cooperative-source',
      run: ({ signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          setTimeout(() => {
            cleanupFinished = true
            reject(signal.reason)
          }, 10)
        }, { once: true })
      }),
    }, 5, { abortGraceMs: 100 }),
    /\[cooperative-source\] timed out after 5ms/,
  )

  assert.equal(cleanupFinished, true)
})

for (const lifecycle of [false, true]) {
  test(`${lifecycle ? 'lifecycle' : 'source'} timeout preserves explicitly fatal abort-cleanup errors`, async () => {
    const fatal = Object.assign(new Error('shared cleanup failed'), { abortPipeline: true })
    const operation = ({ signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(fatal), { once: true })
    })
    await assert.rejects(lifecycle
      ? withSourceLifecycleTimeout({ name: 'fatal-cleanup' }, operation, 5, { abortGraceMs: 50 })
      : runScraperWithTimeout({ name: 'fatal-cleanup', run: operation }, 5, { abortGraceMs: 50 }),
    error => error === fatal)
  })
}

test('runScraperWithTimeout can be disabled for explicitly unbounded local probes', async () => {
  const jobs = await runScraperWithTimeout({
    name: 'instant-source',
    run: async () => [{ title: 'Role' }],
  }, 0)

  assert.deepEqual(jobs, [{ title: 'Role' }])
})

test('getZeroJobEvidence does not treat an ordinary empty array as a verified empty career page', () => {
  const confirmedEmpty = attachInventoryEvidence([], {
    status: 'verified-empty',
    surface: 'https://example.test/jobs',
    firstParty: true,
    listingComplete: true,
    pagesFetched: 1,
    reportedTotal: 0,
    indiaFacetCount: 0,
    verifiedAt: new Date().toISOString(),
    reason: 'validated-test-empty',
  })

  assert.equal(
    getZeroJobEvidence({ provider: { adapter: 'script', atsPlatform: 'custom' } }, [], []),
    'unverified-zero',
  )
  assert.equal(
    getZeroJobEvidence({ provider: { adapter: 'workday', atsPlatform: 'workday' } }, confirmedEmpty, []),
    'verified-empty',
  )
  assert.equal(
    getZeroJobEvidence({ provider: { adapter: 'workday', atsPlatform: 'workday' } }, confirmedEmpty, [{ title: 'Engineer' }]),
    null,
  )
})

test('withSourceLifecycleTimeout aborts hung lifecycle work with the source label', async () => {
  let abortSeen = false

  await assert.rejects(
    withSourceLifecycleTimeout(
      { name: 'hung-lifecycle' },
      ({ signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          abortSeen = true
          reject(signal.reason)
        }, { once: true })
      }),
      5,
      { abortGraceMs: 50 },
    ),
    (error) => {
      assert.ok(error instanceof ScraperSourceLifecycleTimeoutError)
      assert.match(error.message, /\[hung-lifecycle\] lifecycle timed out after 5ms/)
      assert.equal(error.localTimeout, true)
      assert.equal(error.abortRetries, true)
      assert.equal(error.failureKind, 'runner_lifecycle_timeout')
      return true
    },
  )

  assert.equal(abortSeen, true)
})

test('withSourceLifecycleTimeout preserves the timeout outcome when work resolves after abort', async () => {
  let abortSeen = false

  await assert.rejects(
    withSourceLifecycleTimeout(
      { name: 'late-success-lifecycle' },
      ({ signal }) => new Promise((resolve) => {
        signal.addEventListener('abort', () => {
          abortSeen = true
          setTimeout(() => {
            resolve({ success: true, ignoredAbort: true })
          }, 10)
        }, { once: true })
      }),
      5,
      { abortGraceMs: 50 },
    ),
    (error) => {
      assert.ok(error instanceof ScraperSourceLifecycleTimeoutError)
      assert.match(error.message, /\[late-success-lifecycle\] lifecycle timed out after 5ms/)
      assert.equal(error.failureKind, 'runner_lifecycle_timeout')
      return true
    },
  )

  assert.equal(abortSeen, true)
})
