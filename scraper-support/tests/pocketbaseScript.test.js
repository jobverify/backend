import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>PocketBase - Open Source backend in 1 file</title>
  </head>
  <body>
    <header>
      <a href="/docs/">Documentation</a>
      <a href="/faq/">FAQ</a>
      <a href="https://github.com/pocketbase/pocketbase/discussions">Discussions</a>
    </header>
    <main>
      <h1>Open Source backend in 1 file</h1>
      <p>Realtime database, auth, file storage, admin dashboard and simple JavaScript SDK.</p>
    </main>
  </body>
</html>
`

const FAQ_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>FAQ - PocketBase</title>
  </head>
  <body>
    <main>
      <h1>Frequently asked questions</h1>
      <section>
        <h2>Is PocketBase a startup?</h2>
        <p>PocketBase is neither a startup, nor a business.</p>
        <p>It is a personal open source project with intentionally limited scope and developed entirely on volunteer basis.</p>
        <p>There is no paid team or company behind it.</p>
      </section>
    </main>
  </body>
</html>
`

const loadPocketbaseModule = async () => {
  try {
    return await import('../../scraper/pocketbase/script.js')
  } catch {
    assert.fail('Expected PocketBase scraper module at ../../scraper/pocketbase/script.js')
  }
}

test('PocketBase scraper helpers stay pinned to the verified homepage and FAQ no-company-careers signal', async () => {
  const pocketbase = await loadPocketbaseModule()

  assert.equal(pocketbase.SOURCE, 'pocketbase')
  assert.equal(pocketbase.COMPANY, 'PocketBase')
  assert.equal(pocketbase.COMPANY_DOMAIN, 'pocketbase.io')
  assert.equal(pocketbase.HOMEPAGE_URL, 'https://pocketbase.io/')
  assert.equal(pocketbase.CAREERS_URL, null)
  assert.equal(pocketbase.FAQ_URL, 'https://pocketbase.io/faq/')
  assert.equal(pocketbase.VERIFIED_AT, '2026-07-25')
  assert.equal(pocketbase.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(pocketbase.hasOfficialFaqSignal(FAQ_HTML), true)
})

test('PocketBase run returns [] while the verified homepage and FAQ project-status statement remain intact', async () => {
  const pocketbase = await loadPocketbaseModule()
  const requestedUrls = []

  const jobs = await pocketbase.createPocketBaseScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === pocketbase.HOMEPAGE_URL) {
        return HOMEPAGE_HTML
      }

      if (url === pocketbase.FAQ_URL) {
        return FAQ_HTML
      }

      throw new Error(`Unexpected URL requested during test: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    pocketbase.HOMEPAGE_URL,
    pocketbase.FAQ_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('PocketBase fails closed when the homepage drifts or the FAQ stops asserting the no-company contract', async () => {
  const pocketbase = await loadPocketbaseModule()

  await assert.rejects(
    pocketbase.createPocketBaseScraper().run({
      fetchText: async () => '<html><head><title>Unexpected</title></head><body></body></html>',
    }),
    /homepage/i,
  )

  await assert.rejects(
    pocketbase.createPocketBaseScraper().run({
      fetchText: async (url) => (
        url === pocketbase.HOMEPAGE_URL
          ? HOMEPAGE_HTML
          : FAQ_HTML.replace('There is no paid team or company behind it.', 'We are hiring now.')
      ),
    }),
    /faq/i,
  )
})
