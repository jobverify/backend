import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import * as hexaview from '../../scraper/hexaviewtechnologies/script.js'

const fixture = name => gunzipSync(readFileSync(new URL(`./fixtures/hexaview/${name}.html.gz`, import.meta.url))).toString()
const base = 'https://www.hexaviewtech.com/job-openings/'
const roles = ['senior-business-manager-noida', 'senior-net-developer']
const landing = '<h1>Join Team of Innovators</h1><h2>Build the Best Work of Your Life</h2><a href="/job-listing">Jobs</a>'
const replay = (options = {}) => hexaview.run({
  fetchText: async url => url === hexaview.CAREERS_URL ? landing : fixture(url.includes('page=2') ? 'listing-2' : 'listing-1'),
  fetchDetail: async url => {
    const slug = roles.find(slug => base + slug === url)
    if (!slug) throw new Error('Other seven role details are outside this captured fixture')
    return { status: 200, url, html: fixture(slug) }
  },
  now: () => '2026-10-29T18:24:00.000Z', ...options,
})

test('Hexaview generic hero layout hydrates each exact card/canonical/CMS role without borrowing recommendations', async () => {
  const jobs = await replay()
  assert.equal(jobs.length, 9)
  const manager = jobs.find(job => job.requisitionId === roles[0])
  assert.equal(manager.sourceDetailComplete, true)
  assert.match(manager.sourceDescription, /^Hexaview Technologies is seeking a Senior Business Manager/)
  assert.match(manager.sourceDescription, /B.Tech.\/MBA with 8–15 years of experience/)
  assert.match(manager.sourceDescription, /Send your updated resume to careers@hexaviewtech.com/)
  const dotnet = jobs.find(job => job.requisitionId === roles[1])
  assert.equal(dotnet.sourceDetailComplete, true)
  assert.match(dotnet.sourceDescription, /highly skilled Senior Software Engineer/)
  assert.match(dotnet.sourceDescription, /Proficiency in .NET, .NET Core, SQL Server, and Angular/)
  assert.equal(dotnet.sourceDetailNativeCopyCaveat, 'broader-narrative-title')
  for (const job of [manager, dotnet]) {
    assert.doesNotMatch(job.sourceDescription, /comprehensive QE strategies|Similar Opportunities|First Name|Transforms Ideas into Impact/)
    assert.equal(job.sourceDetailUrl, base + job.requisitionId)
    assert.equal(job.postingDate, null)
    assert.equal(job.closingDate, null)
    assert.equal(job.sourceDateEvidence, undefined)
  }
  assert.equal(jobs.filter(job => job.sourceDetailComplete).length, 2)
})

test('Hexaview requires exact canonical URL, CMS slug, one primary body, and no conflicting explicit role title', async () => {
  const original = fixture(roles[0])
  for (const changed of [
    original.replace('data-wf-item-slug="senior-business-manager-noida"', 'data-wf-item-slug="unrelated-role"'),
    original.replace('href="https://www.hexaviewtech.com/job-openings/senior-business-manager-noida" rel="canonical"', 'href="https://www.hexaviewtech.com/job-openings/unrelated-role" rel="canonical"'),
    original.replace('class="job-list-body block"', 'class="unverified-role-body"'),
    original.replace('class="job-list-body block">', 'class="job-list-body block"><h2 class="job-title">Automation QA Engineer</h2>'),
    original.replace('class="job-body-rich-text w-richtext">', 'class="job-body-rich-text w-richtext"><h2 class="job-title">Automation QA Engineer</h2>'),
    original.replace('class="job-list-body block">', 'class="job-list-body block"><div class="job-body-rich-text w-richtext"><p>Unrelated duplicate native body.</p></div>'),
  ]) {
    const jobs = await replay({ fetchDetail: async url => ({ status: 200, url, html: changed }) })
    const manager = jobs.find(job => job.requisitionId === roles[0])
    assert.equal(manager.sourceDescription, null)
    assert.equal(manager.sourceDetailComplete, false)
  }
})

test('Hexaview employer-card proof is required even when canonical native detail is reachable', async () => {
  const jobs = await replay({ fetchText: async url => url === hexaview.CAREERS_URL ? landing
    : fixture(url.includes('page=2') ? 'listing-2' : 'listing-1').replaceAll('class="job-company-name">Hexaview Technologies', 'class="job-company-name">Other Company') })
  assert.ok(jobs.every(job => job.sourceDetailComplete === false && job.sourceDescription === null))
})

test('Hexaview broader .NET narrative must be corroborated by its own requirements', async () => {
  const unrelated = fixture(roles[1]).replaceAll('.NET', 'DifferentStack').replaceAll('Entity Framework', 'Different ORM')
  const jobs = await replay({ fetchDetail: async url => ({ status: 200, url, html: unrelated }) })
  assert.equal(jobs.find(job => job.requisitionId === roles[1]).sourceDescription, null)
})

test('Hexaview keeps verified card identities but incomplete details after access failure or redirect', async () => {
  for (const fetchDetail of [
    async () => { throw new Error('network unavailable') },
    async url => ({ status: 403, url, html: fixture(roles[0]) }),
    async () => ({ status: 200, url: 'https://foreign.example/role', html: fixture(roles[0]) }),
  ]) {
    const jobs = await replay({ fetchDetail })
    assert.equal(jobs.length, 9)
    assert.equal(new Set(jobs.map(job => job.jobId)).size, 9)
    assert.ok(jobs.every(job => !job.sourceUrl.includes('undefined') && job.sourceDescription === null && job.sourceDetailComplete === false))
  }
})
