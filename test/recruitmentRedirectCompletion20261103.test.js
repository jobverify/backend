import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'
const source = { source: 'redirect-example', companyName: 'Example', companyDomain: 'example.test',
  companyCareerPage: 'https://example.test/careers', allowVerifiedCorporateRedirects: true, requireCorporateIdentityMatch: true }
const board = 'https://example.wd1.myworkdayjobs.com/External'
const path = '/job/Bengaluru/Engineer_R1'
const description = '<p>Develop and maintain production software services, collaborate with engineering teams, review API designs and improve the reliability and performance of distributed systems.</p>'
const native = { hiringOrganization: { name: 'Example' }, jobPostingInfo: { title: 'Software Engineer', jobReqId: 'R1',
  country: { descriptor: 'India' }, externalUrl: board + path, jobDescription: description } }
const run = (finalURL, html, config = source) => createVerifiedRecruitmentScraper(config).run({
  fetchPage: async url => ({ status: 200, url: url === source.companyCareerPage ? finalURL : url,
    html: url === source.companyCareerPage ? html : '<h1>Example</h1>' }),
  fetchJson: async url => url.endsWith('/jobs') ? { total: 1, jobPostings: [{ externalPath: path, title: native.jobPostingInfo.title, locationsText: 'Bengaluru, India' }] } : native,
})

test('a registered corporate careers redirect can declare its exact current native account', async () => {
  const jobs = await run(board, '<title>Careers</title>')
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, board + path)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].verifiedCorporateRedirects[0].finalURL, board)
  assert.equal(jobs[0].sourceScopeComplete, false)
})

test('a renamed corporate domain must identify the same publisher before it can delegate', async () => {
  const jobs = await run('https://example-new.test/careers', `<title>Example Careers</title><h1>Example</h1><a href="${board}">Open jobs</a>`)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].verifiedCorporateRedirects[0].method, 'current-same-publisher-corporate-redirect')
})

test('an unrelated publisher or sign-in redirect cannot extend recruitment authority', async () => {
  for (const [url, html] of [['https://other.test/', `<title>Another Company</title><a href="${board}">Careers</a>`],
    ['https://login.example-other.test/', '<title>Sign in</title>']]) {
    await assert.rejects(run(url, html), error => error.failureKind === 'coverage_gap'
      && error.recruitmentObservations.failures.some(failure => /redirect changed authority/.test(failure.message)))
  }
})

test('sources without reviewed redirect discovery retain the original authority boundary', async () => {
  await assert.rejects(run(board, '<title>Careers</title>', { ...source, allowVerifiedCorporateRedirects: false }), error => error.failureKind === 'coverage_gap')
})

test('an acquisition article mentioning the old brand cannot identify a new corporate publisher', async () => {
  await assert.rejects(run('https://parent.test/acquisitions/example', `<title>Parent completes acquisition of Example</title><h1>Parent completes acquisition of Example</h1><a href="${board}">Careers</a>`), error => error.failureKind === 'coverage_gap')
})

test('a current company-declared careers link can redirect to its native account', async () => {
  const linked = 'https://example.test/career-opportunities'
  const jobs = await createVerifiedRecruitmentScraper(source).run({ fetchPage: async url => ({ status: 200,
    url: url === linked ? board : url, html: url === source.companyCareerPage ? `<h1>Example Careers</h1><a href="${linked}">Open jobs</a>` : '<h1>Example</h1>' }),
    fetchJson: async url => url.endsWith('/jobs') ? { total: 1, jobPostings: [{ externalPath: path, title: native.jobPostingInfo.title, locationsText: 'Bengaluru, India' }] } : native })
  assert.equal(jobs.length, 1)
})
