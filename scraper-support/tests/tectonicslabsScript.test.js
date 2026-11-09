import assert from 'node:assert/strict'
import test from 'node:test'

const loadTectonicsLabsModule = async () => {
  try {
    return await import('../../scraper/tectonicslabs/script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <script>window.onload=function(){window.location.href="/lander"}</script>
    </head>
  </html>
`

const landerHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <script>window.LANDER_SYSTEM="PW"</script>
      <script async src="https://img1.wsimg.com/signals/js/clients/scc-c2/scc-c2.min.js"></script>
      <script defer="defer" src="https://img1.wsimg.com/parking-lander/static/js/main.351f5916.js"></script>
      <link href="https://img1.wsimg.com/parking-lander/static/css/main.1a427d5f.css" rel="stylesheet">
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

test('parked-domain signals are detected on the public Tectonics route', async () => {
  const tectonicsLabs = await loadTectonicsLabsModule()
  assert.ok(tectonicsLabs)

  assert.equal(tectonicsLabs.hasRedirectShellSignal(homepageHtml), true)
  assert.equal(tectonicsLabs.hasParkedDomainSignal(landerHtml), true)
})

test('run returns no jobs when tectonics.ai resolves to a parked domain lander', async () => {
  const tectonicsLabs = await loadTectonicsLabsModule()
  assert.ok(tectonicsLabs)

  const requestedUrls = []
  const jobs = await tectonicsLabs.createTectonicsLabsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === tectonicsLabs.CAREER_PAGE_URL) {
        return homepageHtml
      }

      if (url === tectonicsLabs.LANDER_PAGE_URL) {
        return landerHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://tectonics.ai/',
    'https://tectonics.ai/lander',
  ])
  assert.deepEqual(jobs, [])
})
