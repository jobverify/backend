import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Seclore | Careers</title>
  </head>
  <body>
    <main>
      <h1>Drive Innovation. Embrace Collaboration. Discover Horizons.</h1>
      <p>Join us to redefine how the world protects data.</p>
      <a href="#open-positions">View Open Positions</a>
      <section id="open-positions">
        <h2>Open Positions</h2>
        <a href="https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a3b812ca916f">Senior Sales Engineer Employee Type: Permanent Department: Presales Location: India</a>
        <a href="https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a354a33e7160">Human Resource Business Partner Employee Type: Permanent Department: People Practices Location: India</a>
        <a href="https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a212138f41d8">Senior Product Engineer Employee Type: Permanent Department: Product Engineering Location: India</a>
        <a href="https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a1ecf3f352d2">Manager - Taxation &amp; Compliance Employee Type: Permanent Department: Finance &amp; Legal Location: India</a>
        <a href="https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6b4beab302cbf">Employer Branding Specialist Employee Type: Permanent Department: People Practices Location: India</a>
        <a href="https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a694ab15b35de8">Senior DevOps Engineer Employee Type: Permanent Department: DevOps Location: India</a>
        <a href="https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/us-only-role">Admin &amp; HR Coordinator Employee Type: Permanent Department: People Practices Location: United States</a>
      </section>
    </main>
  </body>
</html>
`

const DRIFTED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Unexpected</title>
  </head>
  <body>
    <main><p>No verified Seclore careers surface.</p></main>
  </body>
</html>
`

const INVALID_JOB_LINKS_HTML = VERIFIED_CAREERS_HTML.replace(
  'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a212138f41d8',
  'https://example.com/jobs/a6a212138f41d8',
)

const loadSecloreModule = async () => {
  try {
    return await import('../../scraper/seclore/script.js')
  } catch {
    assert.fail('Expected Seclore scraper module at ../../scraper/seclore/script.js')
  }
}

