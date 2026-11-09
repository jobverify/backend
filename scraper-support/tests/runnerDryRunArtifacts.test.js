import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { attachInventoryEvidence } from '../utils/inventoryEvidence.js'

const loadDryRunRunner = async () => {
  const originalArgv = [...process.argv]
  process.argv = [...process.argv.filter((arg) => arg !== '--dry-run'), '--dry-run']

  try {
    return await import(`../runner.js?dry-run-artifact-test=${Date.now()}`)
  } finally {
    process.argv = originalArgv
  }
}

test('dry-run progress logs use only ASCII markers', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-dry-run-log-'))
  const dryRunFile = path.join(tempDir, 'jobs.json')
  const runner = await loadDryRunRunner()
  const originalLog = console.log
  const output = []

  console.log = (...args) => output.push(args.join(' '))
  try {
    const result = await runner.runScraper({
      name: 'ascii-log-source',
      provider: { adapter: 'custom' },
      dryRunFile,
      run: async () => attachInventoryEvidence([], { status: 'verified-empty', firstParty: true, listingComplete: true,
        surface: 'https://example.invalid/careers', pagesFetched: 1, reportedTotal: 0, verifiedAt: new Date().toISOString() }),
    })

    assert.equal(result.success, true)
    assert.ok(output.some((line) => line === 'Starting [ascii-log-source]...'))
    assert.ok(output.every((line) => /^[\x00-\x7F]*$/.test(line)))
  } finally {
    console.log = originalLog
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('a failed dry run clears stale jobs.json output instead of leaving old data behind', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-dry-run-'))
  const dryRunFile = path.join(tempDir, 'jobs.json')
  fs.writeFileSync(dryRunFile, '[{"title":"stale job"}]\n', 'utf8')

  const runner = await loadDryRunRunner()
  assert.equal(typeof runner.runScraper, 'function')

  const result = await runner.runScraper({
    name: 'broken-source',
    provider: { adapter: 'workday' },
    dryRunFile,
    run: async () => {
      throw new Error('source drift')
    },
  })

  assert.equal(result.success, false)
  assert.equal(fs.existsSync(dryRunFile), false)

  fs.rmSync(tempDir, { recursive: true, force: true })
})

test('dry-run snapshot options keep public experience enrichment enabled by default', async () => {
  const runner = await loadDryRunRunner()

  assert.equal(typeof runner.buildDryRunSnapshotOptions, 'function')
  assert.equal(typeof runner.resolveDryRunMaxJobsToEnrich, 'function')

  const options = runner.buildDryRunSnapshotOptions()

  assert.equal(options.enrichPublicExperience, true)
  assert.equal(options.experienceEnrichmentConcurrency, 2)
  assert.equal(options.maxJobsToEnrich, null)
})

test('dry-run snapshot options respect provider overrides for public experience enrichment', async () => {
  const runner = await loadDryRunRunner()

  const options = runner.buildDryRunSnapshotOptions({
    scraper: {
      provider: {
        dryRunEnrichPublicExperience: false,
      },
    },
  })

  assert.equal(options.enrichPublicExperience, false)
  assert.equal(options.experienceEnrichmentConcurrency, 2)
  assert.equal(options.maxJobsToEnrich, null)
})

test('dry-run runner reports publishable job counts and rejection totals for summary logs', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-dry-run-filter-metrics-'))
  const dryRunFile = path.join(tempDir, 'jobs.json')
  const runner = await loadDryRunRunner()

  try {
    const result = await runner.runScraper({
      name: 'publishable-metrics-source',
      provider: {
        adapter: 'script',
        dryRunEnrichPublicExperience: false,
      },
      dryRunFile,
      run: async () => [
        {
          title: 'Platform Engineer',
          company: 'Example Corp',
          location: 'Bengaluru, India',
          city: 'Bengaluru',
          link: 'https://careers.jobverify.dev/jobs/platform-engineer',
        },
        {
          title: 'Senior Platform Engineer',
          company: 'Example Corp',
          location: 'Bengaluru, India',
          city: 'Bengaluru',
          link: 'https://careers.jobverify.dev/jobs/senior-platform-engineer',
        },
        {
          title: 'Data Engineer',
          company: 'Example Corp',
          location: 'Hyderabad, India',
          city: 'Hyderabad',
          link: 'not-a-valid-url',
        },
        {
          title: 'QA Engineer',
          company: 'Example Corp',
          location: 'Pune, India',
          city: 'Pune',
          link: 'https://careers.jobverify.dev/jobs/qa-engineer',
          closingDate: '2020-01-01T00:00:00.000Z',
        },
        {
          title: 'Backend Engineer',
          company: 'Example Corp',
          location: 'Chennai, India',
          city: 'Chennai',
          link: 'https://careers.jobverify.dev/jobs/backend-engineer',
          postingDate: '2020-01-01T00:00:00.000Z',
        },
        {
          title: 'Product Designer',
          company: 'Example Corp',
          location: 'Austin, United States',
          city: 'Austin',
          country: 'United States',
          link: 'https://careers.jobverify.dev/jobs/product-designer',
        },
      ],
    })

    assert.equal(result.success, true)
    assert.equal(result.jobs, 5)
    assert.equal(result.eligibleJobs, 2)
    assert.equal(result.filteredNonIndia, 1)
    assert.equal(result.filteredSenior, undefined)
    assert.equal(result.filteredInvalidUrl, 1)
    assert.equal(result.filteredClosed, 1)
    assert.equal(result.filteredOld, 1)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('dry-run runner snapshots recover missing experience from the official public job page', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-dry-run-enrichment-'))
  const dryRunFile = path.join(tempDir, 'jobs.json')
  const runner = await loadDryRunRunner()
  const originalFetch = globalThis.fetch

  globalThis.fetch = async (url) => {
    assert.equal(url, 'https://careers.jobverify.dev/jobs/cloud-engineer')

    return {
      ok: true,
      status: 200,
      headers: {
        get(name) {
          return String(name).toLowerCase() === 'content-type'
            ? 'text/html; charset=utf-8'
            : null
        },
      },
      text: async () => `
        <html>
          <body>
            <h1>Cloud Engineer</h1>
            <section>
              <h2>Job Description</h2>
              <p>Build cloud infrastructure and automation platforms.</p>
              <p>Required Experience: 5</p>
            </section>
          </body>
        </html>
      `,
    }
  }

  try {
    const result = await runner.runScraper({
      name: 'public-experience-source',
      provider: { adapter: 'custom' },
      dryRunFile,
      run: async () => [{
        title: 'Cloud Engineer',
        company: 'Example Corp',
        location: 'Hyderabad, India',
        city: 'Hyderabad',
        link: 'https://careers.jobverify.dev/jobs/cloud-engineer',
        sourceUrl: 'https://careers.jobverify.dev/jobs/cloud-engineer',
        applyUrl: 'https://careers.jobverify.dev/jobs/cloud-engineer',
        experienceRequired: null,
      }],
    })

    assert.equal(result.success, true)

    const snapshot = JSON.parse(fs.readFileSync(dryRunFile, 'utf8'))
    assert.equal(snapshot.length, 1)
    assert.equal(snapshot[0].experienceRequired, '5 years')
  } finally {
    globalThis.fetch = originalFetch
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('dry-run runner skips public-page refetch when the scraper already returns rich experience-backed job text', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-dry-run-rich-source-'))
  const dryRunFile = path.join(tempDir, 'jobs.json')
  const runner = await loadDryRunRunner()
  const originalFetch = globalThis.fetch
  let fetchCount = 0

  globalThis.fetch = async () => {
    fetchCount += 1
    throw new Error('dry-run enrichment should not refetch this source-rich job')
  }

  try {
    const result = await runner.runScraper({
      name: 'rich-source',
      provider: { adapter: 'custom' },
      dryRunFile,
      run: async () => [{
        title: 'Platform Engineer',
        company: 'Example Corp',
        location: 'Bengaluru, India',
        city: 'Bengaluru',
        link: 'https://careers.jobverify.dev/jobs/platform-engineer',
        sourceUrl: 'https://careers.jobverify.dev/jobs/platform-engineer',
        applyUrl: 'https://careers.jobverify.dev/jobs/platform-engineer',
        experienceRequired: '5-8 Years',
        jobDescription: `
          Role Objective: Build and evolve internal platform engineering systems that support order orchestration,
          inventory workflows, and high-availability fulfillment operations across India. Responsibilities include
          designing backend services, maintaining AWS infrastructure, improving Kubernetes-based deployments, driving
          observability, and collaborating with security, data, and product teams to deliver resilient software.
        `,
      }],
    })

    assert.equal(result.success, true)
    assert.equal(fetchCount, 0)

    const snapshot = JSON.parse(fs.readFileSync(dryRunFile, 'utf8'))
    assert.equal(snapshot.length, 1)
    assert.equal(snapshot[0].experienceRequired, '5-8 Years')
    assert.match(snapshot[0].jobDescription || '', /platform engineering systems/i)
  } finally {
    globalThis.fetch = originalFetch
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('dry-run runner enriches every job in large sources by default', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-dry-run-limit-'))
  const dryRunFile = path.join(tempDir, 'jobs.json')
  const runner = await loadDryRunRunner()
  const originalFetch = globalThis.fetch
  let fetchCount = 0

  globalThis.fetch = async (url) => {
    fetchCount += 1

    return {
      ok: true,
      status: 200,
      headers: {
        get(name) {
          return String(name).toLowerCase() === 'content-type'
            ? 'text/html; charset=utf-8'
            : null
        },
      },
      text: async () => `
        <html>
          <body>
            <h1>${String(url).split('/').at(-1)?.replace(/-/g, ' ')}</h1>
            <section>
              <h2>Job Description</h2>
              <p>Build and operate distributed production systems for internal platforms.</p>
              <p>Required Experience: 4</p>
            </section>
          </body>
        </html>
      `,
    }
  }

  try {
    const result = await runner.runScraper({
      name: 'large-public-experience-source',
      provider: { adapter: 'custom' },
      dryRunFile,
      run: async () => Array.from({ length: 25 }, (_, index) => ({
        title: `Platform Engineer ${index + 1}`,
        company: 'Example Corp',
        location: 'Bengaluru, India',
        city: 'Bengaluru',
        link: `https://careers.jobverify.dev/jobs/platform-engineer-${index + 1}`,
        sourceUrl: `https://careers.jobverify.dev/jobs/platform-engineer-${index + 1}`,
        applyUrl: `https://careers.jobverify.dev/jobs/platform-engineer-${index + 1}`,
        experienceRequired: null,
      })),
    })

    assert.equal(result.success, true)
    assert.equal(fetchCount, 25)

    const snapshot = JSON.parse(fs.readFileSync(dryRunFile, 'utf8'))
    assert.equal(snapshot.length, 25)
    assert.equal(snapshot[0].experienceRequired, '4 years')
    assert.equal(snapshot[24].experienceRequired, '4 years')
  } finally {
    globalThis.fetch = originalFetch
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('dry-run runner skips public-page refetch when the provider disables enrichment for structured results', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-dry-run-provider-opt-out-'))
  const dryRunFile = path.join(tempDir, 'jobs.json')
  const runner = await loadDryRunRunner()
  const originalFetch = globalThis.fetch
  let fetchCount = 0

  globalThis.fetch = async () => {
    fetchCount += 1
    throw new Error('provider override should skip dry-run public experience refetches')
  }

  try {
    const result = await runner.runScraper({
      name: 'provider-opt-out-source',
      provider: {
        adapter: 'script',
        dryRunEnrichPublicExperience: false,
      },
      dryRunFile,
      run: async () => [{
        title: 'Relationship Manager',
        company: 'Example Corp',
        location: 'Pune, India',
        city: 'Pune',
        link: 'https://careers.jobverify.dev/jobs/relationship-manager',
        sourceUrl: 'https://careers.jobverify.dev/jobs/relationship-manager',
        applyUrl: 'https://careers.jobverify.dev/jobs/relationship-manager',
        experienceRequired: '4-7 years',
      }],
    })

    assert.equal(result.success, true)
    assert.equal(fetchCount, 0)

    const snapshot = JSON.parse(fs.readFileSync(dryRunFile, 'utf8'))
    assert.equal(snapshot.length, 1)
    assert.equal(snapshot[0].experienceRequired, '4-7 years')
  } finally {
    globalThis.fetch = originalFetch
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})


test('dry-run snapshot options forward lifecycle cancellation', async () => {
  const runner = await loadDryRunRunner()
  const controller = new AbortController()
  assert.equal(runner.buildDryRunSnapshotOptions({ signal: controller.signal }).signal, controller.signal)
})
