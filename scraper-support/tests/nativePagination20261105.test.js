import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { classifyScraperError } from '../utils/failureClassification.js'
import { withRetry } from '../utils/retry.js'

const names = ['ey', 'google', 'amazon', 'capgemini', 'deloitte', 'schneiderelectric']
const sizes = { ey: 25, google: 20, amazon: 10, capgemini: 10, deloitte: 10, schneiderelectric: 10 }

// Synthetic native response contracts; these are regression fixtures, not live vacancies.
const fixture = (name, url, { repeat = false } = {}) => {
  const parsed = new URL(url)
  const size = sizes[name]
  const page = name === 'ey' ? Number(parsed.searchParams.get('startrow') || 0) / size + 1
    : name === 'amazon' ? Number(parsed.searchParams.get('offset') || 0) / size + 1
      : name === 'deloitte' ? Number(parsed.searchParams.get('jobOffset') || 0) / size + 1
        : Number(parsed.searchParams.get('page') || 1)
  const isDetail = name === 'ey' ? parsed.pathname.includes('/job/')
    : name === 'deloitte' ? parsed.pathname.includes('/JobDetail/')
      : name === 'amazon' ? parsed.pathname.includes('/jobs/') : false
  if (isDetail) return '<html><span itemprop="description">Fixture full description.</span></html>'
  const ids = Array.from({ length: size }, (_, i) => String(100000 + ((repeat ? 1 : page) - 1) * size + i))
  if (name === 'amazon') return { hits: size * 12, jobs: ids.map(id => ({
    id, id_icims: id, title: `Fixture ${id}`, country_code: 'IND', normalized_location: 'Bengaluru, IND',
    job_path: `/en/jobs/${id}/fixture`, url_next_step: `https://account.amazon.com/jobs/${id}/apply`,
    description: 'Fixture description', posted_date: '2020-01-01',
  })) }
  if (name === 'capgemini') return { count: size * 12, data: ids.map(id => ({
    id, title: `Fixture ${id}`, country_code: 'en-in', location: 'Bengaluru, India',
    apply_job_url: `https://careers.capgemini.com/job/${id}`, description: 'Fixture description',
  })) }
  if (name === 'schneiderelectric') return { totalCount: size * 12, jobs: ids.map(id => ({ data: {
    req_id: id, title: `Fixture ${id}`, country: 'India', city: 'Bengaluru', description: 'Fixture description',
  } })) }
  if (name === 'ey') return `<span class="paginationLabel">${(page - 1) * size + 1} to ${page * size} of ${size * 12}</span>
    <span class="srHelp">Page ${page} of 12</span>${ids.map(id => `<tr class="data-row"><a class="jobTitle-link" href="/job/Fixture/${id}/">Fixture ${id}</a><span class="jobLocation">Bengaluru, India</span></tr>`).join('')}`
  if (name === 'deloitte') return ids.map(id => `<article class="article--result"><h3><a href="/en_US/careersUSI/JobDetail/Fixture/${id}">Fixture ${id}</a></h3><span>Consulting</span><span>Deloitte</span><span>Bengaluru, India</span></article>`).join('')
    + (page < 12 ? `<a class="paginationNextLink" href="?jobRecordsPerPage=10&amp;jobOffset=${page * size}">Next</a>` : '')
  return `<ul class="spHGqe">${ids.map(id => `<li><h3 class="QJPWVe">Fixture ${id}</h3><span class="r0wTof">Bengaluru, India</span><a href="jobs/results/${id}-fixture"></a></li>`).join('')}</ul>`
    + (page < 12 ? `<a aria-label="Go to next page" href="https://www.google.com/about/careers/applications/jobs/results?location=India&amp;page=${page + 1}"></a>` : '')
}

const withFixture = async (name, callback, options = {}) => {
  const module = await import(`../../scraper/${name}/script.js`)
  const requests = []
  const read = async (url) => { requests.push(String(url)); return fixture(name, String(url), options) }
  const previous = globalThis.fetch
  // Also covers exported runners which used to discard injected options, without any network.
  globalThis.fetch = async url => {
    const value = await read(url)
    return new Response(typeof value === 'string' ? value : JSON.stringify(value), { status: 200 })
  }
  try { return await callback(module, { fetchJson: read, fetchText: read, fetchListingsText: read, detailEnrichmentBudgetMs: 0 }, requests) }
  finally { globalThis.fetch = previous }
}

