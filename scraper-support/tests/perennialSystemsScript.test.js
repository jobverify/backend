import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Grow, innovate &amp; shape your future with us.</h1>
    <a href="https://perennialsys.com/job-openings/">Explore Career Opportunities.</a>
  </body>
</html>
`

const openingsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Coming</h1>
    <p>Soon...</p>
    <footer>Powered by Keka Hire</footer>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/perennialsystems/script.js')
  } catch {
    assert.fail('Expected Perennial Systems scraper module at ../../scraper/perennialsystems/script.js')
  }
}

test('Perennial Systems validator stays pinned to the verified careers shell and coming-soon openings page', async () => {
  const perennial = await loadModule()

  assert.equal(perennial.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(perennial.hasComingSoonOpeningsSignal(openingsHtml), true)
})

test('Perennial Systems run stays fail-closed while the public openings page remains coming soon', async () => {
  const perennial = await loadModule()
  const requests = []

  const jobs = await perennial.run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === perennial.CAREERS_URL) return careersHtml
      if (url === perennial.OPENINGS_URL) return openingsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [perennial.CAREERS_URL, perennial.OPENINGS_URL])
  assert.deepEqual(jobs, [])
})

test('Perennial Systems fails closed when the careers shell or openings state changes materially', async () => {
  const perennial = await loadModule()

  await assert.rejects(
    perennial.run({
      fetchText: async (url) => (url === perennial.CAREERS_URL ? '<html></html>' : openingsHtml),
    }),
    /verified Perennial Systems careers shell/i,
  )

  await assert.rejects(
    perennial.run({
      fetchText: async (url) => (url === perennial.CAREERS_URL ? careersHtml : '<html><body><h1>Open Roles</h1></body></html>'),
    }),
    /verified Perennial Systems openings page/i,
  )
})
