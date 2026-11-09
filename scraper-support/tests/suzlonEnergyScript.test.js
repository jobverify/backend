import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
      <title>Careers at Suzlon | Join India&#x27;s Wind Energy Leader</title>
  </head>
  <body>
    <main>
      <h1>Your work can move the world forward</h1>
      <p>We are building renewable energy systems designed for the new world.</p>
      <section>
        <h2>Advancing people. Accelerating futures</h2>
        <p>Great Place To Work certified across India, Australia, Germany, and the Netherlands.</p>
      </section>
      <section>
        <h3>Equal opportunities</h3>
        <h3>Career advancement</h3>
        <h3>Women's Development</h3>
        <h3>1Learn</h3>
        <h3>Sectoral development</h3>
      </section>
      <footer>© 2026 Suzlon Energy Ltd. All Rights Reserved</footer>
    </main>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Suzlon | Join India's Wind Energy Leader</title>
  </head>
  <body>
    <main>
      <h1>Your work can move the world forward</h1>
      <section>
        <h2>Current Openings</h2>
        <a href="https://www.suzlon.com/in-en/careers/job-opportunity/127/AssistantManager-Steelstructuraldesign(BU-Technology)">Apply now</a>
      </section>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/suzlonenergy/script.js')
  } catch {
    assert.fail('Expected Suzlon Energy scraper module at ../../scraper/suzlonenergy/script.js')
  }
}

test('Suzlon Energy sentinel helpers stay pinned to the verified first-party careers page', async () => {
  const suzlonEnergy = await loadModule()

  assert.equal(suzlonEnergy.SOURCE, 'suzlonenergy')
  assert.equal(suzlonEnergy.COMPANY_NAME, 'Suzlon Energy')
  assert.equal(suzlonEnergy.OFFICIAL_BRAND_NAME, 'Suzlon Energy Ltd.')
  assert.equal(suzlonEnergy.VERIFIED_ON, '2026-08-05')
  assert.equal(suzlonEnergy.CAREERS_URL, 'https://www.suzlon.com/careers/')
  assert.equal(suzlonEnergy.hasOfficialCareersSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(
    suzlonEnergy.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'),
    false,
  )
  assert.equal(suzlonEnergy.hasEnumerablePublicJobsSignal(VERIFIED_CAREERS_HTML), false)
  assert.equal(suzlonEnergy.hasEnumerablePublicJobsSignal(PUBLIC_JOBS_HTML), true)
})

test('Suzlon Energy sentinel returns [] only while the verified first-party careers page remains non-enumerable', async () => {
  const suzlonEnergy = await loadModule()
  const requestedUrls = []

  const jobs = await suzlonEnergy.createSuzlonEnergyScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return VERIFIED_CAREERS_HTML
    },
  })

  assert.deepEqual(requestedUrls, [suzlonEnergy.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Suzlon Energy sentinel fails closed when the first-party careers page drifts or starts exposing enumerable jobs', async () => {
  const suzlonEnergy = await loadModule()

  await assert.rejects(
    suzlonEnergy.createSuzlonEnergyScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    suzlonEnergy.createSuzlonEnergyScraper().run({
      fetchText: async () => PUBLIC_JOBS_HTML,
    }),
    /enumerable public jobs/i,
  )
})
