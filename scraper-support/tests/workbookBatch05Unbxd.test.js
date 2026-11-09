import assert from 'node:assert/strict'
import test from 'node:test'

const unbxdModule = await import('../../scraper/unbxd/script.js').catch(() => ({}))

const {
  ABOUT_URL,
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  SOURCE,
  run,
} = unbxdModule

const VERIFIED_TRIAL_HTML = `
  <html>
    <body>
      <main>
        <h1>Deliver a Relevant &amp; Unique Shopping Experience</h1>
        <p>
          Unbxd's Search &amp; Navigation is relevant, context aware and personalised.
        </p>
        <h2>Free 14 Day Trial</h2>
        <a href="/about-us">About Us</a>
      </main>
    </body>
  </html>
`

const VERIFIED_ABOUT_HTML = `
  <html>
    <body>
      <section>
        <p>The Unbxd Story</p>
        <h1>Connecting retailers and shoppers with sophisticated AI-based solutions</h1>
        <p>That's the problem we solve at Netcore Unbxd.</p>
      </section>
    </body>
  </html>
`

test('Unbxd stays fail-closed on the verified exact-name public brand surfaces', async () => {
  const requestedUrls = []

  const jobs = await run({
    fetchHtml: async (url) => {
      requestedUrls.push(url)

      if (url === ABOUT_URL) return VERIFIED_ABOUT_HTML

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [ABOUT_URL])
  assert.deepEqual(jobs, [])
  assert.equal(SOURCE, 'unbxd')
  assert.equal(COMPANY, 'Unbxd')
  assert.equal(CAREERS_URL, 'https://try.unbxd.com/')
  assert.equal(ABOUT_URL, 'https://netcoreunbxd.com/about/')
  assert.equal(DISPOSITION, 'verified-exact-name-about-surface-fail-closed')
})
