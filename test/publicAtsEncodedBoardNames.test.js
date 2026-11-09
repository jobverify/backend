import assert from 'node:assert/strict'
import test from 'node:test'

import { identifyPublicAtsBoard, hasMatchingPublicAtsBinding } from '../scraper-support/utils/publicAtsIdentity.js'
import { createOfficialAtsRecoveryScraper, OFFICIAL_ATS_DISCOVERY } from '../scraper-support/utils/officialAtsRecovery.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

// Synthetic native records isolate URL identity and discovery. The named live
// sources have separate captured-response tests; these are not live job claims.
const board = 'Fixture Employer'
const encodedBoard = encodeURIComponent(board)
const id = 'c6bc85e9-4991-4aba-a5f3-4c523a00a561'
const provider = { source: 'fixture', companyName: 'Fixture Employer', companyDomain: 'employer.test',
  companyCareerPage: 'https://employer.test/careers', sourceScopeComplete: false }
const native = { id, title: 'Software Engineer', location: 'Bengaluru, India',
  address: { postalAddress: { addressCountry: 'IN', addressLocality: 'Bengaluru' } },
  jobUrl: `https://jobs.ashbyhq.com/${encodedBoard}/${id}`,
  applyUrl: `https://jobs.ashbyhq.com/${encodedBoard}/${id}/application`, isListed: true,
  descriptionHtml: '<p>Build and operate production software services, review API designs, and investigate distributed system failures.</p>' }

test('Ashby identities decode a single path component and preserve board-name case', () => {
  for (const url of [`https://jobs.ashbyhq.com/${encodedBoard}`,
    `https://jobs.ashbyhq.com/${encodedBoard}/${id}`,
    `https://api.ashbyhq.com/posting-api/job-board/${encodedBoard}`]) {
    assert.deepEqual(identifyPublicAtsBoard(url), { atsPlatform: 'ashby', boardToken: board })
  }
  assert.equal(hasMatchingPublicAtsBinding({ atsPlatform: 'ashby', boardToken: board,
    bindingEvidence: { verified: true, matchedLinks: [`https://jobs.ashbyhq.com/${encodedBoard}`] } }), true)
})

test('encoded separators, controls, double encoding and malformed escapes never become board names', () => {
  for (const token of ['Fixture%2FEmployer', 'Fixture%5CEmployer', 'Fixture%00Employer',
    'Fixture%09Employer', 'Fixture%2520Employer', 'Fixture%ZZEmployer', 'Fixture%20', '%20Fixture']) {
    assert.equal(identifyPublicAtsBoard(`https://jobs.ashbyhq.com/${token}`), null, token)
  }
  for (const host of ['jobs.lever.co', 'job-boards.greenhouse.io']) {
    assert.equal(identifyPublicAtsBoard(`https://${host}/${encodedBoard}`), null, host)
  }
})

for (const [method, html] of [
  ['root board link', `<a href="https://jobs.ashbyhq.com/${encodedBoard}">Open roles</a>`],
  ['active embed', `<div id="ashby_embed"></div><script src="https://jobs.ashbyhq.com/${encodedBoard}/embed"></script>`],
  ['native posting link', `<a href="https://jobs.ashbyhq.com/${encodedBoard}/${id}">Software Engineer</a>`],
]) {
  test(`encoded Ashby ${method} reaches the exact native inventory and retains India scope`, async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Regression tests must not use live HTTP'))
    const requests = []
    const jobs = await createOfficialAtsRecoveryScraper(provider).run({
      fetchPage: async url => ({ status: url === provider.companyCareerPage ? 200 : 404, url,
        html: url === provider.companyCareerPage ? html : '' }),
      fetchJson: async url => {
        requests.push(url)
        assert.equal(url, `https://api.ashbyhq.com/posting-api/job-board/${encodedBoard}`)
        return { apiVersion: '1', jobs: [native] }
      },
    })
    assert.equal(requests.length, 1)
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].source, provider.source)
    assert.equal(jobs[0].applyUrl, native.applyUrl)
    assert.equal(jobs[0].jobDescription, native.descriptionHtml)
    assert.equal(jobs[OFFICIAL_ATS_DISCOVERY].boards[0].boardToken, board)
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  })
}
