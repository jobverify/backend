import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Algoworks Careers | Join and Build a Career with Global Impacts</title>
  </head>
  <body>
    <h1>Join our global team where bold ideas drive smart design and real impact.</h1>
    <h2>Want to join Algoworks?</h2>
    <p>We're always looking for creative minds and innovators to join our team. If you don't see a current opening that fits, please email your resume and cover letter.</p>
    <a href="/cdn-cgi/l/email-protection#5b383a293e3e29281b3a373c342c3429302875383436">Email the Careers team</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/algoworkstechnologies/script.js')
  } catch {
    assert.fail('Expected Algoworks Technologies scraper module at ../../scraper/algoworkstechnologies/script.js')
  }
}

test('Algoworks Technologies validates the first-party careers page and returns no jobs when the page is only an email handoff', async () => {
  const algoworks = await loadModule()

  assert.equal(algoworks.SOURCE, 'algoworkstechnologies')
  assert.equal(algoworks.COMPANY, 'Algoworks Technologies')
  assert.equal(algoworks.CAREERS_URL, 'https://www.algoworks.com/careers/')
  assert.equal(algoworks.VERIFIED_ON, '2026-08-01')
  assert.equal(algoworks.hasOfficialCareersSignal(careersHtml), true)

  const jobs = await algoworks.createAlgoworksTechnologiesScraper().run({
    fetchText: async () => careersHtml,
  })

  assert.deepEqual(jobs, [])
})

test('Algoworks Technologies fails closed if the page starts exposing direct first-party openings', async () => {
  const algoworks = await loadModule()

  await assert.rejects(
    algoworks.createAlgoworksTechnologiesScraper().run({
      fetchText: async () => `${careersHtml}<a href="https://www.algoworks.com/careers/senior-engineer">Senior Engineer</a>`,
    }),
    /public first-party jobs surface/i,
  )
})
