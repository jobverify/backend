import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  createMikuniIndiaScraper,
  hasOfficialCareerSignal,
  hasOfficialHomepageSignal,
} from '../../scraper/mikuniindia/script.js'

test('Mikuni India scraper exports the verified first-party homepage and careers surface', () => {
  assert.equal(COMPANY, 'Mikuni India Private Limited')
  assert.equal(HOMEPAGE_URL, 'https://mikuni.co.in/')
  assert.equal(CAREERS_URL, 'https://mikuni.co.in/open-positions-linked-with-naukri-portal/')
  assert.equal(typeof createMikuniIndiaScraper, 'function')
  assert.equal(typeof hasOfficialHomepageSignal, 'function')
  assert.equal(typeof hasOfficialCareerSignal, 'function')
})

test('Mikuni India scraper returns no public jobs from the verified first-party surfaces', async () => {
  const scraper = createMikuniIndiaScraper()

  const homepageHtml = `
    <html>
      <head><title>Mikuni India Private Limited</title></head>
      <body>
        <h1>Mikuni India Private Limited</h1>
        <nav><a href="/open-positions-linked-with-naukri-portal/">Career</a></nav>
      </body>
    </html>
  `

  const careersHtml = `
    <html>
      <body>
        <h1>Open Positions @ Mikuni India</h1>
        <p>APPLY HERE</p>
        <form>
          <label>First Name</label>
          <label>Willing to Relocate to Neemrana</label>
          <button>SUBMIT</button>
        </form>
      </body>
    </html>
  `

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