for (const name of names) {
  test(`${name} exported default traverses twelve native pages without inherited DOM cap`, async () => {
    await withFixture(name, async (module, options) => {
      const jobs = await module.run(options)
      assert.equal(jobs.length, sizes[name] * 12)
      assert.equal(new Set(jobs.map(job => job.jobId)).size, jobs.length)
      const evidence = readInventoryEvidence(jobs)
      assert.equal(evidence?.pagesFetched, 12)
      assert.equal(evidence?.listingComplete, false, 'pagination alone cannot establish company scope')
      assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
      assert.equal(jobs[Symbol.for('jobverify.native-pagination-evidence')]?.collectionBudgetMs, 240000)
    })
  })
  for (const [limit, value, expected] of [['maxPages', 2, sizes[name] * 2], ['maxJobs', 3, 3]]) {
    test(`${name} exported runner honors explicit ${limit} and marks incomplete evidence`, async () => {
      await withFixture(name, async (module, options) => {
        const jobs = await module.run({ ...options, [limit]: value })
        assert.equal(jobs.length, expected)
        const evidence = readInventoryEvidence(jobs)
        assert.equal(evidence?.listingComplete, false)
        if (['amazon', 'capgemini', 'ey', 'schneiderelectric'].includes(name)) {
          assert.equal(evidence?.reportedTotal, sizes[name] * 12, 'explicit caps preserve positive native totals')
        }
        assert.match(evidence?.reason || '', /limit/)
        assert.ok(jobs.every(job => job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
      })
    })
  }
  test(`${name} zero caller limits preserve unlimited native collection`, async () => {
    await withFixture(name, async (module, options) => {
      const jobs = await module.run({ ...options, maxPages: 0, maxJobs: 0 })
      assert.equal(jobs.length, sizes[name] * 12)
      assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
      assert.notEqual(readInventoryEvidence(jobs)?.status, 'verified-empty')
    })
  })
  test(`${name} repeated native page stops safely with incomplete evidence`, async () => {
    await withFixture(name, async (module, options, requests) => {
      const jobs = await module.run(options)
      assert.equal(jobs.length, sizes[name])
      assert.match(readInventoryEvidence(jobs)?.reason || '', /progress|repeat/)
      assert.ok(requests.length < sizes[name] * 3 + 3)
    }, { repeat: true })
  })
  test(`${name} preserves caller cancellation identity during injected listing read`, async () => {
    const module = await import(`../../scraper/${name}/script.js`)
    const controller = new AbortController()
    const reason = new Error(`controlled ${name} cancellation`)
    const pending = () => new Promise(() => {})
    const previous = globalThis.fetch
    globalThis.fetch = pending
    let timeout
    try {
      const running = module.run({ fetchJson: pending, fetchText: pending, fetchListingsText: pending, signal: controller.signal })
      controller.abort(reason)
      await assert.rejects(Promise.race([running, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('cancellation timed out')), 150) })]), error => error === reason)
    } finally { clearTimeout(timeout); globalThis.fetch = previous }
  })
}

const thermoFixture = url => {
  const from = Number(new URL(url).searchParams.get('from') || 0)
  return `<script>phApp.ddo = ${JSON.stringify({ eagerLoadRefineSearch: {
    totalHits: 296, hits: 296, data: {
      jobs: Array.from({ length: Math.min(100, 296 - from) }, (_, i) => ({
        jobId: `TF-${from + i}`, reqId: `TF-${from + i}`, title: `Fixture ${from + i}`,
        country: 'India', cityStateCountry: 'Bengaluru, India',
      })), aggregations: [{ field: 'country', value: { India: 296 } }],
    },
  } })}</script>`
}

test('Thermo Fisher default reconciles all296 native roles instead of clamping100', async () => {
  const module = await import('../../scraper/thermofisherscientific/script.js')
  const jobs = await module.run({ fetchText: async url => thermoFixture(url), detailEnrichmentBudgetMs: 0 })
  assert.equal(jobs.length, 296)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 296)
  assert.equal(readInventoryEvidence(jobs)?.pagesFetched, 3)
  assert.ok(jobs.every(job => job.sourceDetailComplete === false), 'listing traversal does not invent full details')
})

