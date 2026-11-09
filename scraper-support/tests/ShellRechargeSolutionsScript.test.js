import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="nl-NL">
  <head><title>Elektrisch opladen | Shell Nederland</title></head>
  <body>
    <meta name="application-name" content="Shell Recharge"/>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html>
  <head><title>Shell Global</title></head>
  <body>
    <meta name="application-name" content="Shell Global"/>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/shellrechargesolutions/script.js')
  } catch {
    assert.fail('Expected Shell Recharge Solutions scraper module at ../../scraper/shellrechargesolutions/script.js')
  }
}

test('Shell Recharge Solutions validators stay pinned to the verified homepage and generic careers redirect from Friday, July 17, 2026', async () => {
  const shellRecharge = await loadModule()
  assert.equal(shellRecharge.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(shellRecharge.hasGenericShellCareersSignal(careersHtml), true)
})

test('Shell Recharge Solutions run validates the brand homepage and generic Shell careers redirect and stays fail-closed', async () => {
  const shellRecharge = await loadModule()
  const jobs = await shellRecharge.createShellRechargeSolutionsScraper().run({
    fetchText: async (url) => (
      url === shellRecharge.HOMEPAGE_URL ? homepageHtml : careersHtml
    ),
  })

  assert.deepEqual(jobs, [])
})
