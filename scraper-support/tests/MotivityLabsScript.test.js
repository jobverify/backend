import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T18:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Join the circle of Motivating Innovators</h1>
    <p>Current Roles Available</p>
    <a href="/job-openings/">View More Button</a>
    <p>Send your CV to careers@motivitylabs.com</p>
  </body>
</html>
`

const listingsPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <a href="https://motivitylabs.com/jobs/sr-test-engineer/" class="awsm-job-item">
      <h2 class="awsm-job-post-title">Sr.Test Engineer</h2>
      <div class="awsm-job-specification-wrapper">
        <div class="awsm-job-specification-item awsm-job-specification-job-category">
          <span class="awsm-job-specification-term">5+ Years</span>
        </div>
        <div class="awsm-job-specification-item awsm-job-specification-job-location">
          <span class="awsm-job-specification-term">Hyderabad</span>
        </div>
      </div>
      <div class="awsm-job-more-container"><span class="awsm-job-more">More Details</span></div>
    </a>
    <a href="https://motivitylabs.com/jobs/senior-ai-ml-gen-ai-engineer/" class="awsm-job-item">
      <h2 class="awsm-job-post-title">Senior AI/ML &amp; Gen AI Engineer</h2>
      <div class="awsm-job-specification-wrapper">
        <div class="awsm-job-specification-item awsm-job-specification-job-category">
          <span class="awsm-job-specification-term">8+ years</span>
        </div>
        <div class="awsm-job-specification-item awsm-job-specification-job-location">
          <span class="awsm-job-specification-term">Hyderabad</span>
        </div>
      </div>
      <div class="awsm-job-more-container"><span class="awsm-job-more">More Details</span></div>
    </a>
  </body>
</html>
`

const srTestEngineerDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Sr.Test Engineer</h1>
    <p>Job Description:</p>
    <p>Job Title: Sr.Test Engineer</p>
    <p>Experience Level: 5+ years</p>
    <p>Area Role &amp; Responsibilities</p>
    <p>Should be able to work on Devices &amp; Embedded Software's Validation.</p>
    <p>Required Competencies</p>
    <p>Strong Experience in Manual Testing including Testing Types.</p>
    <p>Strong Experience in Automation Testing with Python Scripting.</p>
    <p>Experience with any one operating system would be an added advantage.</p>
    <p>Please share your references to Talent@motivitylabs.com / referrals@motivitylabs.com</p>
    <p>Experience: 5+ Years</p>
    <p>Job Type: Full Time</p>
    <p>Job Location: Hyderabad</p>
    <p>Apply for this position</p>
  </body>
