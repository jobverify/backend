import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { readNativeDocument } from '../utils/activeNativeHtml.js'
import { structuredRecruitmentPublishers } from '../utils/recruitmentPublisher.js'

const config = { source: 'structured-publisher-fixture', companyName: 'CyePro Solutions',
  companyDomain: 'employer.test', companyCareerPage: 'https://employer.test/careers', requireCorporateIdentityMatch: true }
const organization = { '@context': 'https://schema.org', '@type': 'Organization',
  '@id': 'https://employer.test/#organization', name: 'Cyepro', alternateName: ['Cyepro DMS', 'Cyepro Solutions'],
  url: 'https://employer.test/', address: { addressCountry: 'IN' } }
const description = '<p>Design and maintain production software services, review API contracts, investigate distributed system failures, and collaborate with the product engineering team.</p>'
const posting = { id: 'current-role', title: 'Software Engineer', isListed: true, location: 'Bengaluru, India',
  address: { postalAddress: { addressCountry: 'IN', addressLocality: 'Bengaluru' } }, descriptionHtml: description,
  jobUrl: 'https://jobs.ashbyhq.com/fixture/current-role', applyUrl: 'https://jobs.ashbyhq.com/fixture/current-role/application' }
const run = (schema, { inert = false, row = posting } = {}) => {
  const requests = []
  const markup = '<script type="application/ld+json">' + JSON.stringify(schema) + '</script>'
  return createVerifiedRecruitmentScraper(config).run({
    now: () => '2026-11-15T05:00:00Z',
    fetchPage: async url => ({ status: 200, url, html: '<title>Dealer Management System</title><h1>Ask your dealership.</h1>'
      + (inert ? '<template>' + markup + '</template>' : markup)
      + '<a href="https://jobs.ashbyhq.com/fixture">Open jobs</a>' }),
    fetchJson: async url => { requests.push(url); return { apiVersion: '1', jobs: [row] } },
  }).then(jobs => ({ jobs, requests }))
}

test('a self-bound Organization alternate name qualifies the publisher before native India acquisition', async () => {
  const { jobs, requests } = await run(organization)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, posting.id)
  assert.equal(jobs[0].country, 'IN')
  assert.deepEqual(requests, ['https://api.ashbyhq.com/posting-api/job-board/fixture'])
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].corporateIdentityEvidence.some(row => row.structuredPublishers?.length))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('WebSite publisher and legal name in a current JSON-LD graph can establish the same publisher', async () => {
  const schema = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', url: 'https://employer.test/', publisher: { '@id': organization['@id'] } },
    { ...organization, '@context': undefined, name: 'Cyepro', alternateName: undefined, legalName: 'CyePro Solutions Private Limited' },
  ] }
  assert.equal((await run(schema)).jobs.length, 1)
})

