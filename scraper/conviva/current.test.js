import assert from 'node:assert/strict'
import test from 'node:test'
import { run, normalizeGreenhouseJobUrl } from './script.js'
const html = '<title>Careers | Conviva</title><link href="https://www.conviva.ai/careers" rel="canonical"><h1>We work with the best</h1><section id="openings"><div id="grnhse_app"></div><script src="https://boards.greenhouse.io/embed/job_board/js?for=conviva"></script></section>'
const payload = { jobs: [{ id: 8004215003, title: 'Product Support Engineer ', company_name: 'Conviva',
 location: { name: 'Bengaluru, India' }, absolute_url: 'https://job-boards.greenhouse.io/conviva/jobs/8004215003',
 content: '<p>Support analytics products and solve complex technical problems.</p>' }] }
test('current Conviva page and native Greenhouse job links reconcile after the website migration', async () => {
 const jobs = await run({ fetchText: async () => html, fetchJson: async () => payload })
 assert.equal(jobs.length, 1)
 assert.equal(jobs[0].applyUrl, payload.jobs[0].absolute_url)
 assert.equal(jobs[0].country, 'India')
})
test('Conviva cannot substitute another Greenhouse tenant or requisition', async () => {
 assert.equal(normalizeGreenhouseJobUrl('https://job-boards.greenhouse.io/other/jobs/8004215003', 8004215003), null)
 assert.equal(normalizeGreenhouseJobUrl(payload.jobs[0].absolute_url, 123), null)
 await assert.rejects(run({ fetchText: async () => html.replace('for=conviva', 'for=other'), fetchJson: async () => payload }))
})
