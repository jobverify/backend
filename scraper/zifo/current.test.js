import assert from 'node:assert/strict'
import test from 'node:test'

import { createZifoScraper, WORKABLE_API_URL } from './script.js'

const careers = `<html><head><title>Careers - Zifo RnD Solutions</title></head><body>
<h1>CAREERS</h1><h4>Zifo India</h4><div class="career_pdfs"><ul>
<li><a href="https://apply.workable.com/j/875CE96451">Computational Biology &amp; Bioinformatics Scientist, Chennai, Tamil Nadu</a></li>
<li><a href="https://apply.workable.com/j/6A9E892A52">GxP Specialist, Chennai, Tamil Nadu</a></li>
</ul></div><h4>Zifo North America</h4>
<div class="career_india_popup">We do not have any vacancies at this moment.</div>
</body></html>`

const jobs = [
  { title: 'Computational Biology & Bioinformatics Scientist', shortcode: '875CE96451', country: 'India', city: 'Chennai', state: 'Tamil Nadu', url: 'https://apply.workable.com/j/875CE96451', application_url: 'https://apply.workable.com/j/875CE96451/apply', published_on: '2026-05-05', employment_type: 'Full-time', telecommuting: false, description: '<p>Scientific research</p>' },
  { title: 'GxP Specialist', shortcode: '6A9E892A52', country: 'India', city: 'Chennai', state: 'Tamil Nadu', url: 'https://apply.workable.com/j/6A9E892A52', application_url: 'https://apply.workable.com/j/6A9E892A52/apply', published_on: '2026-07-21', employment_type: '', telecommuting: false, description: '<p>Quality compliance</p>' },
  { title: 'US role', shortcode: 'USA1', country: 'United States', city: 'Boston', state: 'MA', url: 'https://apply.workable.com/j/USA1', application_url: 'https://apply.workable.com/j/USA1/apply' },
]

test('Zifo extracts both current India roles from the official handoff and Workable published jobs feed', async () => {
  const result = await createZifoScraper().run({
    fetchText: async () => careers,
    fetchJson: async (url) => { assert.equal(url, WORKABLE_API_URL); return { name: 'Zifo', jobs } },
    now: () => '2026-10-03T00:00:00.000Z',
  })
  assert.equal(result.length, 2)
  assert.deepEqual(result.map((job) => job.jobId), ['875CE96451', '6A9E892A52'])
  assert.deepEqual(result.map((job) => job.location), ['Chennai, Tamil Nadu, India', 'Chennai, Tamil Nadu, India'])
  assert.equal(result[0].applyUrl, 'https://apply.workable.com/j/875CE96451/apply')
  assert.equal(result[0].source, 'zifo')
})

test('Zifo fails closed if the official India links and published feed disagree', async () => {
  await assert.rejects(createZifoScraper().run({
    fetchText: async () => careers,
    fetchJson: async () => ({ name: 'Zifo', jobs: jobs.slice(1) }),
  }), /inventory/i)
})
