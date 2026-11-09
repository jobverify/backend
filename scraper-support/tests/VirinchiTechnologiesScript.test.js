import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>.:: Welcome to Virinchi ::.</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>Virinchi is always looking to recruit exceptionally bright and outstanding people.</p>
    <a href="http://www.virinchigroup.com/ksoft/profSignup.php" target="_blank">Profile Sign Up</a>
    <p>SEND YOUR RESUME TO: virinchi2015@gmail.com</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/virinchitechnologies/script.js')
  } catch {
    assert.fail('Expected Virinchi Technologies scraper module at ../../scraper/virinchitechnologies/script.js')
  }
}

test('Virinchi Technologies validators stay pinned to the verified profile-signup-only careers page', async () => {
  const virinchi = await loadModule()

  assert.equal(virinchi.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(virinchi.hasNoPublicJobListingsSignal(careersHtml), true)
})

test('Virinchi Technologies stays fail-closed while the first-party careers page still exposes only profile signup', async () => {
  const virinchi = await loadModule()

  const jobs = await virinchi.createVirinchiTechnologiesScraper().run({
    fetchText: async (url) => {
      assert.equal(url, virinchi.CAREERS_URL)
      return careersHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('Virinchi Technologies fails closed if the verified profile-signup contract disappears', async () => {
  const virinchi = await loadModule()

  await assert.rejects(
    virinchi.createVirinchiTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /Virinchi verified careers page no longer matches the known fail-closed contract/i,
  )
})
