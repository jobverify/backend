import assert from 'node:assert/strict'
import test from 'node:test'

const loadEngineermindsModule = async () => {
  try {
    return await import('../../scraper/engineerminds/script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Engineerminds</title>
    </head>
    <body>
      <h1>Engineerminds</h1>
      <p>Engineering talent and consulting</p>
    </body>
  </html>
`

test('hasPublicCareerHost distinguishes between missing and reachable public hosts', async () => {
  const engineerminds = await loadEngineermindsModule()
  assert.ok(engineerminds)

  assert.equal(engineerminds.hasPublicCareerHost([]), false)
  assert.equal(engineerminds.hasPublicCareerHost(['203.0.113.10']), true)
})

test('run returns no jobs when the Engineerminds domain has no public host records', async () => {
  const engineerminds = await loadEngineermindsModule()
  assert.ok(engineerminds)

  const requestedUrls = []
  const jobs = await engineerminds.createEngineermindsScraper().run({
    resolveAddresses: async () => [],
    fetchText: async (url) => {
      requestedUrls.push(url)
      return homepageHtml
    },
  })

  assert.deepEqual(requestedUrls, [])
  assert.deepEqual(jobs, [])
})
