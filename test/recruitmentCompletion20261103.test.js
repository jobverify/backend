import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifiedRecruitmentScraper, recruitmentEmployerMatches, RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const config = { source: 'completion-example', companyName: 'Example', companyDomain: 'example.test',
  companyCareerPage: 'https://example.test/careers', requireCorporateIdentityMatch: true }
const description = '<p>Design production software services, maintain distributed systems, collaborate on technical architecture, review proposed API changes and investigate service reliability issues.</p>'
const board = 'https://tenant.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/example-careers'
const api = 'https://tenant.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/'
const baseHTML = `<title>Example Careers</title><base href="/hcmUI/CandidateExperience/en/sites/example-careers" data-apibaseurl="https://tenant.fa.ocs.oraclecloud.com:443" data-sitenumber="CX_2">`
const role = { Id: '1234', Title: 'Software Engineer', PrimaryLocationCountry: 'IN', PrimaryLocation: 'Bengaluru, India', secondaryLocations: [] }
const detail = { ...role, LegalEmployer: 'Example India Private Limited', ExternalDescriptionStr: description,
  ExternalPostedStartDate: '2026-11-01T09:00:00Z', ExternalPostedEndDate: '2026-12-01T09:00:00Z', workLocation: [] }
const run = ({ provider = config, base = baseHTML, item = detail, collection = {}, envelope = {}, urlOverride } = {}) => createVerifiedRecruitmentScraper(provider).run({
  now: () => '2026-11-03T13:00:00Z',
  fetchPage: async url => ({ status: 200, url: urlOverride || url,
    html: url === board ? base : `<title>Example</title><a href="${board}">Current vacancies</a>` }),
  fetchJson: async url => {
    assert.ok(url.startsWith(api))
    if (url.includes('recruitingCEJobRequisitionDetails')) return { count: 1, hasMore: false, items: [item] }
    assert.match(url, /siteNumber=CX_2,/)
    assert.ok(!url.includes('siteNumber=example-careers,'))
    return { count: 1, hasMore: false, items: [{ SiteNumber: 'CX_2', Offset: 0, Limit: 20, TotalJobsCount: 1, requisitionList: [role], ...collection }], ...envelope }
  },
})

test('Oracle uses the published native site number and checks country, employer, description and role identity', async () => {
  const jobs = await run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, role.Id)
  assert.equal(jobs[0].applyUrl, board + '/job/' + role.Id)
  assert.equal(jobs[0].sourceDescription, description)
  assert.equal(jobs[0].nativeHiringOrganization.name, detail.LegalEmployer)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeInventoryReads[0].site, 'CX_2')
})

test('Oracle preserves missing legal employer as null when current corporate and native site publishers bind the role', async () => {
  const jobs = await run({ item: { ...detail, LegalEmployer: null } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].nativeHiringOrganization, null)
  assert.equal(jobs[0].nativeEmployerBinding.siteNumber, 'CX_2')
  assert.equal(jobs[0].nativeEmployerBinding.legalEmployer, null)
  const protectedBrand = await run({ provider: { ...config, requireNativeEmployerName: true }, item: { ...detail, LegalEmployer: null } })
  assert.equal(protectedBrand.length, 0)
  assert.ok(protectedBrand[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-employer-mismatch'))
})

for (const [label, changes] of [
  ['another native site', { collection: { SiteNumber: 'CX_FOREIGN' } }],
  ['an error envelope', { envelope: { count: 0, items: [] } }],
  ['a changed role ID', { item: { ...detail, Id: '9999' } }],
  ['a changed role title', { item: { ...detail, Title: 'Different role' } }],
  ['a foreign primary country', { item: { ...detail, PrimaryLocationCountry: 'US' } }],
  ['another employer', { item: { ...detail, LegalEmployer: 'Parent Corporation' } }],
  ['a missing detail country', { item: { ...detail, PrimaryLocationCountry: null, workLocation: [] } }],
  ['an expired posting', { item: { ...detail, ExternalPostedEndDate: '2026-10-01T00:00:00Z' } }],
  ['a teaser description', { item: { ...detail, ExternalDescriptionStr: '<p>Apply now.</p>' } }],
]) test('Oracle rejects ' + label + ' without certifying company inventory', async () => {
  if (changes.collection?.SiteNumber || changes.envelope) {
    await assert.rejects(run(changes), error => error.failureKind === 'coverage_gap')
    return
  }
  const jobs = await run(changes)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('Oracle cannot change the API authority, site base URL or native publisher', async () => {
  for (const html of [baseHTML.replace('tenant.fa.ocs.oraclecloud.com:443', 'foreign.test'), baseHTML.replace('Example Careers', 'Other Employer Careers'),
    baseHTML.replace('sites/example-careers', 'sites/foreign-careers'), baseHTML.replace('data-sitenumber="CX_2"', 'data-sitenumber="../../admin"')]) {
    await assert.rejects(run({ base: html }), error => error.failureKind === 'coverage_gap')
  }
})

test('an authenticated native empty inventory is readable without claiming zero company-wide India vacancies', async () => {
  const jobs = await run({ collection: { TotalJobsCount: 0, requisitionList: [] } })
  assert.equal(jobs.length, 0)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeInventoryReads.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('legal suffixes and explicit India suffixes preserve brand identity instead of accepting another company', () => {
  for (const name of ['Example', 'Example Inc.', 'Example India Private Limited', '123 Example India Pvt. Ltd.', 'The Example Corporation']) {
    assert.equal(recruitmentEmployerMatches(config, name), true, name)
  }
  for (const name of ['Another Example', 'Example Analytics Inc.', 'Parent Corporation', '', null]) assert.equal(recruitmentEmployerMatches(config, name), false)
  assert.equal(recruitmentEmployerMatches({ ...config, requireNativeEmployerName: true }, 'Example India Private Limited'), false)
  assert.equal(recruitmentEmployerMatches({ companyName: 'Honeycomb', companyDomain: 'honeycomb.io' }, 'Honeycomb.io'), true)
})

test('a delegated tenant root can expose its public role links below that root', async () => {
  const tenant = 'https://example.breezy.hr/', roleURL = tenant + 'p/native-id/software-engineer'
  const posting = { '@type': 'JobPosting', title: 'Software Engineer', url: roleURL, identifier: { value: 'native-id' }, description,
    hiringOrganization: { name: 'Example Inc.' }, jobLocation: { address: { addressCountry: ['India'], addressLocality: 'Bengaluru' } } }
  const jobs = await createVerifiedRecruitmentScraper(config).run({ fetchPage: async url => ({ status: 200, url,
    html: url === roleURL ? `<h2>Software Engineer</h2>${description}<script type="application/ld+json">${JSON.stringify(posting)}</script>`
      : url === tenant ? `<title>Example</title><a href="${roleURL}">Software Engineer</a>` : `<title>Example</title><a href="${tenant}">Careers</a>` }) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, roleURL)
  assert.equal(jobs[0].nativeHiringOrganization.name, 'Example Inc.')
})
