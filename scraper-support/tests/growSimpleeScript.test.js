import assert from 'node:assert/strict'
import test from 'node:test'

const docsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Blitz External APIs</title>
  </head>
  <body>
    <main>
      <h1>Blitz External APIs</h1>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/growsimplee/script.js')
  } catch {
    assert.fail('Expected GrowSimplee scraper module at ../../scraper/growsimplee/script.js')
  }
}

test('GrowSimplee accepts the current API docs title-only shell while first-party routes remain unreachable', async () => {
  const growsimplee = await loadModule()

  assert.equal(growsimplee.hasVerifiedApiDocsSignal(docsHtml), true)

  const jobs = await growsimplee.createGrowSimpleeScraper().run({
    fetchPage: async () => ({
      status: 200,
      url: growsimplee.TRUSTED_API_DOCS_URL,
      html: docsHtml,
    }),
    probeUrl: async (url) => ({
      url,
      finalUrl: url,
      status: null,
      html: null,
      errorKind: url.includes('www.') ? 'dns' : 'timeout',
    }),
  })

  assert.deepEqual(jobs, [])
})