</html>
`

const aiEngineerDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Senior AI/ML &amp; Gen AI Engineer</h1>
    <p>Job Description:</p>
    <p>Job Title: Senior AI/ML &amp; Gen AI Engineer</p>
    <p>Experience Level: 8+ years</p>
    <p>Area Role &amp; Responsibilities</p>
    <p>Build production-ready AI and ML systems.</p>
    <p>Required Competencies</p>
    <p>LLM application design.</p>
    <p>MLOps and cloud deployment.</p>
    <p>Please share your references to Talent@motivitylabs.com / referrals@motivitylabs.com</p>
    <p>Experience: 8+ Years</p>
    <p>Job Type: Full Time</p>
    <p>Job Location: Hyderabad</p>
    <p>Apply for this position</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/motivitylabs/script.js')
  } catch {
    assert.fail('Expected MotivityLabs scraper module at ../../scraper/motivitylabs/script.js')
  }
}

test('MotivityLabs helpers stay pinned to the verified openings list and same-domain detail pages', async () => {
  const motivity = await loadModule()

  assert.equal(motivity.SOURCE, 'motivitylabs')
  assert.equal(motivity.COMPANY, 'MotivityLabs')
  assert.equal(motivity.OFFICIAL_BRAND_NAME, 'Motivity Labs')
  assert.equal(motivity.CAREERS_URL, 'https://motivitylabs.com/careers/')
  assert.equal(motivity.JOB_OPENINGS_URL, 'https://motivitylabs.com/jobs/')
  assert.equal(motivity.VERIFIED_ON, '2026-10-09')
  assert.equal(motivity.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(motivity.hasJobOpeningsSignal(listingsPageHtml), true)
  assert.deepEqual(motivity.extractJobCards(listingsPageHtml), [
    {
      title: 'Sr.Test Engineer',
      experienceRequired: '5+ Years',
      location: 'Hyderabad',
      detailUrl: 'https://motivitylabs.com/jobs/sr-test-engineer/',
    },
    {
      title: 'Senior AI/ML & Gen AI Engineer',
      experienceRequired: '8+ years',
      location: 'Hyderabad',
      detailUrl: 'https://motivitylabs.com/jobs/senior-ai-ml-gen-ai-engineer/',
    },
  ])
  assert.deepEqual(
    motivity.extractJobDetail(srTestEngineerDetailHtml, {
      title: 'Sr.Test Engineer',
      experienceRequired: '5+ Years',
      location: 'Hyderabad',
      detailUrl: 'https://motivitylabs.com/jobs/sr-test-engineer/',
    }, {
      scrapedAt: FIXED_SCRAPED_AT,
    }),
    {
      title: 'Sr.Test Engineer',
      company: 'MotivityLabs',
      department: null,
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: 'sr-test-engineer',
      requisitionId: 'sr-test-engineer',
      sourceUrl: 'https://motivitylabs.com/jobs/sr-test-engineer/',
      applyUrl: 'https://motivitylabs.com/jobs/sr-test-engineer/',
      employmentType: 'Full Time',
      experienceRequired: '5+ Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Strong Experience in Manual Testing including Testing Types.',
        'Strong Experience in Automation Testing with Python Scripting.',
        'Experience with any one operating system would be an added advantage.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: "Should be able to work on Devices & Embedded Software's Validation.",
      remoteStatus: 'On-site',
      source: 'motivitylabs',
      link: 'https://motivitylabs.com/jobs/sr-test-engineer/',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  )
})

test('MotivityLabs run validates the careers handoff, openings page, and detail pages', async () => {
  const motivity = await loadModule()
  const requestedUrls = []

  const jobs = await motivity.createMotivityLabsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === motivity.CAREERS_URL) return careersPageHtml
      if (url === motivity.JOB_OPENINGS_URL) return listingsPageHtml
      if (url === 'https://motivitylabs.com/jobs/sr-test-engineer/') return srTestEngineerDetailHtml
      if (url === 'https://motivitylabs.com/jobs/senior-ai-ml-gen-ai-engineer/') return aiEngineerDetailHtml

      throw new Error(`Unexpected MotivityLabs URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    motivity.CAREERS_URL,
    motivity.JOB_OPENINGS_URL,
    'https://motivitylabs.com/jobs/sr-test-engineer/',
    'https://motivitylabs.com/jobs/senior-ai-ml-gen-ai-engineer/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Sr.Test Engineer')
  assert.equal(jobs[1].title, 'Senior AI/ML & Gen AI Engineer')
})

test('MotivityLabs fails closed when the verified openings surface drifts', async () => {
  const motivity = await loadModule()

  await assert.rejects(
    motivity.createMotivityLabsScraper().run({
      fetchText: async (url) => {
        if (url === motivity.CAREERS_URL) return careersPageHtml
        if (url === motivity.JOB_OPENINGS_URL) return '<html><body><h1>Jobs</h1></body></html>'
        throw new Error(`Unexpected MotivityLabs URL: ${url}`)
      },
    }),
    /verified Motivity Labs job openings page/i,
  )
})

