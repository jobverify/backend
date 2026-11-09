import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createLegacyCastrolIndiaScraper as createCastrolIndiaScraper,
  GREENHOUSE_BOARD_URL,
  GREENHOUSE_JOBS_URL,
} from '../../scraper/castrolindia/script.js'

const sitemap = '<title>Sitemap | Castrol India</title><a href="/en_in/india/home/about-castrol/careers.html">Careers</a>'
const careers = '<title>Careers | Castrol India</title><link rel="canonical" href="https://www.castrol.com/en_in/india/home/about-castrol/careers.html"><h1>Castrol careers in India</h1><p>Explore our latest vacancies</p><a href="https://job-boards.eu.greenhouse.io/castrol">Explore our jobs</a>'
const board = '<title>Jobs at Castrol</title><h1>Current positions at Castrol</h1><h2>2 jobs</h2>'
const payload = { jobs: [
  { id: 4986579101, title: 'Competitiveness Lead', location: { name: 'India - Pune' }, absolute_url: 'https://job-boards.eu.greenhouse.io/castrol/jobs/4986579101', departments: [{ name: 'Supply Chain' }], offices: [{ location: 'Pune, Maharashtra, India' }], content: '<p>Lead improvement projects.</p>' },
  { id: 4980349101, title: 'Accounting Analyst', location: { name: 'Hungary - Budapest' }, absolute_url: 'https://job-boards.eu.greenhouse.io/castrol/jobs/4980349101', departments: [], offices: [] },
] }

test('Castrol India follows its current official Greenhouse handoff and extracts only India jobs', async () => {
  assert.equal(GREENHOUSE_BOARD_URL, 'https://job-boards.eu.greenhouse.io/castrol')
  assert.equal(GREENHOUSE_JOBS_URL, 'https://boards-api.greenhouse.io/v1/boards/castrol/jobs?content=true')
  const requested = []
  const jobs = await createCastrolIndiaScraper().run({
    fetchPage: async (url) => {
      requested.push(url)
      if (url.endsWith('/sitemap.html')) return { status: 200, url, html: sitemap }
      if (url.endsWith('/careers.html')) return { status: 200, url, html: careers }
      if (url === GREENHOUSE_BOARD_URL) return { status: 200, url, html: board }
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchGreenhouseJobs: async (url) => {
      requested.push(url)
      return payload
    },
  })
  assert.deepEqual(requested.slice(2), [GREENHOUSE_BOARD_URL, GREENHOUSE_JOBS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Competitiveness Lead')
  assert.equal(jobs[0].location, 'India - Pune')
  assert.equal(jobs[0].city, 'Pune')
  assert.equal(jobs[0].department, 'Supply Chain')
  assert.equal(jobs[0].source, 'castrolindia')
  assert.equal(jobs[0].applyUrl, payload.jobs[0].absolute_url)
  assert.equal(jobs[0].jobDescription, 'Lead improvement projects.')
})

test('Castrol India rejects a foreign board URL in its public feed', async () => {
  await assert.rejects(createCastrolIndiaScraper().run({
    fetchPage: async (url) => ({ status: 200, url, html: url.endsWith('/sitemap.html') ? sitemap : url.endsWith('/careers.html') ? careers : board }),
    fetchGreenhouseJobs: async () => ({ jobs: [{ ...payload.jobs[0], absolute_url: 'https://example.com/jobs/4986579101' }] }),
  }), /Castrol Greenhouse board/i)
})
