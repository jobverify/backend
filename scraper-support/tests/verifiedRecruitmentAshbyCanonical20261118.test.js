import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../utils/verifiedRecruitment.js'

const config = { source: 'ashby-case-fixture', companyName: 'Example Employer', companyDomain: 'employer.test',
  companyCareerPage: 'https://employer.test/careers', requireCorporateIdentityMatch: true }
const description = '<p>Design and maintain production software services, review API contracts, investigate distributed system failures, and collaborate with the product engineering team.</p>'
const row = { id: 'current-role', title: 'Software Engineer', isListed: true, location: 'Bengaluru, India',
  address: { postalAddress: { addressCountry: 'IN', addressLocality: 'Bengaluru' } }, descriptionHtml: description,
  jobUrl: 'https://jobs.ashbyhq.com/Example/current-role',
  applyUrl: 'https://jobs.ashbyhq.com/Example/current-role/application' }
const run = ({ canonical = 'https://jobs.ashbyhq.com/Example', records = [row], extraMetadata = '', inert = false,
  redirect = false } = {}) => createVerifiedRecruitmentScraper(config).run({
  fetchPage: async url => {
    if (url === 'https://jobs.ashbyhq.com/example') {
      const metadata = '<meta property="og:url" content="' + canonical + '">' + extraMetadata
      return { status: 200, url: redirect ? 'https://jobs.ashbyhq.com/Example' : url,
        html: inert ? '<template>' + metadata + '</template>' : metadata }
    }
    assert.ok(['https://employer.test/', config.companyCareerPage].includes(url), 'No foreign page request: ' + url)
    return { status: 200, url, html: '<title>Example Employer</title>'
      + (url === config.companyCareerPage ? '<a href="https://jobs.ashbyhq.com/example">Open jobs</a>' : '') }
  },
  fetchJson: async url => {
    assert.ok(['https://api.ashbyhq.com/posting-api/job-board/example',
      'https://api.ashbyhq.com/posting-api/job-board/Example'].includes(url), 'No foreign account request: ' + url)
    return { apiVersion: '1', jobs: records }
  },
})

for (const redirect of [false, true]) {
  test('current native canonical declaration reconciles an advertised Ashby case alias: redirect=' + redirect, async () => {
    const jobs = await run({ redirect })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobId, 'current-role')
    assert.equal(jobs.nativeCollectionEvidence.nativeBoards[0].nativeRecords[0].jobUrl, row.jobUrl)
    const binding = jobs[0].officialAtsBinding
    assert.deepEqual(binding.matchedLinks, ['https://jobs.ashbyhq.com/example'])
    assert.equal(binding.nativeBoardCanonicalEvidence.canonicalBoardUrl, 'https://jobs.ashbyhq.com/Example')
    assert.equal(binding.nativeBoardCanonicalEvidence.handoffUrl, 'https://jobs.ashbyhq.com/example')
    assert.equal(jobs[RECRUITMENT_OBSERVATIONS].boards[0].token, 'Example')
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  })
}

for (const options of [{ canonical: 'https://jobs.ashbyhq.com/Other' }, { canonical: '' },
  { extraMetadata: '<meta property="og:url" content="https://jobs.ashbyhq.com/Example">' }, { inert: true },
  { records: [row, { ...row, id: 'second', jobUrl: 'https://jobs.ashbyhq.com/EXAMPLE/second',
    applyUrl: 'https://jobs.ashbyhq.com/EXAMPLE/second/application' }] },
  { records: [{ ...row, jobUrl: 'https://jobs.ashbyhq.com/unrelated/current-role',
    applyUrl: 'https://jobs.ashbyhq.com/unrelated/current-role/application' }] }]) {
  test('unqualified Ashby account changes cannot yield selected jobs: ' + JSON.stringify(options).slice(0, 100), async () => {
    let jobs, observations
    try { jobs = await run(options); observations = jobs[RECRUITMENT_OBSERVATIONS] }
    catch (error) { jobs = []; observations = error.recruitmentObservations }
    assert.equal(jobs.length, 0)
    assert.equal(observations.nativeInventoryReads.length, 0)
    assert.equal(observations.failures.length, 1)
  })
}
