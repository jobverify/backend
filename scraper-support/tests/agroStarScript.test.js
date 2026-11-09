import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-14T00:00:00.000Z'

const officialCareersHtml = `
  <html>
    <head>
      <title>Join Us | Build Your Career at AgroStar &amp; Transform Indian Agriculture</title>
      <link rel="canonical" href="https://corporate.agrostar.in/join-us">
    </head>
    <body>
      <h1>Build an institution that feeds the nation, and saves the planet.</h1>
      <h2>The AgroStar Code</h2>
      <h2>We're always looking for great talent</h2>
      <p>If you're ready to make an impact, we'd love to meet you!</p>
      <a href="https://agrostar.darwinbox.in/ms/candidatev2/main/careers/allJobs">View Open Positions</a>
      <h3>Cluster Manager - Saharanpur</h3>
      <a href="https://agrostar.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69f8bd0c30c48?from=all">Apply Now</a>
      <h3>Senior Manager - Crop Protection</h3>
      <a href="https://agrostar.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a681afb8c613ff?from=all">Apply Now</a>
    </body>
  </html>
`

const currentOfficialCareersHtml = `
  <html>
    <head>
      <title>Join Us | Build Your Career at AgroStar &amp; Transform Indian Agriculture</title>
      <link rel="canonical" href="https://corporate.agrostar.in/join-us">
    </head>
    <body>
      <h1>Build an institution that feeds the nation, and saves the planet.</h1>
      <h2>The perks of being an AgStar</h2>
      <p>If you're ready to make an impact, we'd love to meet you!</p>
      <a href="https://agrostar.darwinbox.in/ms/candidatev2/main/careers/allJobs">View Open Positions</a>
      <h3>Cluster Manager - Saharanpur</h3>
      <p>Saharanpur, Uttar Pradesh</p>
      <p>8 - 10 Years</p>
      <a href="https://agrostar.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69f8bd0c30c48?from=all">Cluster Manager - Saharanpur</a>
      <h3>Senior Manager - Crop Protection</h3>
      <p>Pune, Maharashtra, India</p>
      <p>8 - 15 Years</p>
      <a href="https://agrostar.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a681afb8c613ff?from=all">Senior Manager - Crop Protection</a>
    </body>
  </html>
`

const listingPayload = {
  job_counts: 2,
  data: [
    {
      id: 'a69f8bd0c30c48',
      title: 'Cluster Manager - Saharanpur',
      department_name: 'Sales',
      locations: 'Saharanpur, Uttar Pradesh, India',
      country: 'India',
      emp_type_name: 'Full Time',
      experience: '8 - 10 Years',
      posted_on: '14-Jul-2026',
      jd: '<p>Lead the Saharanpur cluster growth plan.</p>',
    },
    {
      id: 'agro-us-001',
      title: 'US Role',
      department_name: 'Sales',
      locations: 'Chicago, Illinois, United States',
      country: 'United States',
      emp_type_name: 'Full Time',
      experience: '8 - 10 Years',
      posted_on: '14-Jul-2026',
      jd: '<p>Ignore non-India role.</p>',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/agrostar/script.js')
  } catch {
    assert.fail('Expected AgroStar scraper module at ../../scraper/agrostar/script.js')
  }
}

test('AgroStar scraper keeps the verified official Darwinbox handoff explicit and fails closed on drift', async () => {
  const {
    COMPANY_NAME,
    DARWINBOX_COMPANY_ID,
    DARWINBOX_ORIGIN,
    OFFICIAL_CAREERS_HANDOFF_URL,
    OFFICIAL_CAREERS_URL,
    PUBLIC_PORTAL_URL,
    SOURCE,
    createAgroStarScraper,
    extractOfficialDarwinboxUrl,
    hasOfficialAgroStarCareersSignals,
  } = await loadModule()

  assert.equal(COMPANY_NAME, 'AgroStar')
  assert.equal(SOURCE, 'agrostar')
  assert.equal(DARWINBOX_COMPANY_ID, 'main')
  assert.equal(DARWINBOX_ORIGIN, 'https://agrostar.darwinbox.in')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://corporate.agrostar.in/join-us')
  assert.equal(
    OFFICIAL_CAREERS_HANDOFF_URL,
    'https://agrostar.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(PUBLIC_PORTAL_URL, OFFICIAL_CAREERS_HANDOFF_URL)
  assert.equal(extractOfficialDarwinboxUrl(officialCareersHtml), OFFICIAL_CAREERS_HANDOFF_URL)
  assert.equal(hasOfficialAgroStarCareersSignals(officialCareersHtml), true)
  assert.equal(hasOfficialAgroStarCareersSignals(currentOfficialCareersHtml), true)
  assert.equal(
    hasOfficialAgroStarCareersSignals(
      officialCareersHtml.replace(OFFICIAL_CAREERS_HANDOFF_URL, 'https://example.com/jobs'),
    ),
    false,
  )

  const scraper = createAgroStarScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async () => officialCareersHtml.replace(
        OFFICIAL_CAREERS_HANDOFF_URL,
        'https://example.com/jobs',
      ),
      fetchListingPage: async () => listingPayload,
    }),
    /verified official careers page no longer matches the verified public surface/i,
  )
})

