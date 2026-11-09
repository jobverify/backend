import assert from 'node:assert/strict'
import test from 'node:test'

const careerPlugHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rysun Labs Inc</title>
  </head>
  <body>
    <h1>Rysun Labs Inc</h1>
    <button>Show Me All Jobs</button>
    <div>Data Practice Lead</div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/rysunlabs/script.js')
  } catch {
    assert.fail('Expected Rysun Labs scraper module at ../../scraper/rysunlabs/script.js')
  }
}

test('Rysun Labs sentinel stays pinned to the observed third-party CareerPlug board', async () => {
  const rysun = await loadModule()

  assert.equal(rysun.SOURCE, 'rysunlabs')
  assert.equal(rysun.COMPANY, 'Rysun Labs')
  assert.equal(rysun.OBSERVED_PUBLIC_JOBS_URL, 'https://rysun-labs-inc.careerplug.com/jobs?locale=en')
  assert.equal(rysun.hasObservedCareerPlugSignal(careerPlugHtml), true)
  assert.equal(rysun.hasObservedCareerPlugSignal('<html><body><h1>Other</h1></body></html>'), false)
})

test('Rysun Labs returns [] while the only observed public jobs board remains third-party', async () => {
  const rysun = await loadModule()
  const requestedUrls = []

  const jobs = await rysun.createRysunLabsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === rysun.OBSERVED_PUBLIC_JOBS_URL) return careerPlugHtml
      throw new Error(`Unexpected Rysun URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [rysun.OBSERVED_PUBLIC_JOBS_URL])
  assert.deepEqual(jobs, [])
})

test('Rysun Labs fails closed when the observed third-party board drifts materially', async () => {
  const rysun = await loadModule()

  await assert.rejects(
    rysun.createRysunLabsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /observed third-party careerplug board/i,
  )
})
