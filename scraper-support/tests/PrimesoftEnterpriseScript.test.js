import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>PrimeSoft, Agentic AI & Enterprise Transformation</title>
  </head>
  <body>
    <h1>PrimeSoft</h1>
    <a href="https://primesoft.darwinbox.in/ms/candidatev2/main/careers/allJobs">Careers</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/primesoftenterprise/script.js')
  } catch {
    assert.fail('Expected Primesoft Enterprise scraper module at ../../scraper/primesoftenterprise/script.js')
  }
}

test('Primesoft Enterprise pins the verified homepage careers handoff to the official Darwinbox board', async () => {
  const primesoft = await loadModule()

  assert.equal(primesoft.SOURCE, 'primesoftenterprise')
  assert.equal(primesoft.COMPANY_NAME, 'Primesoft Enterprise')
  assert.equal(primesoft.OFFICIAL_SITE_URL, 'https://primesoft.net/')
  assert.equal(
    primesoft.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://primesoft.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(primesoft.DARWINBOX_ORIGIN, 'https://primesoft.darwinbox.in')
  assert.equal(primesoft.DARWINBOX_COMPANY_ID, 'main')
  assert.equal(primesoft.PUBLIC_PORTAL_URL, primesoft.OFFICIAL_CAREERS_HANDOFF_URL)
  assert.equal(
    primesoft.extractOfficialDarwinboxUrl(verifiedHomepageHtml),
    primesoft.OFFICIAL_CAREERS_HANDOFF_URL,
  )
  assert.equal(primesoft.hasOfficialPrimesoftHomepageSignals(verifiedHomepageHtml), true)
})

test('Primesoft Enterprise run validates the homepage handoff before delegating to Darwinbox', async () => {
  const primesoft = await loadModule()
  let delegated = false

  const jobs = await primesoft.createPrimesoftEnterpriseScraper({
    now: () => '2026-08-07T00:00:00.000Z',
    darwinboxScraper: {
      run: async ({ fetchListingPage }) => {
        delegated = true
        assert.deepEqual(await fetchListingPage({ page: 1 }), [{ id: 'stub' }])
        return [
          {
            title: 'Associate Consultant',
            company: 'Primesoft Enterprise',
            location: 'Bengaluru, India',
            city: 'Bengaluru',
            country: 'India',
            source: 'primesoftenterprise',
            jobId: 'job-1',
            requisitionId: null,
            sourceUrl: 'https://primesoft.darwinbox.in/ms/candidatev2/main/careers/jobDetails/job-1',
            applyUrl: 'https://primesoft.darwinbox.in/ms/candidatev2/main/careers/jobDetails/job-1',
            employmentType: 'Full Time',
            experienceRequired: null,
            minimumQualification: null,
            preferredQualification: null,
            requiredSkills: [],
            postingDate: null,
            closingDate: null,
            jobDescription: 'Deliver enterprise transformation programs.',
            link: 'https://primesoft.darwinbox.in/ms/candidatev2/main/careers/jobDetails/job-1',
          },
        ]
      },
    },
  }).run({
    fetchText: async (url) => {
      assert.equal(url, primesoft.OFFICIAL_SITE_URL)
      return verifiedHomepageHtml
    },
    fetchListingPage: async () => [{ id: 'stub' }],
  })

  assert.equal(delegated, true)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Associate Consultant')
  assert.equal(jobs[0].scrapedAt, '2026-08-07T00:00:00.000Z')
})

test('Primesoft Enterprise fails closed when the verified homepage handoff drifts', async () => {
  const primesoft = await loadModule()

  await assert.rejects(
    primesoft.createPrimesoftEnterpriseScraper({
      darwinboxScraper: {
        run: async () => [],
      },
    }).run({
      fetchText: async () => '<html><body><h1>PrimeSoft</h1></body></html>',
      fetchListingPage: async () => [],
    }),
    /homepage careers handoff|official Darwinbox handoff/i,
  )
})