test('publisher office country never scopes a vacancy or certifies an empty India inventory', async () => {
  const { jobs } = await run(organization, { row: { ...posting, location: 'London, United Kingdom',
    address: { postalAddress: { addressCountry: 'GB' } } } })
  assert.equal(jobs.length, 0)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

const runCorporateRole = ({ hiringOrganization = { '@type': 'Organization', '@id': organization['@id'],
  name: 'Cyepro', url: organization.url }, strict = false, requireIdentity = true,
  roleContext = 'https://schema.org', roleOrganization = organization,
  homepageSchema = true, homepageTitle = 'Dealer Management System' } = {}) => {
  const roleURL = 'https://employer.test/careers/software-engineer'
  const role = { '@context': roleContext, '@type': 'JobPosting', identifier: { value: 'corporate-role' },
    title: 'Software Engineer', url: roleURL, hiringOrganization, description,
    jobLocation: { address: { addressCountry: 'IN', addressLocality: 'Bengaluru' } } }
  return createVerifiedRecruitmentScraper({ ...config, requireCorporateIdentityMatch: requireIdentity,
    requireNativeEmployerName: strict }).run({
    fetchPage: async url => ({ status: 200, url, html: '<title>' + homepageTitle + '</title>'
      + (url === 'https://employer.test/' && !homepageSchema ? '' : '<script type="application/ld+json">'
        + JSON.stringify(url === roleURL ? roleOrganization : organization) + '</script>')
      + (url === roleURL ? '<h1>Software Engineer</h1>' + description + '<script type="application/ld+json">'
        + JSON.stringify(role) + '</script>' : '<h1>Ask your dealership.</h1><a href="' + roleURL + '">Open job</a>') }),
  })
}

test('a native role using the same self-bound Organization identity retains its published employer name', async () => {
  const jobs = await runCorporateRole()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, config.companyName)
  assert.equal(jobs[0].nativeSourceRecord.hiringOrganization.name, 'Cyepro')
  assert.equal(jobs[0].nativeEmployerBinding.method, 'current-structured-publisher-and-native-employer-identity')
  assert.equal(jobs[0].nativeEmployerBinding.nativeEmployerName, 'Cyepro')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('publisher alternate names do not become global employer aliases or override an exact-name contract', async () => {
  for (const options of [{ strict: true },
    { hiringOrganization: { name: 'Cyepro', '@id': 'https://other.test/#organization', url: 'https://other.test/' } },
    { hiringOrganization: { name: 'Cyepro' } },
    { hiringOrganization: { name: 'Cyepro Staffing', '@id': organization['@id'], url: organization.url } }]) {
    assert.equal((await runCorporateRole(options)).length, 0)
  }
})

test('publisher declarations remain available when identity checks are optional or the host was already identified', async () => {
  assert.equal((await runCorporateRole({ requireIdentity: false })).length, 1)
  assert.equal((await runCorporateRole({ homepageTitle: 'CyePro Solutions', homepageSchema: false })).length, 1)
})

test('a foreign or redefined native JobPosting context cannot use the structured employer proof', async () => {
  for (const roleContext of ['https://foreign.test/schema',
    { '@vocab': 'https://schema.org', hiringOrganization: 'https://foreign.test/employer' }]) {
    assert.equal((await runCorporateRole({ roleContext })).length, 0)
  }
})

test('a nested hiringOrganization context cannot redefine the employer identity fields', async () => {
  for (const context of ['https://foreign.test/schema',
    { '@vocab': 'https://schema.org', url: 'https://foreign.test/profile' }]) {
    assert.equal((await runCorporateRole({ hiringOrganization: { '@type': 'Organization',
      '@context': context, '@id': organization['@id'], url: organization.url, name: 'Cyepro' } })).length, 0)
  }
})

test('a current role-page identity conflict invalidates an earlier same-host employer proof', async () => {
  assert.equal((await runCorporateRole({ roleOrganization: { ...organization,
    name: 'Different Employer', alternateName: undefined } })).length, 0)
})

test('a later identity conflict also revokes roles collected under the earlier employer proof', async () => {
  const urls = ['https://employer.test/careers/first', 'https://employer.test/careers/second']
  const jobs = await createVerifiedRecruitmentScraper(config).run({ fetchPage: async url => {
    const index = urls.indexOf(url)
    const org = index === 1 ? { ...organization, name: 'Different Employer', alternateName: undefined } : organization
    const role = { '@context': 'https://schema.org', '@type': 'JobPosting', identifier: { value: 'role-' + index },
      url, title: 'Software Engineer', description,
      hiringOrganization: { '@id': organization['@id'], url: organization.url, name: 'Cyepro' },
      jobLocation: { address: { addressCountry: 'IN' } } }
    return { status: 200, url, html: '<title>Dealer Management System</title><script type="application/ld+json">'
      + JSON.stringify(org) + '</script>' + (index < 0 ? urls.map(target => '<a href="' + target + '">Job</a>').join('')
        : '<h1>Software Engineer</h1>' + description + '<script type="application/ld+json">' + JSON.stringify(role) + '</script>') }
  } })
  assert.equal(jobs.length, 0)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, 2)
})

test('bounded schema reads cannot silently skip conflicting identities', () => {
  const conflict = { ...organization, name: 'Different Employer', alternateName: undefined }
  const arrays = { '@context': 'https://schema.org', '@graph': [organization,
    ...Array.from({ length: 2000 }, () => ({})), conflict] }
  let nested = conflict
  for (let depth = 0; depth < 15; depth++) nested = { '@graph': nested }
  for (const schema of [arrays, { '@context': 'https://schema.org', '@graph': [organization, nested] }]) {
    const document = readNativeDocument('<script type="application/ld+json">' + JSON.stringify(schema) + '</script>')
    assert.deepEqual(structuredRecruitmentPublishers(document, 'https://employer.test/careers'), [])
  }
})

test('inert, foreign, unbound, redefined or conflicting organization declarations cannot delegate a board', async t => {
  const controls = [
    ['inert', organization, { inert: true }],
    ['foreign organization URL', { ...organization, url: 'https://elsewhere.test/' }],
    ['profile URL', { ...organization, url: 'https://employer.test/customers/example' }],
    ['credentials', { ...organization, url: 'https://user@employer.test/' }],
    ['query', { ...organization, url: 'https://employer.test/?customer=example' }],
    ['missing URL', { ...organization, url: undefined }],
    ['foreign schema context', { ...organization, '@context': 'https://foreign.test/schema' }],
    ['redefined field', { ...organization, '@context': { '@vocab': 'https://schema.org', alternateName: 'https://foreign.test/meaning' } }],
    ['third-party hiring organization', { '@context': 'https://schema.org', '@type': 'JobPosting', hiringOrganization: organization }],
    ['duplicate conflicting identity', { '@context': 'https://schema.org', '@graph': [organization,
      { ...organization, name: 'Another Company', alternateName: undefined }] }],
  ]
  for (const [name, schema, options] of controls) await t.test(name, async () => {
    await assert.rejects(run(schema, options), error => {
      assert.equal(error.recruitmentObservations?.nativeRecords, 0)
      assert.ok(error.recruitmentObservations?.unresolved.includes('current-corporate-publisher-identity-unqualified'))
      return true
    })
  })
})
