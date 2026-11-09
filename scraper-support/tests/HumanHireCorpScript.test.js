import assert from 'node:assert/strict'
import test from 'node:test'

const spaShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Human Hire Corp - Global Recruitment & Staffing Solutions</title>
    <meta name="description" content="Human Hire Corp provides professional recruitment, staffing, and HR solutions connects businesses worldwide with top talent." />
    <script type="module" crossorigin src="/assets/index-DlRC43D9.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/humanhirecorp/script.js')
  } catch {
    assert.fail('Expected HumanHire Corp scraper module at ../../scraper/humanhirecorp/script.js')
  }
}

test('HumanHire Corp sentinel helpers stay pinned to the verified recruitment SPA shell', async () => {
  const humanhire = await loadModule()

  assert.equal(humanhire.SOURCE, 'humanhirecorp')
  assert.equal(humanhire.COMPANY, 'HumanHire Corp')
  assert.equal(humanhire.PAGE_URLS[0], 'https://humanhirecorp.com/leadership-board')
  assert.equal(humanhire.VERIFIED_ON, '2026-07-18')
  assert.equal(humanhire.hasOfficialSpaShellSignal(spaShellHtml), true)
  assert.equal(humanhire.hasServerRenderedEmployerJobsSignal(spaShellHtml), false)
})

test('HumanHire Corp returns [] only while the verified brand pages remain SPA shells without SSR employer jobs', async () => {
  const humanhire = await loadModule()
  const requestedUrls = []

  const jobs = await humanhire.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (humanhire.PAGE_URLS.includes(url)) return spaShellHtml
      throw new Error(`Unexpected HumanHire URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, humanhire.PAGE_URLS)
  assert.deepEqual(jobs, [])
})

test('HumanHire Corp fails closed when employer jobs become server-rendered or the shell changes materially', async () => {
  const humanhire = await loadModule()

  await assert.rejects(
    humanhire.run({
      fetchText: async () => spaShellHtml.replace('<div id="root"></div>', '<h2>Current Openings</h2><a href="/apply">Apply Now</a>'),
    }),
    /server-rendered employer jobs/i,
  )

  await assert.rejects(
    humanhire.run({
      fetchText: async () => '<html><body>Unexpected</body></html>',
    }),
    /verified recruitment spa shell/i,
  )
})
