import { emptyNativeOptions } from './fixtures/workableSourceOptions.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const loadBharatXModule = async () => {
  try {
    return await import('../../scraper/bharatx/script.js')
  } catch {
    assert.fail('Expected BharatX scraper module at ../../scraper/bharatx/script.js')
  }
}

const officialCareersHtml = `
  <html>
    <head>
      <title>Careers - BharatX</title>
      <link rel="canonical" href="https://bharatx.tech/careers/">
    </head>
    <body>
      <h1>Join Us</h1>
      <h1>Build the future of credit</h1>
      <a href="https://apply.workable.com/bharatx/?lng=en">Check open roles</a>
    </body>
  </html>
`

const emptyJobsMarkdown = `# BharatX — All Open Positions

Last updated: 2026-07-13

Powered by Workable
`

const jobsMarkdownWithIndiaRole = `# BharatX — All Open Positions

- [Backend Engineer](https://apply.workable.com/bharatx/j/ABC123/) - Bengaluru, Karnataka, India

Powered by Workable
`

const jobsTableMarkdownWithIndiaRole = `# BharatX â€” All Open Positions

| Title | Department | Location | Type | Salary | Posted | Details |
|-------|------------|----------|------|--------|--------|---------|
| [Backend Engineer](https://apply.workable.com/bharatx/j/ABC123/) | Engineering | Bengaluru, Karnataka, India | Full-time | - | 2026-07-19 | [View](https://apply.workable.com/bharatx/j/ABC123/) |

Powered by Workable
`

test('BharatX keeps the verified official careers handoff explicit and understands an empty Workable board', async () => {
  const bharatx = await loadBharatXModule()

  assert.equal(bharatx.OFFICIAL_CAREERS_URL, 'https://bharatx.tech/careers/')
  assert.equal(bharatx.BOARD_URL, 'https://apply.workable.com/bharatx/?lng=en')
  assert.equal(bharatx.JOBS_FEED_URL, 'https://apply.workable.com/bharatx/jobs.md')
  assert.equal(bharatx.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.deepEqual(bharatx.extractJobsFromMarkdown(emptyJobsMarkdown), [])
  assert.equal(bharatx.extractJobsFromMarkdown(jobsTableMarkdownWithIndiaRole).length, 1)
})

test('BharatX factory reads the employer-bound native empty inventory and normalizes its clock', async () => {
  const bharatx = await loadBharatXModule()
  const opts = emptyNativeOptions('bharatx', 'BharatX', 'db2cc781-d7bb-431d-ba2d-62a131069447', bharatx.OFFICIAL_CAREERS_URL, officialCareersHtml)
  delete opts.now
  const jobs = await bharatx.createBharatXScraper({ now: () => new Date('2026-10-26T09:00:00.000Z') }).run(opts)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).verifiedAt, '2026-10-26T09:00:00.000Z')
})

test('BharatX rejects an absent current careers handoff before native requests', async () => {
  const bharatx = await loadBharatXModule()
  await assert.rejects(bharatx.createBharatXScraper().run({
    fetchPage: async url => ({ status: 200, url, html: '<h1>No careers handoff</h1>' }),
    fetchJson: async () => assert.fail('An unbound source cannot request native inventory'),
  }), /active full-board careers handoff/i)
})