for (const limits of [{ maxPages: 1 }, { maxJobs: 150 }]) {
  test(`Thermo Fisher preserves explicit ${JSON.stringify(limits)} as incomplete`, async () => {
    const module = await import('../../scraper/thermofisherscientific/script.js')
    const jobs = await module.run({ ...limits, fetchText: async url => thermoFixture(url), detailEnrichmentBudgetMs: 0 })
    assert.equal(jobs.length, limits.maxJobs || 100)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.ok(jobs.every(job => job.sourceListingComplete === false))
  })
}

test('native pagination ignores inherited DOM limits but preserves source-local and caller precedence', async () => {
  const { loadNativePaginationDefaults, nativePaginationLimits } = await import('../utils/nativePagination.js')
  const directory = mkdtempSync(path.join(tmpdir(), 'jobverify-native-limits-'))
  try {
    assert.deepEqual(nativePaginationLimits({}, loadNativePaginationDefaults(directory)), { maxPages: Infinity, maxJobs: Infinity })
    writeFileSync(path.join(directory, 'config.json'), JSON.stringify({ maxPages: 7, maxJobs: 20 }))
    const defaults = loadNativePaginationDefaults(directory)
    assert.deepEqual(nativePaginationLimits({}, defaults), { maxPages: 7, maxJobs: 20 })
    assert.deepEqual(nativePaginationLimits({ maxPages: 12, maxJobs: 30 }, defaults), { maxPages: 12, maxJobs: 30 })
    assert.deepEqual(nativePaginationLimits({}, { maxPages: 0, maxJobs: 0 }), { maxPages: Infinity, maxJobs: Infinity })
    writeFileSync(path.join(directory, 'config.json'), '{malformed')
    assert.throws(() => loadNativePaginationDefaults(directory), SyntaxError)
    for (const value of [-1, 1.5, NaN, '2']) assert.throws(() => nativePaginationLimits({ maxJobs: value }), /limit/)
  } finally { rmSync(directory, { recursive: true }) }
})

test('native read cancelled before its deferred start makes no request', async () => {
  const { readNativeWithSignal } = await import('../utils/nativePagination.js')
  const controller = new AbortController()
  const reason = new Error('cancel before deferred request')
  let calls = 0
  const running = readNativeWithSignal(() => { calls += 1; return 'unexpected' }, controller.signal)
  controller.abort(reason)
  await assert.rejects(running, error => error === reason)
  assert.equal(calls, 0)
})

for (const name of ['ey', 'google', 'amazon', 'deloitte']) {
  test(`${name} cancellation during detail read retains the original reason`, async () => {
    await withFixture(name, async (module, options) => {
      const controller = new AbortController()
      const reason = new Error(`controlled ${name} detail cancellation`)
      const ordinaryRead = options.fetchText
      const read = async url => {
        const detail = name === 'google' || new URL(url).pathname.includes(name === 'deloitte' ? '/JobDetail/' : '/job/')
          || (name === 'amazon' && new URL(url).pathname.includes('/jobs/'))
        if (!detail) return ordinaryRead(url)
        queueMicrotask(() => controller.abort(reason))
        return new Promise(() => {})
      }
      await assert.rejects(module.run({ ...options, fetchText: read, signal: controller.signal,
        now: name === 'amazon' ? '2020-01-01' : undefined, maxPages: 1, detailEnrichmentBudgetMs: 10000,
      }), error => error === reason)
    })
  })
}

for (const name of ['amazon', 'capgemini', 'schneiderelectric']) {
  for (const malformed of [false, true]) {
    test(`${name} raw foreign-only native page advances to later India role${malformed ? ' with malformed identity gap' : ''}`, async () => {
      await withFixture(name, async (module, options) => {
        const requestedPages = []
        const jobs = await module.run({ ...options, fetchJson: async url => {
          const page = name === 'amazon' ? Number(new URL(url).searchParams.get('offset')) / 10 + 1
            : Number(new URL(url).searchParams.get('page'))
          requestedPages.push(page)
          const payload = fixture(name, url)
          const rows = name === 'capgemini' ? payload.data : payload.jobs
          if (name === 'amazon') payload.hits = 11
          else if (name === 'capgemini') payload.count = 11
          else payload.totalCount = 11
          if (page === 1) {
            for (const row of rows) {
              if (name === 'amazon') row.country_code = 'USA'
              else if (name === 'capgemini') { row.country_code = 'en-us'; row.location = 'Boston, United States' }
              else { row.data.country = 'France'; row.data.city = 'Paris' }
            }
            if (malformed) {
              if (name === 'amazon') rows[0].id_icims = null
              else if (name === 'capgemini') rows[0].id = null
              else rows[0].data.req_id = null
            }
          } else rows.splice(1)
          return payload
        } })
        assert.deepEqual(requestedPages, [1, 2])
        assert.equal(jobs.length, 1)
        assert.equal(jobs[0].jobId, '100010')
        assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 11)
        assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
        const pagination = jobs[Symbol.for('jobverify.native-pagination-evidence')]
        assert.equal(pagination?.observedUnique, malformed ? 10 : 11)
        assert.equal(pagination?.continuationExhausted, true)
        if (malformed) assert.match(readInventoryEvidence(jobs)?.reason || '', /malformed.*identity/)
        else assert.doesNotMatch(readInventoryEvidence(jobs)?.reason || '', /unreconciled|no-progress/)
      })
    })
  }
}