test('Seclore helpers pin the verified first-party careers page and extract India openings from inline Darwinbox links', async () => {
  const seclore = await loadSecloreModule()

  assert.equal(seclore.SOURCE, 'seclore')
  assert.equal(seclore.COMPANY, 'Seclore')
  assert.equal(seclore.HOMEPAGE_URL, 'https://www.seclore.com/')
  assert.equal(seclore.CAREERS_URL, 'https://www.seclore.com/about/careers/')
  assert.equal(
    seclore.PUBLIC_JOB_HOST,
    'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/',
  )
  assert.equal(
    seclore.VERIFIED_SAMPLE_JOB_URL,
    'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a3b812ca916f',
  )
  assert.equal(seclore.VERIFIED_ON, '2026-07-19')
  assert.equal(seclore.hasVerifiedCareersPageSignal(VERIFIED_CAREERS_HTML), true)

  const jobs = seclore.extractIndiaJobsFromCareersPage(VERIFIED_CAREERS_HTML, {
    scrapedAt: '2026-07-17T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Senior Sales Engineer',
      company: 'Seclore',
      location: 'India',
      city: null,
      country: 'India',
      employmentType: 'Permanent',
      department: 'Presales',
      jobId: 'a6a3b812ca916f',
      requisitionId: 'a6a3b812ca916f',
      sourceUrl: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a3b812ca916f',
      applyUrl: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a3b812ca916f',
      link: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a3b812ca916f',
      source: 'seclore',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
    {
      title: 'Human Resource Business Partner',
      company: 'Seclore',
      location: 'India',
      city: null,
      country: 'India',
      employmentType: 'Permanent',
      department: 'People Practices',
      jobId: 'a6a354a33e7160',
      requisitionId: 'a6a354a33e7160',
      sourceUrl: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a354a33e7160',
      applyUrl: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a354a33e7160',
      link: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a354a33e7160',
      source: 'seclore',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
    {
      title: 'Senior Product Engineer',
      company: 'Seclore',
      location: 'India',
      city: null,
      country: 'India',
      employmentType: 'Permanent',
      department: 'Product Engineering',
      jobId: 'a6a212138f41d8',
      requisitionId: 'a6a212138f41d8',
      sourceUrl: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a212138f41d8',
      applyUrl: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a212138f41d8',
      link: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a212138f41d8',
      source: 'seclore',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
    {
      title: 'Manager - Taxation & Compliance',
      company: 'Seclore',
      location: 'India',
      city: null,
      country: 'India',
      employmentType: 'Permanent',
      department: 'Finance & Legal',
      jobId: 'a6a1ecf3f352d2',
      requisitionId: 'a6a1ecf3f352d2',
      sourceUrl: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a1ecf3f352d2',
      applyUrl: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a1ecf3f352d2',
      link: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a1ecf3f352d2',
      source: 'seclore',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
    {
      title: 'Employer Branding Specialist',
      company: 'Seclore',
      location: 'India',
      city: null,
      country: 'India',
      employmentType: 'Permanent',
      department: 'People Practices',
      jobId: 'a6b4beab302cbf',
      requisitionId: 'a6b4beab302cbf',
      sourceUrl: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6b4beab302cbf',
      applyUrl: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6b4beab302cbf',
      link: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6b4beab302cbf',
      source: 'seclore',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
    {
      title: 'Senior DevOps Engineer',
      company: 'Seclore',
      location: 'India',
      city: null,
      country: 'India',
      employmentType: 'Permanent',
      department: 'DevOps',
      jobId: 'a694ab15b35de8',
      requisitionId: 'a694ab15b35de8',
      sourceUrl: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a694ab15b35de8',
      applyUrl: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a694ab15b35de8',
      link: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a694ab15b35de8',
      source: 'seclore',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
  ])
})

test('Seclore run validates the official careers page before returning India roles', async () => {
  const seclore = await loadSecloreModule()
  const requestedUrls = []

  const jobs = await seclore.createSecloreScraper().run({
    detailEnrichmentBudgetMs: 0,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === seclore.CAREERS_URL) return VERIFIED_CAREERS_HTML
      throw new Error(`Unexpected Seclore fixture URL: ${url}`)
    },
    now: () => '2026-07-17T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [seclore.CAREERS_URL])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].source, 'seclore')
})

test('Seclore fails closed when the verified careers shell drifts or the public Darwinbox links stop matching the official contract', async () => {
  const seclore = await loadSecloreModule()

  await assert.rejects(
    seclore.createSecloreScraper().run({
    detailEnrichmentBudgetMs: 0,
      fetchText: async () => DRIFTED_CAREERS_HTML,
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    seclore.createSecloreScraper().run({
    detailEnrichmentBudgetMs: 0,
      fetchText: async () => INVALID_JOB_LINKS_HTML,
    }),
    /darwinbox links/i,
  )
})

// Captured anonymous first-party job API response, 2026-10-29. Removing
// native hydration must fail this source-content regression.
test('Seclore hydrates authoritative native descriptions without granting listing cleanup authority', async () => {
  const { readFileSync } = await import('node:fs')
  const provider = await loadSecloreModule()
  const payload = JSON.parse(readFileSync(new URL('./fixtures/darwinbox/seclore-native-detail.json', import.meta.url), 'utf8'))
  const careersHtml = VERIFIED_CAREERS_HTML
  const jobs = await provider.createSecloreScraper().run({
    fetchText: async () => careersHtml,
    fetchJobDetail: async ({ jobId }) => {
      if (jobId !== 'a6a212138f41d8') throw new Error('Fixture role unavailable')
      return payload
    },
  })
  const hydrated = jobs.find(job => job.jobId === 'a6a212138f41d8')
  assert.equal(hydrated.sourceDetailComplete, true)
  assert.equal(hydrated.sourcePostingDate, '2026-06-03T18:30:00.000Z')
  assert.equal(hydrated.postingDate, '2026-06-03T18:30:00.000Z')
  assert.equal(hydrated.sourceDateEvidence, 'darwinbox-native-posted-on-v1')
  assert.ok(hydrated.sourceDescription.length > 11000)
  assert.equal(hydrated.jobDescription, hydrated.sourceDescription)
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
  assert.ok(jobs.filter(job => job !== hydrated).every(job => job.sourceDetailComplete === false && !job.sourceDescription))

  const empty = structuredClone(payload)
  empty.message.job[0].jd = ''
  const dateOnlyJobs = await provider.createSecloreScraper().run({
    fetchText: async () => careersHtml, fetchJobDetail: async () => empty,
  })
  const dateOnly = dateOnlyJobs.find(job => job.jobId === 'a6a212138f41d8')
  assert.equal(dateOnly.sourceDetailComplete, false)
  assert.equal(dateOnly.postingDate, '2026-06-03T18:30:00.000Z')
  assert.ok(!dateOnly.sourceDescription)

  const mismatch = structuredClone(payload)
  mismatch.message.job[0].title = 'A different employer role'
  const rejected = await provider.createSecloreScraper().run({
    fetchText: async () => careersHtml, fetchJobDetail: async () => mismatch,
  })
  assert.ok(rejected.every(job => job.sourceDetailComplete === false && !job.sourceDescription))
})

test('Seclore cancellation stops before requesting listing or native details', async () => {
  const provider = await loadSecloreModule()
  const controller = new AbortController()
  controller.abort(new Error('Caller cancelled'))
  let requested = false
  await assert.rejects(provider.createSecloreScraper().run({
    signal: controller.signal, fetchText: async () => { requested = true; return VERIFIED_CAREERS_HTML },
    fetchJobDetail: async () => { requested = true },
  }), /Caller cancelled/)
  assert.equal(requested, false)
})
