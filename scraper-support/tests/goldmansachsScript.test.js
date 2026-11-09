import assert from 'node:assert/strict'
import test from 'node:test'

const loadGoldmanSachsModule = async () => {
  try {
    return await import('../../scraper/goldmansachs/script.js')
  } catch {
    assert.fail('Expected Goldman Sachs scraper module at ../../scraper/goldmansachs/script.js')
  }
}

const careersPageHtml = `
  <html>
    <head>
      <title>Goldman Sachs Careers | Goldman Sachs</title>
    </head>
    <body>
      <section>
        <h1>Choose Excellence</h1>
        <p>There are many chapters in a career. There is only one Goldman Sachs.</p>
        <a href="https://higher.gs.com/results">Open Roles</a>
      </section>
    </body>
  </html>
`

const openRolesShellHtml = `
  <html>
    <head>
      <title>Opportunities | Goldman Sachs</title>
    </head>
    <body>
      <main id="app-root"></main>
      <script src="/static/js/main.js"></script>
    </body>
  </html>
`

test('recognizes the official Goldman Sachs careers page and the official higher.gs.com roles shell', async () => {
  const goldmanSachs = await loadGoldmanSachsModule()

  assert.equal(goldmanSachs.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(goldmanSachs.hasOfficialOpenRolesSignal(openRolesShellHtml), true)
})

test('run returns no jobs after validating the official Goldman Sachs careers handoff to higher.gs.com', async () => {
  const goldmanSachs = await loadGoldmanSachsModule()
  const requestedUrls = []

  const jobs = await goldmanSachs.createGoldmanSachsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === goldmanSachs.CAREERS_PAGE_URL) {
        return careersPageHtml
      }

      if (url === goldmanSachs.OPEN_ROLES_URL) {
        return openRolesShellHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    goldmanSachs.CAREERS_PAGE_URL,
    goldmanSachs.OPEN_ROLES_URL,
  ])
  assert.deepEqual(jobs, [])
})
