import assert from 'node:assert/strict'
import test from 'node:test'
import { createNeudesicTechnologiesScraper } from '../../scraper/neudesictechnologies/script.js'

const boardUrl = 'https://careers.neudesic.in/jobs'
const firstJobUrl = `${boardUrl}/yRh_kGAOBKSd/ai-engineer`
const secondJobUrl = `${boardUrl}/another-id/cloud-engineer`
const board = `<title>Neudesic Global Services Careers</title><link href="https://assets.freshteam.com/assets/portal.css">
  <h3>Open Positions</h3><h5>Consulting Services <span>- 2 Open Roles</span></h5>
  <a href="/jobs/yRh_kGAOBKSd/ai-engineer">AI Engineer</a>
  <a href="/jobs/another-id/cloud-engineer">Cloud Engineer</a><a href="https://www.neudesic.com">www.neudesic.com</a>`
const detail = (url, country = 'India') => `<script type="application/ld+json">${JSON.stringify({
  '@type': 'JobPosting', url: new URL('AI%20Engineer', url).href, title: 'AI Engineer',
  description: '&lt;p&gt;Build Azure &amp; AI applications.&lt;/p&gt;',
  datePosted: '2026-09-12 16:06:58 UTC', employmentType: 'FULL_TIME',
  hiringOrganization: { name: 'Neudesic Technologies Pvt. Ltd.' },
  jobLocation: { address: { addressRegion: 'Bengaluru', addressLocality: 'Karnataka', addressCountry: country } },
})}</script>`

test('Neudesic reads its active India careers board and verifies hiring entity on each detail', async () => {
  const requested = []
  const jobs = await createNeudesicTechnologiesScraper().run({ fetchText: async (url) => {
    requested.push(url)
    if (url === boardUrl) return board
    if (url === firstJobUrl) return detail(url)
    if (url === secondJobUrl) return detail(url, 'United States')
    throw new Error(`Unexpected Neudesic URL: ${url}`)
  } })
  assert.deepEqual(requested, [boardUrl, firstJobUrl, secondJobUrl])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'AI Engineer')
  assert.equal(jobs[0].company, 'Neudesic Technologies')
  assert.equal(jobs[0].jobId, 'yRh_kGAOBKSd')
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].postingDate, '2026-09-12')
  assert.equal(jobs[0].jobDescription, 'Build Azure & AI applications.')
  assert.equal(jobs[0].sourceUrl, firstJobUrl)
})

test('Neudesic rejects retired marketing pages, partial boards and malformed job details', async () => {
  for (const html of [
    '<title>IBM Neudesic</title><h1>IBM Neudesic</h1><p>Driving measurable outcomes with AI and Microsoft Cloud</p>',
    board.replace('<a href="/jobs/another-id/cloud-engineer">Cloud Engineer</a>', ''),
  ]) {
    await assert.rejects(createNeudesicTechnologiesScraper().run({ fetchText: async () => html }), /Neudesic|incomplete/i)
  }
  for (const html of [
    '<title>Site Maintenance</title>',
    detail(firstJobUrl).replace('Neudesic Technologies Pvt. Ltd.', 'Different Company'),
    detail(firstJobUrl).replace('yRh_kGAOBKSd', 'unrelated-job'),
  ]) {
    await assert.rejects(createNeudesicTechnologiesScraper().run({ fetchText: async (url) => url === boardUrl ? board : html }), /Neudesic|job posting/i)
  }
})

test('Neudesic rejects a failed detail and honours cancellation without returning partial jobs', async () => {
  await assert.rejects(createNeudesicTechnologiesScraper().run({ fetchText: async (url) => {
    if (url === boardUrl) return board
    if (url === firstJobUrl) return detail(url)
    throw new Error('HTTP 403 on remaining detail')
  } }), /HTTP 403/)
  const reason = new Error('Source cancelled')
  await assert.rejects(createNeudesicTechnologiesScraper().run({ signal: AbortSignal.abort(reason), fetchText: async () => {
    assert.fail('Cancelled source must not fetch')
  } }), (error) => error === reason)
})
