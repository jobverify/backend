import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScrapers } from '../../scraper-support/providers/index.js'
import { CAREERS_URL, extractJobs } from './script.js'
const scraper = buildScrapers().find(item => item.name === 'winmansoftware')
const page = application => '<title>Careers for Experience Candidates - Winman Software</title><table id="experienced_table"><tr><th>Designation and Job Profile</th><th>Experience</th></tr><tr><td><h5>Senior Accountant</h5>Overseeing the finalisation of accounts.</td><td>CA Articleship completed</td></tr><tr><td><h5>Electrical Maintenance Supervisor</h5>Supervising maintenance of electrical systems.</td><td>2 years</td></tr></table>' + application
for (const url of ['https://winman.in/jobs/resume.aspx', 'https://winman.in/jobs/resumedetail.aspx']) {
  for (const [name, body, accept] of [
    ['plain-label', 'Apply now', true],
    ['ordinary-nested-label', '<span>Apply now</span>', true],
    ['active-label-click-handler', '<span onclick="event.preventDefault()">Apply now</span>', false],
    ['higher-active-label-handler', '<span onclick="event.preventDefault()"><strong>Apply now</strong></span>', false],
    ['handler-word-inside-data', '<span data-note="onclick=event.preventDefault()">Apply now</span>', true],
    ['hidden-descendant-handler', '<span hidden onclick="event.preventDefault()">Hidden</span>Apply now', true],
    ['inert-descendant-handler', '<template><span onclick="event.preventDefault()">Hidden</span></template>Apply now', true],
    ['deep-plain-label', '<span><strong>Apply now</strong></span>', true],
    ['CSS-hidden-descendant-handler', '<style>.controlled-label-hidden{display:none}</style><span class="controlled-label-hidden" onclick="event.preventDefault()">Hidden</span>Apply now', true],
    ['ARIA-hidden-descendant-handler', '<span aria-hidden="true" onclick="event.preventDefault()">Hidden</span>Apply now', true],
    ['HTML-inert-descendant-handler', '<span inert onclick="event.preventDefault()">Hidden</span>Apply now', true],
  ]) test('Winman descendant binding ' + name + ':' + url, async () => {
    const html = page('<a href="' + url + '">' + body + '</a>'), calls = []
    const evaluate = async action => { try { return { accepted: true, jobs: await action() } } catch { return { accepted: false } } }
    const direct = await evaluate(() => extractJobs(html)), registered = await evaluate(() => scraper.run({ fetchText: async route => { calls.push(route); return html } }))
    assert.deepEqual(calls, [CAREERS_URL])
    assert.deepEqual({ direct: direct.accepted, registered: registered.accepted }, { direct: accept, registered: accept })
    if (accept) for (const result of [direct, registered]) {
      assert.equal(result.jobs.length, 2); assert.deepEqual(result.jobs.map(job => job.applyUrl), [url, url])
      assert.ok(result.jobs.every(job => job.country === null && job.city === null && job.location === null))
    }
  })
}
