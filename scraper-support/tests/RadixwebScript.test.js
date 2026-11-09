import assert from 'node:assert/strict'
import test from 'node:test'

const currentOpeningsShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title data-head="tezjs">Current Job Openings - PHP, .NET, NodeJs, HTML5, Cloud Engineers - Radixweb</title>
    <link data-head="tezjs" rel="canonical" href="https://radixweb.com/current-openings"/>
  </head>
  <body>
    <div id="tez_app"><img src="/images/loader.gif" /></div>
    <script type="module" src="/assets/tez.639198638594860000.js"></script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/radixweb/script.js')
  } catch {
    assert.fail('Expected Radixweb scraper module at ../../scraper/radixweb/script.js')
  }
}

test('Radixweb sentinel helpers stay pinned to the verified Tez current-openings shell', async () => {
  const radixweb = await loadModule()

  assert.equal(radixweb.SOURCE, 'radixweb')
  assert.equal(radixweb.COMPANY, 'Radixweb')
  assert.equal(radixweb.CAREERS_URL, 'https://radixweb.com/current-openings')
  assert.equal(radixweb.VERIFIED_ON, '2026-07-18')
  assert.equal(radixweb.hasOfficialShellSignal(currentOpeningsShellHtml), true)
  assert.equal(radixweb.hasServerRenderedJobsSignal(currentOpeningsShellHtml), false)
})

test('Radixweb returns [] only while current openings remain a raw client-rendered shell to plain fetch', async () => {
  const radixweb = await loadModule()
  const requestedUrls = []

  const jobs = await radixweb.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === radixweb.CAREERS_URL) return currentOpeningsShellHtml
      throw new Error(`Unexpected Radixweb URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [radixweb.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Radixweb fails closed when SSR job cards appear or the Tez shell drifts', async () => {
  const radixweb = await loadModule()

  await assert.rejects(
    radixweb.run({
      fetchText: async () => currentOpeningsShellHtml.replace('</body>', '<a href="/current-openings/trainee-software-engineer-net">Trainee Software Engineer More Details</a></body>'),
    }),
    /server-rendered public jobs/i,
  )

  await assert.rejects(
    radixweb.run({
      fetchText: async () => '<html><body>Unexpected</body></html>',
    }),
    /verified current-openings shell/i,
  )
})
