import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-02T12:00:00.000Z'

const careersHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers at Focus Softnet | Global Job Opportunities</title>
  </head>
  <body>
    <h1>Join Our Global Team</h1>
    <p>Find Your Next Role</p>
    <section>
      <h2>Sales Consultant - CRM/ERP/HCM</h2>
      <p>Multiple Locations</p>
      <p>2-4 years</p>
      <p>Full-time</p>
      <h3>Open Locations</h3>
      <p>Bangalore</p>
      <p>Kolkata</p>
      <p>Vijayawada</p>
      <p>Chennai</p>
      <p>UAE</p>
      <p>Qatar</p>
    </section>
    <section>
      <h2>Social Media Specialist</h2>
      <p>Hyderabad Locations</p>
      <p>2-4 years</p>
      <p>Full-time</p>
      <p>Apply Now</p>
      <h3>Open Locations</h3>
      <p>Hyderabad</p>
    </section>
    <section>
      <h2>Apply for Career</h2>
      <p>Upload Resume *</p>
    </section>
  </body>
</html>
`

const driftedHtml = `
<!doctype html>
<html>
  <head><title>Focus Careers</title></head>
  <body><h1>Hiring</h1></body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/focussoftnet/script.js')
  } catch {
    assert.fail('Expected Focus Softnet scraper module at ../../scraper/focussoftnet/script.js')
  }
}

test('Focus Softnet helpers stay pinned to the verified first-party careers contract', async () => {
  const focusSoftnet = await loadModule()

  assert.equal(focusSoftnet.SOURCE, 'focussoftnet')
  assert.equal(focusSoftnet.COMPANY, 'Focus Softnet')
  assert.equal(focusSoftnet.CAREERS_URL, 'https://www.focussoftnet.com/careers')
  assert.equal(focusSoftnet.VERIFIED_ON, '2026-08-02')
  assert.equal(focusSoftnet.hasVerifiedCareersPageSignal(careersHtml), true)
  assert.deepEqual(focusSoftnet.extractJobListings(careersHtml), [
    {
      title: 'Sales Consultant - CRM/ERP/HCM',
      location: 'Bangalore / Kolkata / Vijayawada / Chennai, India',
      employmentType: 'Full-time',
      experienceRequired: '2-4 years',
      applyUrl: 'https://www.focussoftnet.com/careers#sales-consultant-crm-erp-hcm',
      sourceUrl: 'https://www.focussoftnet.com/careers#sales-consultant-crm-erp-hcm',
    },
    {
      title: 'Social Media Specialist',
      location: 'Hyderabad, India',
      employmentType: 'Full-time',
      experienceRequired: '2-4 years',
      applyUrl: 'https://www.focussoftnet.com/careers#social-media-specialist',
      sourceUrl: 'https://www.focussoftnet.com/careers#social-media-specialist',
    },
  ])
})

test('Focus Softnet run parses the verified careers page into the shared job contract', async () => {
  const focusSoftnet = await loadModule()
  const jobs = await focusSoftnet.createFocusSoftnetScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async () => careersHtml,
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'focussoftnet')
  assert.equal(jobs[0].company, 'Focus Softnet')
  assert.equal(jobs[0].title, 'Sales Consultant - CRM/ERP/HCM')
  assert.equal(jobs[0].location, 'Bangalore / Kolkata / Vijayawada / Chennai, India')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].experienceRequired, '2-4 years')
  assert.equal(jobs[0].jobId, 'sales-consultant-crm-erp-hcm')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].title, 'Social Media Specialist')
  assert.equal(jobs[1].location, 'Hyderabad, India')
})

test('Focus Softnet fails closed when the verified careers contract drifts', async () => {
  const focusSoftnet = await loadModule()

  await assert.rejects(
    focusSoftnet.createFocusSoftnetScraper().run({
      fetchText: async () => driftedHtml,
    }),
    /verified Focus Softnet careers page/i,
  )
})
