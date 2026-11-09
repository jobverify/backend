import assert from 'node:assert/strict'
import test from 'node:test'
import { createCourtclikScraper } from '../../scraper/courtclik/script.js'

const home = "<title>Court Click (CourtClick) — Case Tracking App for India</title><link rel=\"canonical\" href=\"https://www.courtclick.com\"/><meta property=\"og:title\" content=\"Court Click (CourtClick) — Case Tracking App for India\"/><p>Manage Your Legal Journey Anytime, Anywhere</p><p>Court Click is a modern legal-tech platform designed to simplify how people track &amp; manage court cases</p><footer>Digilaw Legal Software Pvt Ltd. Doing Business as Court Click</footer>"
const career = "<title>Careers at Court Click — Join Our Legal-Tech Team</title><link rel=\"canonical\" href=\"https://www.courtclick.com/career\"/><meta name=\"description\" content=\"Explore open roles at Court Click. Join our mission to transform India&#x27;s legal-tech industry. See current openings and apply today.\"/><h1>Build the future of LegalTech</h1><p>Join a team building a more accessible, transparent, and efficient legal system for everyone.</p><h2>Open roles at Court Click</h2><p>Explore opportunities to grow, build, and make real impact.</p><div class=\"open-roles\"><input placeholder=\"Search for job roles\"/>No roles found</div><footer>Digilaw Legal Software Pvt Ltd. Doing Business as Court Click</footer>"
const inventory = [{"id":"uiux","title":"UI/UX Designer","description":"Design intuitive and visually appealing user experiences for Court Click's mobile and web platforms.","keyRequirements":"Proficiency in Figma or similar tools, Strong understanding of design systems and accessibility, Portfolio showcasing user-centric designs","tags":{"type":"On-Site","location":"Kerala (Kochi)","mode":"Full time"}},{"id":"fullstack","title":"Full Stack Developer","description":"Build and maintain scalable, high-performance applications for both web and mobile platforms.","keyRequirements":"Experience with React, Node.js and MongoDB, Understanding of API integrations, Problem Solving","tags":{"type":"On-Site","location":"Kerala (Kochi)","mode":"Full time"}},{"id":"legaldata","title":"Legal Data Analyst","description":"Analyse, structure, and manage legal data to improve the accuracy of real-time court updates.","keyRequirements":"Background in law or legal research, Strong data analysis skills (Excel, SQL preferred), Attention to detail and accuracy","tags":{"type":"On-Site","location":"Kerala (Kochi)","mode":"Full time"}}]
const fixtureRun = (jobs = inventory, overrides = {}) => createCourtclikScraper().run({
  fetchPage: async url => {
    if (url === 'https://www.courtclick.com/') return { status: 200, url, html: overrides.home ?? home }
    if (url === 'https://www.courtclick.com/career') return { status: 200, url, html: overrides.career ?? career }
    if (url === 'https://www.courtclick.com/api/careers') return { status: overrides.status ?? 200, url: overrides.url ?? url, html: JSON.stringify(jobs) }
    throw Error('Unexpected URL: ' + url)
  },
})

test('Court Click extracts API roles even when server HTML displays the initial No roles found state', async () => {
  const jobs = await fixtureRun()
  assert.deepEqual(jobs.map(job => job.jobId), ['uiux', 'fullstack', 'legaldata'])
  assert.deepEqual(jobs.map(job => job.city), ['Kochi', 'Kochi', 'Kochi'])
  assert.ok(jobs.every(job => job.country === 'India' && job.source === 'courtclik'))
  assert.equal(jobs[0].applyUrl, 'https://www.courtclick.com/career')
  assert.match(jobs[0].jobDescription, /Figma/)
})

test('Court Click accepts an explicitly empty API inventory after validating the official pages', async () => {
  assert.deepEqual(await fixtureRun([]), [])
})

test('Court Click rejects malformed, duplicate, blocked and off-host API inventories', async () => {
  for (const [jobs, overrides] of [
    [{ error: 'No Access' }, {}],
    [[inventory[0], inventory[0]], {}],
    [[{ ...inventory[0], id: null }], {}],
    [[{ ...inventory[0], tags: {} }], {}],
    [[], { status: 503 }],
    [[], { url: 'https://other.example/api/careers' }],
  ]) await assert.rejects(fixtureRun(jobs, overrides), /Courtclik careers API/)
})

test('Court Click preserves official identity checks and excludes foreign or ambiguous locations', async () => {
  await assert.rejects(fixtureRun(inventory, { home: home.replace('https://www.courtclick.com', 'https://other.example') }), /homepage/)
  await assert.rejects(fixtureRun(inventory, { career: career.replace('Digilaw Legal Software', 'Unrelated Company') }), /careers page/)
  assert.deepEqual(await fixtureRun([{ ...inventory[0], tags: { ...inventory[0].tags, location: 'London, United Kingdom' } }]), [])
  await assert.rejects(fixtureRun([{ ...inventory[0], tags: { ...inventory[0].tags, location: 'Remote' } }]), /Courtclik careers API.*location/)
})
