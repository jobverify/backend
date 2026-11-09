import assert from 'node:assert/strict'
import test from 'node:test'

const spaShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Laminaar Aviation Infotech (India) Pvt. Ltd.</title>
    <script type="module" crossorigin src="/assets/index-DRUDUIWt.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/laminaaraviationinfotech/script.js')
  } catch {
    assert.fail('Expected Laminaar Aviation Infotech scraper module at ../../scraper/laminaaraviationinfotech/script.js')
  }
}

test('Laminaar Aviation Infotech validators stay pinned to the verified SPA shell with no public jobs markers', async () => {
  const laminaar = await loadModule()

  assert.equal(laminaar.hasVerifiedSpaShellSignal(spaShellHtml), true)
  assert.equal(laminaar.hasPublicJobsSignal(spaShellHtml), false)
})

test('Laminaar Aviation Infotech stays fail-closed while homepage and careers route both resolve to the generic SPA shell', async () => {
  const laminaar = await loadModule()

  const jobs = await laminaar.createLaminaarAviationInfotechScraper().run({
    fetchText: async (url) => {
      assert.match(url, /^https:\/\/www\.laminaar\.in(?:\/|\/careers)?$/)
      return spaShellHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('Laminaar Aviation Infotech fails closed if the verified SPA shell contract changes', async () => {
  const laminaar = await loadModule()

  await assert.rejects(
    laminaar.createLaminaarAviationInfotechScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /Laminaar verified first-party SPA shell no longer matches the known fail-closed contract/i,
  )
})