test('MotivityLabs parses current first-party collection and confirmed India detail JSON-LD', async () => {
  const motivity = await loadModule()
  const newCareers = '<title>Careers · Motivity Labs</title><a href="/jobs/">Explore open roles</a>'
  const listing = `<title>Careers — Open Roles · Motivity Labs</title><script type="application/ld+json">${JSON.stringify({
    '@type': 'CollectionPage', hasPart: [
      { '@type': 'JobPosting', title: 'Engineer', url: 'https://motivitylabs.com/jobs/engineer/' },
      { '@type': 'JobPosting', title: 'Designer', url: 'https://motivitylabs.com/jobs/designer/' },
    ],
  })}</script>`
  const detail = (title, country) => `<title>${title} · Motivity Labs</title><script type="application/ld+json">${JSON.stringify({
    '@type': 'JobPosting', title, url: `https://motivitylabs.com/jobs/${title.toLowerCase()}/`,
    description: 'Build and support client software.', datePosted: '2025-04-02',
    applicantLocationRequirements: country ? { name: country } : undefined,
    jobLocation: country ? { address: { addressLocality: 'Hyderabad' } } : undefined,
    directApply: true,
  })}</script>`
  const requested = []
  const jobs = await motivity.createMotivityLabsScraper({ now: () => FIXED_SCRAPED_AT }).run({
    fetchText: async url => {
      requested.push(url)
      if (url === motivity.CAREERS_URL) return newCareers
      if (url === motivity.JOB_OPENINGS_URL) return listing
      if (url.endsWith('/engineer/')) return detail('Engineer', 'India')
      if (url.endsWith('/designer/')) return detail('Designer', null)
      throw new Error(`Unexpected URL: ${url}`)
    },
  })
  assert.equal(requested.length, 4)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Engineer')
  assert.equal(jobs[0].location, 'Hyderabad, India')
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].sourceUrl, 'https://motivitylabs.com/jobs/engineer/')
})


const loadCurrentMotivityFixtures = async () => {
  const { readFile } = await import('node:fs/promises')
  const fixture = name => readFile(new URL('./fixtures/motivitylabs/' + name, import.meta.url), 'utf8')
  return { careers: await fixture('careers-20261009.html'), listing: await fixture('jobs-20261009.html'),
    reader: await fixture('api-reader-20261009.js'), loader: await fixture('jobs-loader-20261009.js'),
    payload: JSON.parse(await fixture('jobs-api-20261009.json')) }
}
const currentMotivityFetch = (f, { payload = f.payload, reader = f.reader, loader = f.loader, apiError } = {}) => async url => {
  if (url === 'https://motivitylabs.com/careers/') return f.careers
  if (url === 'https://motivitylabs.com/jobs/') return f.listing
  if (url === 'https://ml-websites-backend.onrender.com/api/jobs?includeAll=true') {
    if (apiError) throw apiError
    return JSON.stringify(payload)
  }
  if (url.startsWith('https://motivitylabs.com/_next/static/chunks/')) {
    if (url.endsWith('/3k9--kst9xacu.js')) return reader
    if (url.endsWith('/3jrwa6x5be2js.js')) return loader
    return '/* unrelated public framework chunk */'
  }
  throw new Error('Unexpected URL: ' + url)
}
test('Motivity current loading page resolves the verified public API and preserves unknown geography', async () => {
  const motivity = await loadModule(), f = await loadCurrentMotivityFixtures()
  const jobs = await motivity.createMotivityLabsScraper({ now: () => '2026-10-09T00:00:00.000Z' }).run({ fetchText: currentMotivityFetch(f) })
  assert.equal(jobs.length, 17)
  assert.deepEqual(new Set(jobs.map(j => j.jobId)), new Set(f.payload.data.filter(r => ['Hyderabad', 'India'].includes(r.location)).map(r => r.slug)))
  assert.ok(jobs.every(j => j.country === 'India' && j.sourceListingComplete === false && j.jobDescription.length > 100))
  assert.equal(jobs[0].requisitionId, 'ML026')
  assert.equal(jobs[0].applyUrl, 'https://motivitylabs.com/jobs/technical-solution-architect-experience/')
})
test('Motivity rejects upstream API failures instead of accepting the initial zero count', async () => {
  const motivity = await loadModule(), f = await loadCurrentMotivityFixtures()
  await assert.rejects(motivity.run({ fetchText: currentMotivityFetch(f, { apiError: new Error('HTTP 503') }) }), /HTTP 503/)
})
test('Motivity verifies both first-party API reader and public expiry loader', async () => {
  const motivity = await loadModule(), f = await loadCurrentMotivityFixtures()
  for (const altered of [{ reader: 'fetch("https://untrusted.example/api/jobs")' }, { loader: 'return []' }]) {
    await assert.rejects(motivity.run({ fetchText: currentMotivityFetch(f, altered) }), /public jobs client/i)
  }
})
test('Motivity rejects truncated, duplicate, unpublished and malformed API inventory', async () => {
  const motivity = await loadModule(), f = await loadCurrentMotivityFixtures()
  const row = structuredClone(f.payload.data[0])
  for (const payload of [
    { ...f.payload, count: 27 }, { ...f.payload, hasMore: true },
    { ok: true, count: 2, data: [row, row] },
    { ok: true, count: 1, data: [{ ...row, status: 'draft' }] },
    { ok: true, count: 1, data: [{ ...row, description: '' }] },
    { ok: true, count: 1, data: [{ ...row, expiresOn: '2027-02-30' }] },
    { ok: true, count: 1, data: [{ ...row, experienceMin: -1 }] },
  ]) await assert.rejects(motivity.run({ fetchText: currentMotivityFetch(f, { payload }) }), /inventory|role/i)
})
test('Motivity accepts explicit API zero and filters expiry without inferring India for Remote', async () => {
  const motivity = await loadModule(), f = await loadCurrentMotivityFixtures()
  assert.deepEqual(await motivity.run({ fetchText: currentMotivityFetch(f, { payload: { ok: true, count: 0, data: [] } }) }), [])
  const [a,b,c] = structuredClone(f.payload.data)
  a.location = 'Remote'; b.expiresOn = '2025-01-01'; c.location = 'Hyderabad'
  const jobs = await motivity.createMotivityLabsScraper({ now: () => '2026-10-09T00:00:00Z' }).run({ fetchText: currentMotivityFetch(f, { payload: { ok: true, count: 3, data: [a,b,c] } }) })
  assert.equal(jobs.length, 1); assert.equal(jobs[0].jobId, c.slug); assert.equal(jobs[0].sourceListingComplete, false)
  await assert.rejects(motivity.run({ fetchText: currentMotivityFetch(f, { payload: { ok: true, count: 1, data: [a] } }) }), /geography/i)
})