test('run maps AgroStar Darwinbox listings into Jobverify jobs and keeps only India roles', async () => {
  const { createAgroStarScraper } = await loadModule()
  const scraper = createAgroStarScraper({
    now: () => FIXED_SCRAPED_AT,
  })
  const requestedPages = []

  const jobs = await scraper.run({
    fetchText: async () => officialCareersHtml,
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)
      return listingPayload
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.deepEqual(jobs, [
    {
      title: 'Cluster Manager - Saharanpur',
      company: 'AgroStar',
      department: 'Sales',
      location: 'Saharanpur, Uttar Pradesh, India',
      city: 'Saharanpur',
      jobId: 'a69f8bd0c30c48',
      requisitionId: null,
      sourceUrl: 'https://agrostar.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69f8bd0c30c48',
      applyUrl: 'https://agrostar.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69f8bd0c30c48',
      employmentType: 'Full Time',
      experienceRequired: '8 - 10 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '14-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Lead the Saharanpur cluster growth plan.</p>',
      source: 'agrostar',
      link: 'https://agrostar.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69f8bd0c30c48',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('run seeds the public Darwinbox shell before using the native listings API when no listing page fetcher is injected', async () => {
  const { createAgroStarScraper } = await loadModule()
  const requests = []
  const handoffOnlyCareersHtml = officialCareersHtml
    .replace(/<h3>Cluster Manager - Saharanpur<\/h3>\s*<a[^>]+>Apply Now<\/a>/, '')
    .replace(/<h3>Senior Manager - Crop Protection<\/h3>\s*<a[^>]+>Apply Now<\/a>/, '')
  const scraper = createAgroStarScraper({
    now: () => FIXED_SCRAPED_AT,
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options })

      if ((options.method || 'GET') === 'GET') {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name) => (String(name).toLowerCase() === 'content-type' ? 'text/html' : null),
            getSetCookie: () => [],
          },
          text: async () => '<!doctype html><html><body>AgroStar - </body></html>',
        }
      }

      return {
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json',
          getSetCookie: () => [],
        },
        json: async () => listingPayload,
      }
    },
  })

  const jobs = await scraper.run({
    maxPages: 1,
    fetchText: async () => handoffOnlyCareersHtml,
  })

  assert.equal(jobs.length, 1)
  assert.equal(requests.length, 2)
  assert.equal(
    requests[0].url,
    'https://agrostar.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(requests[0].options.method, 'GET')
  assert.equal(
    requests[1].url,
    'https://agrostar.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(requests[1].options.method, 'POST')
})

test('inline official roles remain partial when their native descriptions are unavailable', async () => {
  const { createAgroStarScraper } = await loadModule()
  const requests = []
  const scraper = createAgroStarScraper({
    now: () => FIXED_SCRAPED_AT,
    fetchImpl: async (url) => {
      requests.push(url)
      throw new Error(`Unexpected Darwinbox API request: ${url}`)
    },
  })

  const jobs = await scraper.run({
    fetchText: async () => currentOfficialCareersHtml,
    fetchJobDetail: async ({ jobId }) => {
      requests.push(jobId)
      throw new Error('Native detail unavailable')
    },
  })

  assert.deepEqual(requests, ['a69f8bd0c30c48', 'a681afb8c613ff'])
  assert.ok(jobs.every(job => job.sourceDetailComplete === false && job.sourceListingComplete === false
    && job.sourceDetailFailureKind === 'upstream'))
  assert.deepEqual(jobs.map(({ sourceDetailComplete, sourceListingComplete, sourceDetailFailureKind, ...job }) => job), [
    {
      title: 'Cluster Manager - Saharanpur',
      company: 'AgroStar',
      department: null,
      location: 'Saharanpur, Uttar Pradesh',
      city: 'Saharanpur',
      jobId: 'a69f8bd0c30c48',
      requisitionId: null,
      sourceUrl: 'https://agrostar.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69f8bd0c30c48',
      applyUrl: 'https://agrostar.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69f8bd0c30c48',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      publicExperienceChecked: true,
      source: 'agrostar',
      link: 'https://agrostar.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69f8bd0c30c48',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Senior Manager - Crop Protection',
      company: 'AgroStar',
      department: null,
      location: 'Pune, Maharashtra, India',
      city: 'Pune',
      jobId: 'a681afb8c613ff',
      requisitionId: null,
      sourceUrl: 'https://agrostar.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a681afb8c613ff',
      applyUrl: 'https://agrostar.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a681afb8c613ff',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      publicExperienceChecked: true,
      source: 'agrostar',
      link: 'https://agrostar.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a681afb8c613ff',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

const inlineDetail = (jobId, changes = {}) => {
  const first = jobId === 'a69f8bd0c30c48'
  return { status: 'success', message: { job: [{ id: jobId,
    title: first ? 'Cluster Manager - Saharanpur' : 'Senior Manager - Crop Protection',
    country: 'India', officelocation_show_arr: first ? 'Saharanpur, Uttar Pradesh, India' : 'Pune, Maharashtra, India',
    jd: first ? '<p>Lead the Saharanpur cluster growth plan and support agricultural sales teams.</p>'
      : '<p>Manage crop protection products and work with agricultural research teams.</p>', ...changes,
  }] } }
}

test('inline AgroStar roles fetch validated native descriptions instead of stopping at title-only cards', async () => {
  const { createAgroStarScraper } = await loadModule()
  const { extractionDetailHealth } = await import('../utils/extractionDetailHealth.js')
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  const jobs = await createAgroStarScraper({ now: () => '2026-10-29T14:00:00.000Z' }).run({
    fetchText: async () => currentOfficialCareersHtml,
    fetchJobDetail: async ({ jobId, companyId, signal }) => {
      assert.equal(companyId, 'main')
      assert.ok(signal instanceof AbortSignal)
      return inlineDetail(jobId)
    },
  })
  assert.equal(jobs.length, 2)
  assert.ok(jobs.every(job => job.sourceDetailComplete === true && job.sourceDescription.includes('<p>')))
  assert.ok(jobs.every(job => job.country === 'India'))
  assert.equal(extractionDetailHealth(jobs).missingDescriptions, 0)
  assert.equal(extractionDetailHealth(jobs).complete, false, 'Inline cards do not establish complete native pagination')
  assert.equal(readInventoryEvidence(jobs), null)
  assert.equal(jobs[0].jobId, 'a69f8bd0c30c48')
  assert.equal(jobs[0].sourceUrl, 'https://agrostar.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a69f8bd0c30c48')
})

test('AgroStar native identity and India-location conflicts cannot supply inline role descriptions', async () => {
  const { createAgroStarScraper } = await loadModule()
  const { hasSourceDescription } = await import('../../src/utils/jobSourceContent.js')
  for (const change of [
    { id: 'other-job' }, { title: 'Another role' }, { country: 'US' },
    { officelocation_show_arr: 'Chicago, United States' }, { jd: null },
  ]) {
    const jobs = await createAgroStarScraper({ maxJobs: 1 }).run({
      fetchText: async () => currentOfficialCareersHtml,
      fetchJobDetail: async ({ jobId }) => inlineDetail(jobId, change),
    })
    assert.equal(hasSourceDescription(jobs[0]), false, JSON.stringify(change))
    assert.equal(jobs[0].sourceDetailComplete, false)
  }
})

test('AgroStar keeps inline roles private with zero detail budget and propagates caller cancellation', async () => {
  const { createAgroStarScraper } = await loadModule()
  let calls = 0
  const jobs = await createAgroStarScraper().run({ fetchText: async () => currentOfficialCareersHtml,
    detailEnrichmentBudgetMs: 0, fetchJobDetail: async () => { calls++; return inlineDetail('a69f8bd0c30c48') },
  })
  assert.equal(calls, 0)
  assert.ok(jobs.every(job => job.sourceDetailComplete === false && job.sourceDetailFailureKind === 'budget-exhausted'))
  const controller = new AbortController(), reason = new Error('operator cancelled')
  await assert.rejects(createAgroStarScraper().run({ fetchText: async () => currentOfficialCareersHtml,
    signal: controller.signal, fetchJobDetail: async () => { controller.abort(reason); throw reason },
  }), error => error === reason)
})

test('recovered AgroStar inline descriptions persist as public jobs without claiming a complete listing', { timeout: 60000 }, async t => {
  const [{ default: mongoose }, { MongoMemoryServer }, { fileURLToPath }, { saveToDB }, { applyPublicJobVisibility }] = await Promise.all([
    import('mongoose'), import('mongodb-memory-server'), import('node:url'), import('../utils/saveToDB.js'),
    import('../../src/utils/publicJobVisibility.js'),
  ])
  assert.equal(mongoose.connection.readyState, 0, 'Never reuse an application database')
  const mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' },
    binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../../.cache/mongodb-binaries/', import.meta.url)) } })
  t.after(async () => { await mongoose.disconnect(); await mongo.stop() })
  assert.match(mongo.getUri(), /^mongodb:\/\/127\.0\.0\.1:\d+\//)
  await mongoose.connect(mongo.getUri(), { autoIndex: false, autoCreate: false })
  const now = new Date('2026-10-29T14:00:00.000Z')
  const { createAgroStarScraper } = await loadModule()
  const jobs = await createAgroStarScraper({ now: () => now.toISOString() }).run({
    fetchText: async () => currentOfficialCareersHtml, fetchJobDetail: async ({ jobId }) => inlineDetail(jobId),
  })
  await saveToDB(jobs, 'agrostar', { now, enrichPublicExperience: false, enqueueAlerts: false,
    descriptionRewriteMode: 'off', replaceExisting: false, refreshDatasetSummary: false })
  const visible = await mongoose.connection.db.collection('jobs')
    .find(applyPublicJobVisibility({ source: 'agrostar', status: 'active' }, {}, now)).toArray()
  assert.equal(visible.length, 2)
  assert.ok(visible.every(job => job.sourceDescription && job.sourceDescription.includes('<p>')))
})
