import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const config = { source: 'active-navigation-fixture', companyName: 'Example Employer',
  companyDomain: 'employer.test', companyCareerPage: 'https://employer.test/careers',
  requireCorporateIdentityMatch: true, discoverRecruitmentLinks: true }
const description = '<p>Design and maintain production software services, review API contracts, investigate distributed system failures, and collaborate with the product engineering team.</p>'
const nativeRow = { id: 'current-role', title: 'Software Engineer', isListed: true,
  location: 'Bengaluru, India', address: { postalAddress: { addressCountry: 'IN', addressLocality: 'Bengaluru' } },
  descriptionHtml: description, jobUrl: 'https://jobs.ashbyhq.com/fixture/current-role',
  applyUrl: 'https://jobs.ashbyhq.com/fixture/current-role/application' }
const button = '<button onclick="window.open(\'https://jobs.ashbyhq.com/fixture\', \'_blank\')">View job postings</button>'
const run = (html, title = config.companyName) => createVerifiedRecruitmentScraper(config).run({
  fetchPage: async url => ({ status: 200, url, html: '<title>' + title + '</title>'
    + (url === config.companyCareerPage ? html : '') }),
  fetchJson: async url => {
    assert.equal(url, 'https://api.ashbyhq.com/posting-api/job-board/fixture')
    return { apiVersion: '1', jobs: [nativeRow] }
  },
})

test('an identified corporate careers button binds its current native board and acquires its India posting', async () => {
  const jobs = await run(button)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'current-role')
  assert.equal(jobs[0].country, 'IN')
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].boards[0].bindingEvidence.officialURL, config.companyCareerPage)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('an active navigation declaration cannot bypass current corporate publisher identity', async () => {
  await assert.rejects(run(button, 'Different Employer'), error =>
    error.recruitmentObservations?.boards.length === 0 && error.failureKind === 'coverage_gap')
})

for (const html of ['<template>' + button + '</template>',
  button.replace('<button ', '<button disabled '),
  button.replace('window.open(', 'unreviewedNavigation(')]) {
  test('inactive or unreviewed navigation cannot authorize native requests: ' + html.slice(0, 60), async () => {
    await assert.rejects(run(html), error => error.recruitmentObservations?.boards.length === 0)
  })
}
