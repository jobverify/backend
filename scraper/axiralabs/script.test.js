import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  createAxiraLabsScraper,
  extractSearchResults,
} from './script.js'

const careerPageHtml = `
  <main>
    <h1>Build the Future of Diagnostics.</h1>
    <section id="current-openings">
      <h2>Current Openings</h2>
      <article>
        <h3>QA Assistant +</h3>
        <p>Bengaluru &bull; Full-time &bull; Operations</p>
        <a href="/contact">Apply Now</a>
        <p>We are looking for a QA Assistant to support quality assurance activities across manufacturing and testing operations.</p>
      </article>
    </section>
  </main>
`

test('extractSearchResults maps visible Achira Labs career cards into shared job fields', () => {
  assert.equal(CAREER_PAGE_URL, 'https://achiralabs.com/careers')

  assert.deepEqual(extractSearchResults(careerPageHtml), [
    {
      title: 'QA Assistant',
      company: 'Achira Labs',
      department: 'Operations',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'qa-assistant',
      requisitionId: 'qa-assistant',
      sourceUrl: 'https://achiralabs.com/careers#qa-assistant',
      applyUrl: 'https://achiralabs.com/contact',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'We are looking for a QA Assistant to support quality assurance activities across manufacturing and testing operations.',
      remoteStatus: 'On-site',
    },
  ])
})

// The live official page now delegates to Keka; static cards are no longer an inventory.
test('run verifies the current native embedded inventory instead of publishing historical cards', async () => {
  const { transport } = await import('./native.fixture.js')
  const { readInventoryEvidence } = await import('../../scraper-support/utils/inventoryEvidence.js')
  const jobs = await createAxiraLabsScraper().run({ fetchImpl: transport() })
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})
test('run rejects legacy text transport without observed HTTP metadata', async () => {
  await assert.rejects(createAxiraLabsScraper().run({ fetchText: async () => careerPageHtml }), /unsupported legacy transport/)
})
