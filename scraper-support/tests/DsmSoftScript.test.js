import assert from 'node:assert/strict'
import test from 'node:test'

const careersFormHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>DSM Soft | Geospatial | Engineering | Prepress | Telematics Services</title>
  </head>
  <body>
    <h1>Welcome to our company</h1>
    <h2>Your details</h2>
    <p>Interested candidates can send the resume to</p>
    <p>hr_team@dsmsoft.com</p>
    <h3>Geospatial</h3>
    <h3>Engineering</h3>
    <h3>Pre-press</h3>
    <h3>Telematics</h3>
  </body>
</html>
`

const careersWithPublicListingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>DSM Soft | Geospatial | Engineering | Prepress | Telematics Services</title>
  </head>
  <body>
    <h1>Careers</h1>
    <article class="job-card">
      <h2>GIS Software Engineer</h2>
      <a href="https://dsmsoft.com/jobs/gis-software-engineer">Apply Now</a>
    </article>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/dsmsoft/script.js')
  } catch {
    assert.fail('Expected DSM SOFT scraper module at ../../scraper/dsmsoft/script.js')
  }
}

test('DSM SOFT helpers stay pinned to the verified resume-intake careers surface from Saturday, July 18, 2026', async () => {
  const dsmSoft = await loadModule()

  assert.equal(dsmSoft.SOURCE, 'dsmsoft')
  assert.equal(dsmSoft.COMPANY, 'DSM SOFT')
  assert.equal(dsmSoft.CAREERS_URL, 'https://dsmsoft.com/Careers.aspx')
  assert.equal(dsmSoft.VERIFIED_ON, '2026-07-18')
  assert.equal(dsmSoft.hasOfficialCareersSignal(careersFormHtml), true)
  assert.equal(dsmSoft.pageExposesTrustworthyPublicJobListings(careersFormHtml), false)
  assert.equal(dsmSoft.pageExposesTrustworthyPublicJobListings(careersWithPublicListingHtml), true)
})

test('DSM SOFT returns [] only while the verified first-party careers page remains resume-only', async () => {
  const dsmSoft = await loadModule()
  const requestedUrls = []

  const jobs = await dsmSoft.createDsmSoftScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === dsmSoft.CAREERS_URL) return careersFormHtml
      throw new Error(`Unexpected DSM SOFT URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [dsmSoft.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('DSM SOFT fails closed when the verified careers surface drifts or starts exposing public jobs', async () => {
  const dsmSoft = await loadModule()

  await assert.rejects(
    dsmSoft.createDsmSoftScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified dsm soft careers surface/i,
  )

  await assert.rejects(
    dsmSoft.createDsmSoftScraper().run({
      fetchText: async () => careersWithPublicListingHtml,
    }),
    /surface now appears to expose trustworthy public job listings/i,
  )
})