for (const name of ['ey', 'google']) {
  for (const completedPages of [0, 1]) {
    test(`${name} budget flushes completed role from ${completedPages ? 'later' : 'first'} page in listing order without late mutation`, async () => {
      await withFixture(name, async (module, options) => {
        const successfulDetails = completedPages * sizes[name] + 1
        const ordinaryRead = options.fetchText
        let details = 0
        let finishLateRead
        const read = async url => {
          if (name === 'ey' && !new URL(url).pathname.includes('/job/')) return ordinaryRead(url)
          if (++details <= successfulDetails) return '<html>Controlled complete native role.</html>'
          return new Promise(resolve => { finishLateRead = resolve })
        }
        const jobs = await module.run({ ...options, fetchText: read, detailConcurrency: 1,
          collectionBudgetMs: 20, detailEnrichmentBudgetMs: 10000 })
        assert.equal(jobs.length, successfulDetails)
        assert.deepEqual(jobs.map(job => job.jobId), Array.from({ length: successfulDetails }, (_, i) => String(100000 + i)))
        assert.match(readInventoryEvidence(jobs)?.reason || '', /budget/)
        const returned = JSON.stringify(jobs)
        finishLateRead?.('<html>A late reader must not mutate returned jobs.</html>')
        await new Promise(resolve => setImmediate(resolve))
        assert.equal(JSON.stringify(jobs), returned)
      })
    })
  }
}

test('owned empty native budget has explicit coverage classification and aborts retry after one attempt', async () => {
  const module = await import('../../scraper/capgemini/script.js')
  let attempts = 0
  let ownedError
  await assert.rejects(withRetry(async () => {
    attempts += 1
    try { return await module.run({ collectionBudgetMs: 0 }) }
    catch (error) { ownedError = error; throw error }
  }, { attempts: 3, baseDelayMs: 0, label: 'native-budget-controlled' }), error => {
    assert.deepEqual(classifyScraperError(error), { softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap' })
    assert.equal(error.abortRetries, true)
    return true
  })
  assert.equal(attempts, 1)
  assert.equal(ownedError.sourceScopeComplete, false)
  assert.equal(ownedError.lifecycleCleanupAllowed, false)
  assert.equal(ownedError.inventoryEvidence?.status, 'coverage-gap')
  assert.equal(ownedError.inventoryEvidence?.listingComplete, false)
})

test('external native cancellation preserves its identity and classification through retry', async () => {
  const module = await import('../../scraper/capgemini/script.js')
  const controller = new AbortController()
  const reason = new Error('controlled external stop')
  const before = classifyScraperError(reason)
  controller.abort(reason)
  await assert.rejects(withRetry(() => module.run({ signal: controller.signal, collectionBudgetMs: 0 }), {
    attempts: 3, baseDelayMs: 0, signal: controller.signal,
  }), error => error === reason)
  assert.deepEqual(classifyScraperError(reason), before)
  assert.equal(reason.abortRetries, undefined)
})

test('native total changes retain proven jobs with incomplete scope and cleanup forbidden', async () => {
  await withFixture('capgemini', async (module, options) => {
    const jobs = await module.run({ ...options, maxPages: 2, fetchJson: async url => {
      const payload = fixture('capgemini', url)
      if (new URL(url).searchParams.get('page') === '2') payload.count = 130
      return payload
    } })
    assert.equal(jobs.length, 20)
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence?.reportedTotal, 130)
    assert.equal(evidence?.listingComplete, false)
    assert.match(evidence?.reason || '', /native-total-changed/)
    assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false && job.sourceScopeComplete === false))
  })
})

