import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  createControlOneAiScraper,
  hasCareerPageSignal,
  hasNoPublicListingsSignal,
} from './script.js'

const careerPageHtml = `
  <html>
    <body>
      <nav>
        <a>Join Our Team</a>
      </nav>
      <main>
        <h1>Accelerating The Future Of Cognitive robotics</h1>
        <p>Careers</p>
        <p>Contact us at contact@controlone.ai</p>
        <footer>Control One Logistics Private Limited</footer>
      </main>
    </body>
  </html>
`

test('detects the Control One public careers shell and no-public-listings signal', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.controlone.ai/')
  assert.equal(hasCareerPageSignal(careerPageHtml), true)
  assert.equal(hasNoPublicListingsSignal(careerPageHtml), true)
})

test('run returns no jobs when Control One only exposes a careers shell on its public site', async () => {
  const jobs = await createControlOneAiScraper().run({
    fetchText: async (url) => {
      assert.equal(url, CAREER_PAGE_URL)
      return careerPageHtml
    },
  })

  assert.deepEqual(jobs, [])
})
