import assert from 'node:assert/strict'
import test from 'node:test'

const sporjoModule = await import('../../scraper/sporjo/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  LANDER_URL,
  SOURCE,
  createSporjoScraper,
  run,
} = sporjoModule

const VERIFIED_ROOT_HTML = `<!DOCTYPE html><html><head><script>window.onload=function(){window.location.href="/lander"}</script></head></html>`
const VERIFIED_LANDER_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8"/>
      <script>window.LANDER_SYSTEM="PW"</script>
      <script>window._trfd=window._trfd||[],window._trfd.push({ap:"parking"})</script>
      <script defer="defer" src="https://img1.wsimg.com/parking-lander/static/js/main.d4b20955.js"></script>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

test('Sporjo domain-shell sentinel stays fail-closed on the verified parked-domain surface', async () => {
  const requestedUrls = []

  const jobs = await run({
    fetchHtml: async (url) => {
      requestedUrls.push(url)
      return url === LANDER_URL ? VERIFIED_LANDER_HTML : VERIFIED_ROOT_HTML
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, LANDER_URL])
  assert.deepEqual(jobs, [])
  assert.equal(SOURCE, 'sporjo')
  assert.equal(COMPANY, 'Sporjo')
  assert.equal(CAREERS_URL, 'https://www.sporjo.com/')
  assert.equal(LANDER_URL, 'https://www.sporjo.com/lander')
  assert.equal(DISPOSITION, 'verified-exact-name-public-surface-fail-closed-sentinel')
  assert.equal(typeof createSporjoScraper, 'function')
})

test('Sporjo rejects when the verified root redirect shell disappears', async () => {
  await assert.rejects(
    run({
      fetchHtml: async () => '<html><body><main>Explore opportunities with us.</main></body></html>',
    }),
    /root page to redirect visitors to \/lander/i,
  )
})

test('Sporjo rejects when the verified parked-domain shell disappears', async () => {
  await assert.rejects(
    run({
      fetchHtml: async (url) => (url === LANDER_URL ? '<html><body>landing</body></html>' : VERIFIED_ROOT_HTML),
    }),
    /parked-domain shell changed materially/i,
  )
})

test('Sporjo rejects when public JobPosting markup appears on the parked-domain shell', async () => {
  await assert.rejects(
    run({
      fetchHtml: async (url) => (url === LANDER_URL
        ? `
          ${VERIFIED_LANDER_HTML}
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"JobPosting","title":"Sports Partnerships Lead"}
          </script>
        `
        : VERIFIED_ROOT_HTML),
    }),
    /JobPosting markup/i,
  )
})

test('Sporjo rejects when the parked-domain shell starts exposing a trusted ATS board', async () => {
  await assert.rejects(
    run({
      fetchHtml: async (url) => (url === LANDER_URL
        ? `
          ${VERIFIED_LANDER_HTML}
          <iframe src="https://jobs.ashbyhq.com/sporjo"></iframe>
        `
        : VERIFIED_ROOT_HTML),
    }),
    /public listings surface/i,
  )
})
