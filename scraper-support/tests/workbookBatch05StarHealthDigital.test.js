import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  EXPLORE_JOB_OPPORTUNITIES_CTA,
  SOURCE,
  createStarHealthDigitalScraper,
  run,
} from '../../scraper/starhealthdigital/script.js'

const VERIFIED_SURFACE_HTML = `
  <html>
    <body>
      <section>
        <div>Get hired and take the next <br/>step in your Career</div>
        <button onclick="window.location='/arogya-seva-kendra/'">
          Explore job opportunities
        </button>
      </section>
      <section>
        <h2>Why Star Health</h2>
        <p>We offer excellent opportunities for growth and development.</p>
      </section>
    </body>
  </html>
`

test('StarHealth Digital validates the verified careers surface and stays fail-closed', async () => {
  let requestedUrl = null

  const jobs = await run({
    fetchHtml: async (url) => {
      requestedUrl = url
      return VERIFIED_SURFACE_HTML
    },
  })

  assert.equal(requestedUrl, CAREERS_URL)
  assert.deepEqual(jobs, [])
  assert.equal(SOURCE, 'starhealthdigital')
  assert.equal(COMPANY, 'StarHealth Digital')
  assert.equal(EXPLORE_JOB_OPPORTUNITIES_CTA, 'Explore job opportunities')
  assert.equal(DISPOSITION, 'verified-non-enumerable-careers-cta')
})

test('StarHealth Digital throws when the verified careers hero copy disappears', async () => {
  await assert.rejects(
    createStarHealthDigitalScraper().run({
      fetchHtml: async () => `
        <html>
          <body>
            <section>
              <h1>Careers</h1>
              <button>Explore job opportunities</button>
            </section>
          </body>
        </html>
      `,
    }),
    /missing verified careers hero copy/i,
  )
})

test('StarHealth Digital throws when the CTA starts routing to a first-party listings page', async () => {
  await assert.rejects(
    run({
      fetchHtml: async () => `
        <html>
          <body>
            <section>
              <div>Get hired and take the next step in your Career</div>
              <button onclick="window.location='/careers/open-positions/'">
                Explore job opportunities
              </button>
            </section>
            <section><h2>Why Star Health</h2></section>
          </body>
        </html>
      `,
    }),
    /first-party public listings surface/i,
  )
})

test('StarHealth Digital throws when public JobPosting markup appears on the verified surface', async () => {
  await assert.rejects(
    run({
      fetchHtml: async () => `
        <html>
          <body>
            <section>
              <div>Get hired and take the next step in your Career</div>
              <button>Explore job opportunities</button>
            </section>
            <section><h2>Why Star Health</h2></section>
            <script type="application/ld+json">
              {"@context":"https://schema.org","@type":"JobPosting","title":"Backend Engineer"}
            </script>
          </body>
        </html>
      `,
    }),
    /JobPosting markup/i,
  )
})
