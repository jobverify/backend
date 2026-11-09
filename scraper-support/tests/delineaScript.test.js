import assert from 'node:assert/strict'
import test from 'node:test'
import { transport } from '../../scraper/delinea/native.fixtures.js'

globalThis.fetch = async () => { throw new Error('NETWORK_TRIPWIRE: inject Delinea transport before import') }

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head><title>Work at Delinea</title></head>
  <body>
    <main>
      <h1>What makes Delinea different</h1>
      <a href="https://jobs.ashbyhq.com/delinea">Apply Today (EN)</a>
      <h2>We're hiring!</h2>
    </main>
  </body>
</html>
`

const ASHBY_PAYLOAD = {
  jobs: [
    {
      id: 'india-role',
      title: 'Senior Sales Engineer',
      department: 'Sales',
      employmentType: 'FullTime',
      location: 'Home Office (India)',
      secondaryLocations: [],
      publishedAt: '2026-05-27T20:17:33.663+00:00',
      isListed: true,
      isRemote: true,
      workplaceType: 'Hybrid',
      address: { postalAddress: { addressCountry: 'India' } },
      jobUrl: 'https://jobs.ashbyhq.com/delinea/india-role',
      applyUrl: 'https://jobs.ashbyhq.com/delinea/india-role/application',
      descriptionPlain: 'Sell Delinea identity security solutions in India.',
    },
    {
      id: 'non-india-role',
      title: 'Senior Channels Sales Manager',
      department: 'Sales',
      employmentType: 'FullTime',
      location: 'Australia',
      secondaryLocations: [],
      isListed: true,
      jobUrl: 'https://jobs.ashbyhq.com/delinea/non-india-role',
      applyUrl: 'https://jobs.ashbyhq.com/delinea/non-india-role/application',
    },
    {
      id: 'foreign-canonical-city-role',
      title: 'Cloud Engineering Governance',
      department: 'Engineering',
      employmentType: 'FullTime',
      location: 'U.S. Remote',
      secondaryLocations: [],
      isListed: true,
      address: {
        postalAddress: {
          addressLocality: 'Redwood City',
          addressRegion: 'California',
          addressCountry: 'United States',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/delinea/foreign-canonical-city-role',
      applyUrl: 'https://jobs.ashbyhq.com/delinea/foreign-canonical-city-role/application',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/delinea/script.js')
  } catch {
    assert.fail('Expected Delinea scraper module at ../../scraper/delinea/script.js')
  }
}

test('Delinea pins the first-party careers handoff and Ashby API', async () => {
  const delinea = await loadModule()

  assert.equal(delinea.SOURCE, 'delinea')
  assert.equal(delinea.COMPANY, 'Delinea')
  assert.equal(delinea.CAREERS_PAGE_URL, 'https://delinea.com/careers')
  assert.equal(delinea.ASHBY_PUBLIC_BOARD_URL, 'https://jobs.ashbyhq.com/delinea')
  assert.equal(
    delinea.ASHBY_JOB_BOARD_URL,
    'https://api.ashbyhq.com/posting-api/job-board/delinea',
  )
  assert.equal(delinea.hasVerifiedCareersSignal(CAREERS_HTML), true)
})

test('Delinea extracts only listed India jobs from the official Ashby payload', async () => {
  const delinea = await loadModule()
  const jobs = delinea.extractAshbyJobs(ASHBY_PAYLOAD)

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Sales Engineer')
  assert.equal(jobs[0].company, 'Delinea')
  assert.equal(jobs[0].requisitionId, null)
  assert.equal(jobs[0].location, 'Home Office (India)')
  assert.equal(jobs[0].sourceUrl, 'https://jobs.ashbyhq.com/delinea/india-role')
})

test('synthetic Delinea run validates careers, board and all details before closing inventory', async () => {
  const delinea = await loadModule()
  const io = transport()

  const jobs = await delinea.createDelineaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run(io)

  assert.deepEqual(io.calls, [delinea.CAREERS_PAGE_URL, delinea.ASHBY_PUBLIC_BOARD_URL, delinea.ASHBY_JOB_BOARD_URL,
    'https://jobs.ashbyhq.com/delinea/synthetic-india', delinea.ASHBY_PUBLIC_BOARD_URL, delinea.ASHBY_JOB_BOARD_URL, delinea.CAREERS_PAGE_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'delinea')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Delinea fails closed when the verified careers handoff changes', async () => {
  const delinea = await loadModule()

  await assert.rejects(
    delinea.createDelineaScraper().run({
      fetchText: async () => '<html><body>No jobs handoff</body></html>',
      fetchJson: async () => ASHBY_PAYLOAD,
    }),
    /verified delinea careers page changed materially/i,
  )
})
