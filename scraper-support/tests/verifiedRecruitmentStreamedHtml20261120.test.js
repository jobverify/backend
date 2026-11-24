import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const runtime = readFileSync(new URL('./fixtures/recruitment-streaming/react-runtime-20261120.txt', import.meta.url), 'utf8')
const board = 'https://jobs.ashbyhq.com/streamed-fixture'
const link = '<a href="' + board + '">Open jobs</a>'
const boundary = '<!--$?--><template id="B:0"></template><!--/$-->'
const segment = content => '<div hidden id="S:0">' + content + '</div>'
const script = body => '<script>' + body + '</script>'
const complete = script(runtime + '$RC("B:0","S:0")')
const config = { source: 'streamed-fixture', companyName: 'Example Employer', companyDomain: 'employer.test',
  companyCareerPage: 'https://employer.test/careers', requireCorporateIdentityMatch: true,
  discoverRecruitmentLinks: true, discoverLiteralRecruitmentData: true }
const description = '<p>Build production software services, investigate failures, review engineering designs, maintain reliable APIs and work with the engineering team on delivery.</p>'
const native = { id: 'current-india-role', title: 'Software Engineer', isListed: true,
  location: 'Bengaluru, India', address: { postalAddress: { addressCountry: 'IN', addressLocality: 'Bengaluru' } },
  descriptionHtml: description, jobUrl: board + '/current-india-role', applyUrl: board + '/current-india-role/application' }
const run = (html, records = [native]) => createVerifiedRecruitmentScraper(config).run({
  fetchPage: async url => {
    assert.ok([config.companyCareerPage, 'https://employer.test/'].includes(url), 'Only registered corporate pages are read: ' + url)
    return { status: 200, url, html: '<title>Example Employer</title>' + (url === config.companyCareerPage ? html : '') }
  },
  fetchJson: async url => {
    assert.equal(url, 'https://api.ashbyhq.com/posting-api/job-board/streamed-fixture')
    return { apiVersion: '1', jobs: records }
  },
})
const noBoard = async html => assert.rejects(run(html), error => {
  assert.equal(error.failureKind, 'coverage_gap')
  assert.equal(error.recruitmentObservations.boards.length, 0)
  assert.equal(error.recruitmentObservations.nativeRecords, 0)
  return true
})

test('completed native React stream declares the exact current board and acquires its India role', async () => {
  const html = boundary + segment('<h1>Current careers</h1>' + link) + complete
  const jobs = await run(html)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'current-india-role')
  assert.equal(jobs[0].country, 'IN')
  assert.equal(jobs[0].sourceDescription, description)
  assert.deepEqual(jobs[0].officialAtsBinding.matchedLinks, [board])
  assert.equal(jobs[0].officialAtsBinding.officialURL, config.companyCareerPage)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].receipts.find(receipt => receipt.requestedURL === config.companyCareerPage).bodySHA256,
    createHash('sha256').update('<title>Example Employer</title>' + html).digest('hex'))
})

for (const [name, html] of [
  ['unfinished stream', boundary + segment(link)],
  ['missing segment', boundary + complete],
  ['missing boundary', segment(link) + complete],
  ['duplicate segment', boundary + segment(link) + segment(link) + complete],
  ['duplicate boundary', boundary + boundary + segment(link) + complete],
  ['inert completion script', boundary + segment(link) + '<template>' + complete + '</template>'],
  ['unclosed completion script', boundary + segment(link) + complete.replace('</script>', '')],
  ['unrelated completion function', boundary + segment(link) + script('function $RC(){};$RC("B:0","S:0")')],
  ['modified completion runtime', boundary + segment(link) + script(runtime.replace('g.data="$"', 'g.data="unreviewed"') + '$RC("B:0","S:0")')],
  ['conditional completion call', boundary + segment(link) + script(runtime + 'if(false)$RC("B:0","S:0")')],
  ['inactive fallback container', '<template>' + boundary + '</template>' + segment(link) + complete],
  ['boundary hidden by ancestor', '<div hidden>' + boundary + '</div>' + segment(link) + complete],
  ['boundary hidden by style', '<div style="display:none">' + boundary + '</div>' + segment(link) + complete],
  ['content hidden by its own style', boundary + segment('<div style="visibility:hidden">' + link + '</div>') + complete],
  ['content kept inert', boundary + segment('<div inert>' + link + '</div>') + complete],
  ['nonempty pending fallback', boundary.replace('<!--/$-->', '<p>Loading careers</p><!--/$-->') + segment(link) + complete],
]) test(name + ' cannot authorize a native board', async () => noBoard(html))

test('a later segment cannot become received evidence after earlier stream offsets shrink', async () => {
  const first = '<!--$?-->' + ' '.repeat(2000) + '<template id="B:0"></template><!--/$-->'
    + segment('<p>Current careers</p>') + complete
  const later = boundary.replaceAll('B:0', 'B:1') + script('$RC("B:1","S:1")')
    + segment(link).replaceAll('S:0', 'S:1')
  await noBoard(first + later)
})

test('a completed stream cannot change the native account in the returned posting', async () => {
  let jobs
  try { jobs = await run(boundary + segment(link) + complete, [{ ...native,
    jobUrl: 'https://jobs.ashbyhq.com/foreign/current-india-role',
    applyUrl: 'https://jobs.ashbyhq.com/foreign/current-india-role/application' }]) }
  catch (error) { assert.equal(error.failureKind, 'coverage_gap'); jobs = [] }
  assert.equal(jobs.length, 0)
  assert.notEqual(readInventoryEvidence(jobs)?.status, 'verified-empty')
})

test('current Alma transport content exposes its advertised account while a retired board remains unavailable', async () => {
  const html = gunzipSync(readFileSync(new URL('./fixtures/recruitment-streaming/alma-careers-20261120.html.gz', import.meta.url))).toString('utf8')
  const alma = { ...config, source: 'alma', companyName: 'Alma', companyDomain: 'helloalma.com',
    companyCareerPage: 'https://helloalma.com/careers/' }
  await assert.rejects(createVerifiedRecruitmentScraper(alma).run({
    fetchPage: async url => ({ status: 200, url, html: url === alma.companyCareerPage ? html : '<title>Alma</title>' }),
    fetchImpl: async url => {
      assert.equal(url, 'https://boards-api.greenhouse.io/v1/boards/alma/jobs?content=true')
      return { url, status: 404, headers: new Headers({ 'content-type': 'application/json' }),
        body: new Blob(['{"status":404,"error":"Board not found"}']).stream() }
    },
  }), error => {
    assert.equal(error.failureKind, 'coverage_gap')
    assert.equal(error.recruitmentObservations.boards[0]?.token, 'alma')
    assert.equal(error.recruitmentObservations.nativeInventoryReads.length, 0)
    assert.equal(error.recruitmentObservations.returnedIndiaJobs, 0)
    assert.equal(error.recruitmentObservations.failures[0].status, 404)
    return true
  })
})
