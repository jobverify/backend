import assert from 'node:assert/strict'
import test from 'node:test'

import * as remunance from '../../scraper/remunanceservicespvtltd/script.js'

const homepage = '<title>Remunance | Best Employer of Record Services Provider India</title><link rel="canonical" href="https://remunance.com/"><a href="https://remunance.com/careers/">Careers</a><footer><h4>Remunance Services Pvt Ltd</h4><a href="https://linkedin.com/company/remunance">LinkedIn</a></footer>'
const careers = '<title>Career in Remunance | Apply for remote working jobs.</title><link rel="canonical" href="https://remunance.com/careers/"><meta property="og:site_name" content="Remunance"><h2>Current Openings</h2><div class="elfsight-app-40bef639-b4af-4953-bb78-5de275c4b2d5" data-elfsight-app-lazy></div><a href="mailto:resume@remunance.com">resume</a><footer><h4>Remunance Services Pvt Ltd</h4></footer>'
const job = (suffix, location = 'Pune') => {
  const id = '00000000-0000-4000-8000-' + String(suffix).padStart(12, '0')
  return { id, title: 'Engineer ' + suffix, company: '', department: 'IT', location, typeOfContract: 'Full Time', description: '<div><strong>Experience required: 2-5 years</strong></div><p>Build reliable engineering systems for clients across India.</p>', link: { type: 'url', target: '_blank', value: 'https://docs.google.com/forms/d/e/form-' + suffix + '/viewform?entry.1=Engineer' } }
}
const payload = jobs => ({ status: 1, data: { widgets: { '40bef639-b4af-4953-bb78-5de275c4b2d5': { status: 1, data: { app: 'job-board', settings: { jobs } } } } } })

const run = (jobs, overrides = {}) => remunance.run({
  fetchText: async url => url === remunance.HOMEPAGE_URL ? homepage : careers,
  fetchJson: async () => payload(jobs),
  now: () => '2026-09-13T00:00:00.000Z',
  ...overrides,
})

test('Remunance reads the complete current Elfsight board and keeps explicit India roles', async () => {
  const jobs = await run([job('1'), job('2', 'PAN India'), job('3', 'Remote')])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map(row => row.location), ['Pune, India', 'India'])
  assert.ok(jobs.every(row => row.sourceListingComplete === false))
  assert.ok(jobs.every(row => row.applyUrl.startsWith('https://docs.google.com/forms/')))
})

test('Remunance rejects malformed or unscoped current widget inventories', async () => {
  await assert.rejects(run([job('1'), job('1')]), /duplicate/i)
  await assert.rejects(run([{ ...job('1'), link: { value: 'https://evil.example/apply', type: 'url' } }]), /application|link/i)
  await assert.rejects(run([job('1', 'Remote')]), /India|scope/i)
})