for (const name of names) {
  test(`${name} internal collection budget retains prior positives and aborts its active reader`, async () => {
    await withFixture(name, async (module, options) => {
      let listings = 0
      let requestSignal
      const read = async (url, ...arguments_) => {
        const value = fixture(name, url)
        const detail = typeof value === 'string' && value.startsWith('<html>')
        if (detail) return value
        listings += 1
        if (listings === 1) return value
        requestSignal = arguments_.find(value => value && typeof value === 'object' && value.signal)?.signal
        return new Promise(() => {})
      }
      let timeout
      try {
        const jobs = await Promise.race([
          module.run({ ...options, fetchJson: read, fetchText: read, fetchListingsText: read, collectionBudgetMs: 20 }),
          new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('collection budget did not bound reader')), 300) }),
        ])
        assert.equal(jobs.length, sizes[name])
        assert.equal(requestSignal?.aborted, true)
        const evidence = readInventoryEvidence(jobs)
        assert.equal(evidence?.status, 'coverage-gap')
        assert.equal(evidence?.listingComplete, false)
        assert.match(evidence?.reason || '', /budget/)
        assert.ok(jobs.every(job => job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
      } finally { clearTimeout(timeout) }
    })
  })
  test(`${name} internal collection budget before any positive cannot become empty success`, async () => {
    const module = await import(`../../scraper/${name}/script.js`)
    const pending = () => new Promise(() => {})
    let timeout
    try {
      await assert.rejects(Promise.race([
        module.run({ fetchJson: pending, fetchText: pending, fetchListingsText: pending, collectionBudgetMs: 5 }),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('missing owned timeout')), 300) }),
      ]), /native collection budget/i)
    } finally { clearTimeout(timeout) }
  })
  test(`${name} caller abort racing internal collection budget preserves caller reason`, async () => {
    await withFixture(name, async (module, options) => {
      const controller = new AbortController()
      const reason = new Error(`external ${name} abort racing budget`)
      let listings = 0
      const read = async (url, ...arguments_) => {
        const value = fixture(name, url)
        if (typeof value === 'string' && value.startsWith('<html>')) return value
        if (++listings === 1) return value
        const requestSignal = arguments_.find(value => value && typeof value === 'object' && value.signal)?.signal
        requestSignal?.addEventListener('abort', () => controller.abort(reason), { once: true })
        return new Promise(() => {})
      }
      let timeout
      try {
        await assert.rejects(Promise.race([
          module.run({ ...options, fetchJson: read, fetchText: read, fetchListingsText: read,
            signal: controller.signal, collectionBudgetMs: 20 }),
          new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('race timed out')), 300) }),
        ]), error => error === reason)
      } finally { clearTimeout(timeout) }
    })
  })
  test(`${name} unrelated budget-like errors cannot authorize partial success`, async () => {
    await withFixture(name, async (module, options) => {
      let listings = 0
      const read = async url => {
        const value = fixture(name, url)
        if (typeof value === 'string' && value.startsWith('<html>')) return value
        if (++listings === 1) return value
        throw new Error('controlled unowned native collection budget error')
      }
      await assert.rejects(module.run({ ...options, fetchJson: read, fetchText: read, fetchListingsText: read,
        collectionBudgetMs: 1000 }), /controlled unowned native collection budget error/)
    })
  })
}

for (const name of ['ey', 'google', 'amazon', 'deloitte']) {
  test(`${name} budget during later detail retains only the earlier collected batch`, async () => {
    await withFixture(name, async (module, options) => {
      const ordinaryRead = options.fetchText
      let detailCount = 0
      const read = async url => {
        const detail = name === 'google' || new URL(url).pathname.includes(name === 'deloitte' ? '/JobDetail/' : '/job/')
          || (name === 'amazon' && new URL(url).pathname.includes('/jobs/'))
        if (!detail) return ordinaryRead(url)
        detailCount += 1
        if (detailCount <= sizes[name]) return '<html>Fixture detail.</html>'
        return new Promise(() => {})
      }
      let timeout
      try {
        const jobs = await Promise.race([
          module.run({ ...options, fetchText: read, collectionBudgetMs: 20, detailEnrichmentBudgetMs: 10000,
            now: name === 'amazon' ? '2020-01-01' : undefined }),
          new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('detail budget timed out')), 300) }),
        ])
        assert.equal(jobs.length, sizes[name])
        assert.match(readInventoryEvidence(jobs)?.reason || '', /budget/)
        assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
      } finally { clearTimeout(timeout) }
    })
  })
}
