import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-07T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>PrimeSoft, Agentic AI &amp; Enterprise Transformation</title>
  </head>
  <body>
    <main>
      <h1>PrimeSoft</h1>
      <p>Agentic AI and enterprise transformation solutions.</p>
      <nav>
        <a href="https://primesoft.darwinbox.in/ms/candidatev2/main/careers/allJobs">Careers</a>
      </nav>
    </main>
  </body>
</html>
`

const loadPrimesoftEnterpriseModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Primesoft Enterprise scraper module at ./script.js')
  }
}

test('Primesoft Enterprise pins the live homepage careers handoff and official Darwinbox board', async () => {
  const primesoft = await loadPrimesoftEnterpriseModule()

  assert.equal(primesoft.SOURCE, 'primesoftenterprise')
  assert.equal(primesoft.COMPANY_NAME, 'Primesoft Enterprise')
  assert.equal(primesoft.COMPANY, 'Primesoft Enterprise')
  assert.equal(primesoft.VERIFIED_ON, '2026-08-07')
  assert.equal(primesoft.OFFICIAL_SITE_URL, 'https://primesoft.net/')
  assert.equal(primesoft.LEGACY_CAREERS_URL, 'https://primesoft.net/careers/')
  assert.equal(primesoft.DARWINBOX_ORIGIN, 'https://primesoft.darwinbox.in')
  assert.equal(
    primesoft.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://primesoft.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    primesoft.PUBLIC_PORTAL_URL,
    'https://primesoft.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(primesoft.hasOfficialPrimesoftHomepageSignals(homepageHtml), true)
  assert.equal(
    primesoft.extractOfficialDarwinboxUrl(homepageHtml),
    'https://primesoft.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
})

test('Primesoft Enterprise validates the homepage careers handoff before delegating to Darwinbox', async () => {
  const primesoft = await loadPrimesoftEnterpriseModule()
  const requestedUrls = []
  const runCalls = []
  const delegatedJobs = [
    {
      title: 'QA Engineer.',
      company: 'Primesoft Enterprise',
      location: 'Malad Mindspace, Mumbai, Maharashtra , India',
      source: 'primesoftenterprise',
      link: 'https://primesoft.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a6333033cc4e',
    },
  ]

  const scraper = primesoft.createPrimesoftEnterpriseScraper({
    maxJobs: 1,
    now: () => FIXED_SCRAPED_AT,
    darwinboxScraper: {
      run: async (options) => {
        runCalls.push(options)
        return delegatedJobs
      },
    },
  })

  const jobs = await scraper.run({
    maxPages: 2,
    fetchText: async (url) => {
      requestedUrls.push(url)
      return homepageHtml
    },
  })

  assert.deepEqual(requestedUrls, [primesoft.OFFICIAL_SITE_URL])
  assert.deepEqual(runCalls, [{ maxPages: 2, maxJobs: 1, fetchListingPage: undefined }])
  assert.deepEqual(jobs, [
    {
      ...delegatedJobs[0],
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Primesoft Enterprise fails closed when the homepage careers handoff or Darwinbox target changes', async () => {
  const primesoft = await loadPrimesoftEnterpriseModule()

  await assert.rejects(
    primesoft.createPrimesoftEnterpriseScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified Primesoft Enterprise homepage careers handoff/i,
  )

  await assert.rejects(
    primesoft.createPrimesoftEnterpriseScraper().run({
      fetchText: async () => homepageHtml.replace(
        'https://primesoft.darwinbox.in/ms/candidatev2/main/careers/allJobs',
        'https://example.com/jobs',
      ),
    }),
    /homepage careers handoff|official Darwinbox handoff/i,
  )
})
