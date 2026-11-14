import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  createDrLalPathlabsScraper,
  validateNoOpeningsPage,
} from './script.js'

const applicationOnlyPage = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Submit Your CV to Dr Lal PathLabs</title>
      <link rel="canonical" href="https://www.lalpathlabs.com/career/submit-your-cv" />
    </head>
    <body>
      <main>
        <h2>Find a Job &amp; Grow Your Career</h2>
        <form>
          <label>Attach your Updated Resume, Max size 2MB*</label>
          <button type="submit">Submit</button>
        </form>
      </main>
    </body>
  </html>
`

test('historical application-only markup is not proof of a current empty vacancy inventory', async () => {
  const scraper = createDrLalPathlabsScraper()

  assert.equal(CAREER_PAGE_URL, 'https://www.lalpathlabs.com/career/submit-your-cv')
  assert.equal(validateNoOpeningsPage(applicationOnlyPage), true)

  await assert.rejects(scraper.run({fetchText:async()=>applicationOnlyPage}),/Original HTTP metadata is required/)
})
