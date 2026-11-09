import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Archive</title>
  </head>
  <body>
    <main>
      <h1>Our Vision</h1>
      <a href="#openings">View Job Openings</a>
      <section id="openings">
        <h2>Latest Jobs</h2>
        <p>Search</p>
        <p>Role</p>
        <p>Location</p>
        <p>Type</p>
        <p>Date of Posting</p>
      </section>
      <section>
        <h2>Send a request</h2>
        <p>ROLE YOU ARE APPLYING FOR*</p>
        <p>FIRST NAME*</p>
        <p>EMAIL*</p>
      </section>
      <p>Please visit our career page for latest job openings</p>
    </main>
  </body>
</html>
`

const structuredJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Archive</title>
  </head>
  <body>
    <main>
      <a href="#openings">View Job Openings</a>
      <h2>Latest Jobs</h2>
      <p>Role</p>
      <p>Location</p>
      <p>Type</p>
      <p>Date of Posting</p>
      <p>ROLE YOU ARE APPLYING FOR*</p>
      <article class="job-card">
        <h3>Blockchain Engineer</h3>
        <a href="https://accubits.com/career/blockchain-engineer/">Apply now</a>
      </article>
    </main>
  </body>
</html>
`

const currentEmptyCareersHtml = `
<html><head><title>Career &ndash; Accubits</title></head><body>
  <a href="#latest_jobs">View Job Openings</a>
  <section class="latest-jobs" id="latest_jobs">
    <h2>Latest Jobs</h2>
    <div class="job-list-head"><div>Role</div><div>Location</div><div>Type</div><div>Date of Posting</div></div>
    <div class="job-list"><div class="search-error">No openings are listed right now. Write to us and we will keep you in mind.</div></div>
  </section>
</body></html>
`

test('Accubits Technologies accepts the current explicit no-openings state as verified empty', async () => {
  const accubits = await loadAccubitsModule()
  const jobs = await accubits.createAccubitsTechnologiesScraper().run({
    fetchText: async () => currentEmptyCareersHtml,
  })

  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'verified-empty')
  assert.equal(evidence?.listingComplete, true)
})

const loadAccubitsModule = async () => {
  try {
    return await import('../../scraper/accubitstechnologies/script.js')
  } catch {
    assert.fail('Expected Accubits Technologies scraper module at ../../scraper/accubitstechnologies/script.js')
  }
}

test('Accubits Technologies returns [] only while the verified careers shell exposes no public role rows', async () => {
  const accubits = await loadAccubitsModule()
  const requestedUrls = []

  assert.equal(accubits.hasOfficialAccubitsCareersSignals(careersHtml), true)
  assert.equal(accubits.pageExposesStructuredJobListings(careersHtml), false)

  const jobs = await accubits.createAccubitsTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://accubits.com/career/'])
  assert.deepEqual(jobs, [])
})

test('Accubits Technologies returns discovery-only evidence when the verified careers page returns HTTP 500', async () => {
  const accubits = await loadAccubitsModule()

  const jobs = await accubits.createAccubitsTechnologiesScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
    fetchText: async () => {
      throw new Error(`HTTP 500 for ${accubits.OFFICIAL_CAREERS_URL}`)
    },
  })

  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.surface, accubits.OFFICIAL_CAREERS_URL)
  assert.equal(evidence?.listingComplete, false)
})

test('Accubits Technologies fails closed when structured public jobs appear on the careers shell', async () => {
  const accubits = await loadAccubitsModule()

  await assert.rejects(
    accubits.createAccubitsTechnologiesScraper().run({
      fetchText: async () => structuredJobsHtml,
    }),
    /structured public job listings/i,
  )
})

test('Accubits Technologies fails closed when the verified careers shell identity drifts', async () => {
  const accubits = await loadAccubitsModule()

  await assert.rejects(
    accubits.createAccubitsTechnologiesScraper().run({
      fetchText: async () => '<html><body>Unknown</body></html>',
    }),
    /official careers shell changed/i,
  )
})
