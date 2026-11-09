import assert from 'node:assert/strict'
import test from 'node:test'

import { CAREERS_URL, createThinkbridgeScraper, extractJobCards, hasOfficialCareersSignal } from '../../scraper/thinkbridge/script.js'

const careersHtml = `
<html><head><title>Careers at thinkbridge | Remote-first engineering work</title></head><body>
<h2>Open roles.</h2><p>1 open roles, 0 of them remote. Each has its own page with the full description.</p>
<ul class="roles-list"><li data-loc="onsite" data-q="senior full-stack engineer surat city gujarat india">
<a class="role" href="careers/senior-full-stack-engineer-475"><span class="role-t">Senior Full-Stack Engineer</span>
<span class="role-m">Surat City, Gujarat, India &middot; Full time &middot; 5-7 years experience</span>
<span class="role-go">View role</span></a></li></ul>
</body></html>`

const detailUrl = 'https://www.thinkbridge.com/careers/senior-full-stack-engineer-475'
const applyUrl = 'https://careers.thinkbridge.com/jobs/Careers/40078000018670788/Senior-Full-Stack-Engineer?source=CareerSite'
const detailHtml = `<html><head><title>Senior Full-Stack Engineer job | thinkbridge</title>
<meta name="description" content="Build the systems growing companies run on.">
<link rel="canonical" href="${detailUrl}"></head><body><h1>Senior Full-Stack Engineer</h1>
<a class="btn btn-ink" href="${applyUrl}" data-apply="40078000018670788" data-job="Senior Full-Stack Engineer">Apply for this role</a>
</body></html>`

test('thinkbridge reads current first-party roles and verified application links', async () => {
  assert.equal(CAREERS_URL, 'https://www.thinkbridge.com/careers')
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(extractJobCards(careersHtml).length, 1)

  const jobs = await createThinkbridgeScraper({ now: () => '2026-10-03T00:00:00.000Z' }).run({
    fetchText: async (url) => {
      if (url === CAREERS_URL) return careersHtml
      if (url === detailUrl) return detailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Full-Stack Engineer')
  assert.equal(jobs[0].location, 'Surat City, Gujarat, India')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].applyUrl, applyUrl)
  assert.equal(jobs[0].jobDescription, 'Build the systems growing companies run on.')
  assert.equal(jobs[0].scrapedAt, '2026-10-03T00:00:00.000Z')
})

test('thinkbridge rejects incomplete role lists and mismatched details', async () => {
  await assert.rejects(createThinkbridgeScraper().run({
    fetchText: async () => careersHtml.replace('1 open roles', '2 open roles'),
  }), /job-search page changed materially/i)

  await assert.rejects(createThinkbridgeScraper().run({
    fetchText: async (url) => url === CAREERS_URL ? careersHtml : detailHtml.replace('Senior Full-Stack Engineer job', 'Other job'),
  }), /detail page changed materially/i)
})
