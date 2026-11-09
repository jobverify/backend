import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  createEvereadyScraper,
  hasApplicationFormSignal,
  hasOfficialTalentSignal,
} from './script.js'

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Career at Eveready - Growth Opportunities &amp; Work Culture</title>
    </head>
    <body>
      <h1>Talent</h1>
      <p>Join Eveready</p>
      <p>Upload Your Resume</p>
      <form>
        <input type="file" name="resume">
        <select name="department"></select>
        <select name="state"></select>
        <button type="submit">Apply Now</button>
      </form>
    </body>
  </html>
`

test('official Eveready talent signal accepts the current public branding', () => {
  assert.equal(hasOfficialTalentSignal(careersHtml), true)
  assert.equal(hasApplicationFormSignal(careersHtml), true)
})

test('Eveready application form accepts the current function and state listbox labels', () => {
  const currentFormHtml = `
    <!doctype html>
    <html lang="en">
      <body>
        <form>
          <button type="button">Function Applied for*</button>
          <button type="button">State Applied for*</button>
          <input type="file" accept=".pdf,.doc,.docx">
          <button type="submit">Apply Now</button>
        </form>
      </body>
    </html>
  `

  assert.equal(hasApplicationFormSignal(currentFormHtml), true)
})

test('Eveready returns no jobs when the verified talent page still exposes a generic resume form only', async () => {
  const requestedUrls = []
  const jobs = await createEvereadyScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL])
  assert.deepEqual(jobs, [])
})
