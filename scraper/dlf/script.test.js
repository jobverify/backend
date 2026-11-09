import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  createDlfScraper,
  hasCareerPageSignal,
  hasNoPublicListingsSignal,
} from './script.js'

const careerPageHtml = `
  <html>
    <head>
      <title>Career at DLF Groups- DLF India</title>
    </head>
    <body>
      <h1>Careers</h1>
      <h4>Come, grow with us</h4>
      <p>Joining DLF means becoming a part of India's most established real estate brand.</p>
      <h4>Notice On Fraudulent job offer</h4>
      <p>
        It may be noticed that DLF does not take any money/fees in lieu of employment.
        For any information clarification, please contact at hrd@dlf.in
      </p>
      <h4>Interested in joining us?</h4>
      <p>Send us your CV on hrd@dlf.in</p>
    </body>
  </html>
`

test('detects the official DLF careers page and its no-public-listings signal', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.dlf.in/career-page')
  assert.equal(hasCareerPageSignal(careerPageHtml), true)
  assert.equal(hasNoPublicListingsSignal(careerPageHtml), true)
})

test('run returns no jobs when DLF only offers CV submission on its public careers page', async () => {
  const jobs = await createDlfScraper().run({
    fetchText: async (url) => {
      assert.equal(url, CAREER_PAGE_URL)
      return careerPageHtml
    },
  })

  assert.deepEqual(jobs, [])
})
