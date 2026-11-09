import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  createEvereadyScraper,
  hasApplicationFormSignal,
  hasOfficialTalentSignal,
} from '../../scraper/eveready/script.js'

const officialTalentHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <div>Eveready Industries India Limited</div>
        <h1>Talent</h1>
        <p>Join Eveready and build your future with us.</p>
        <h2>Upload Your Resume</h2>
        <form action="/talent/" method="post">
          <input type="text" name="candidate_name" />
          <input type="file" name="resume" />
          <select name="department">
            <option>Engineering</option>
          </select>
          <select name="state">
            <option>West Bengal</option>
          </select>
          <button type="submit">Apply Now</button>
        </form>
      </main>
    </body>
  </html>
`

test('Eveready validates the official talent surface and generic application form before returning no verified listings', async () => {
  const requestedUrls = []

  assert.equal(hasOfficialTalentSignal(officialTalentHtml), true)
  assert.equal(hasApplicationFormSignal(officialTalentHtml), true)

  const jobs = await createEvereadyScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialTalentHtml
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Eveready fails closed when the official talent surface changes', async () => {
  await assert.rejects(
    createEvereadyScraper().run({
      fetchText: async () => '<html><title>Unexpected</title></html>',
    }),
    /Eveready official talent surface changed/i,
  )

  await assert.rejects(
    createEvereadyScraper().run({
      fetchText: async () => `
        <html>
          <body>
            <div>Eveready Industries India Limited</div>
            <h1>Talent</h1>
            <p>Join Eveready and build your future with us.</p>
            <h2>Upload Your Resume</h2>
            <p>No application form is available.</p>
          </body>
        </html>
      `,
    }),
    /Eveready application form changed/i,
  )
})
