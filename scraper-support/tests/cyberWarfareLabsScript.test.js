import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { CAREERS_URL, CAREERS_API_URL, createCyberWarfareLabsScraper, extractCareerJobs } from '../../scraper/cyberwarfarelabs/script.js'

const payload = {
  success: true,
  data: [
    { _id: '6a4b5cac378927855d00caf5', title: 'Security Intern (RED TEAM)', description: 'Perform vulnerability assessments and support red team operations.', position: 'Intern', jd: 'Security-Intern.pdf', location: 'Remote', team: 'red', joining: 'Immediately', isActive: true },
    { _id: '6a4b5cac378927855d00caf6', title: 'AI security intern (Offensive side)', description: 'Conduct AI security research and LLM red teaming.', position: 'Intern', jd: 'AI-Offensive-Security-Intern.pdf', location: 'Remote', team: 'red', joining: 'Immediately', isActive: true },
  ],
}

test('catalog registers CyberWarFare Labs against its current first-party careers API', () => {
  const provider = getScraperCatalog().find(item => item.source === 'cyberwarfarelabs')
  assert.ok(provider)
  assert.equal(provider.companyName, 'CyberWarFare Labs')
  assert.equal(provider.companyCareerPage, CAREERS_URL)
  assert.equal(provider.companyDomain, 'cyberwarfare.live')
  assert.equal(provider.extractionStrategy, 'official-spa-careers-api+verified-india-remote-jds+email-application')
  assert.ok(buildScrapers().find(scraper => scraper.name === 'cyberwarfarelabs'))
})

test('extractCareerJobs maps the current two active remote internships', () => {
  const jobs = extractCareerJobs(payload)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobId, '6a4b5cac378927855d00caf5')
  assert.equal(jobs[0].location, 'Remote, India')
  assert.equal(jobs[0].city, null)
  assert.equal(jobs[0].employmentType, 'Internship')
  assert.equal(jobs[0].sourceUrl, 'https://cwl-main-website.s3.us-east-1.amazonaws.com/files/Security-Intern.pdf')
  assert.equal(jobs[0].applyUrl, 'mailto:careers@cyberwarfare.live?subject=Application%20for%20Security%20Intern%20(RED%20TEAM)')
})

test('run fetches and validates the official careers API', async () => {
  const jobs = await createCyberWarfareLabsScraper().run({
    fetchJson: async url => { assert.equal(url, CAREERS_API_URL); return payload },
    now: () => '2026-10-03T00:00:00.000Z',
  })
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'cyberwarfarelabs')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-10-03T00:00:00.000Z')
})

test('run records verified empty inventory and rejects unknown remote locations', async () => {
  const jobs = await createCyberWarfareLabsScraper().run({
    fetchJson: async () => ({ success: true, data: [] }),
    now: () => '2026-10-03T00:00:00.000Z',
  })
  assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
  await assert.rejects(createCyberWarfareLabsScraper().run({
    fetchJson: async () => ({ success: true, data: [{ ...payload.data[0], jd: 'Unknown.pdf' }] }),
  }), /unverified India location/i)
  await assert.rejects(createCyberWarfareLabsScraper().run({
    fetchJson: async () => ({ success: true, data: [...payload.data, payload.data[0]] }),
  }), /duplicate/i)
})
