import assert from 'node:assert/strict'
import test from 'node:test'
import { getScraperCatalog } from '../providers/index.js'
import { recoverEmptyOnlyRecruitment } from '../utils/emptyOnlyRecruitmentRecovery.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../utils/inventoryEvidence.js'

const provider = getScraperCatalog().find(row => row.source === 'acceleroisa')
const root = 'https://www.accelero-corp.com/'
const roleURL = root + 'careers/jobs/fixture-brand-india-1'
const recruitmentURL = root + 'recruitment'
const brandName = 'Meridian Software'
const clock = '2026-11-18T08:00:00.000Z'
const description = '<p>Develop production software services, review API contracts, investigate distributed system failures, and collaborate with our engineering team to improve reliability.</p>'
const posting = (employer = provider.companyName) => ({ '@type': 'JobPosting', identifier: { value: 'fixture-brand-india-1' },
  title: 'Software Engineer', url: roleURL, hiringOrganization: { name: employer }, description,
  datePosted: '2026-11-17', jobLocation: { address: { addressCountry: 'IN', addressLocality: 'Bengaluru' } } })
const role = employer => '<h1>Software Engineer</h1>' + description
  + '<script type="application/ld+json">' + JSON.stringify(posting(employer)) + '</script>'
const publisher = (name, link = roleURL, label = 'Open job') => `<title>${name} Careers</title><h1>${name}</h1><a href="${link}">${label}</a>`
const run = (config, pages) => recoverEmptyOnlyRecruitment([], { ...provider, ...config }, { emptyOnlyRecovery: {
  maxRequests: 8, maxPages: 4, maxDetails: 3, sourceTimeoutMs: 3000, now: () => clock,
  fetchPage: async url => ({ status: 200, url, html: pages(url) }),
} })

test('a registered official brand alias qualifies a current corporate publisher for native recovery', async () => {
  const jobs = await run({ officialBrandName: brandName }, url => url === roleURL ? role() : publisher(brandName))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].nativeHiringOrganization.name, provider.companyName)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('existing publisher aliases remain available beside the official brand alias', async () => {
  const aliases = ['Meridian Engineering Centre']
  const jobs = await run({ publisherNames: aliases, officialBrandName: brandName },
    url => url === roleURL ? role() : publisher(aliases[0]))
  assert.equal(jobs.length, 1)
  assert.deepEqual(aliases, ['Meridian Engineering Centre'])
})

for (const [name, currentPublisher, nativeEmployer] of [
  ['an unrelated current publisher', 'Unrelated Business', provider.companyName],
  ['an unrelated native employer', brandName, 'Unrelated Business'],
  ['a native employer matching only the unconfirmed brand alias', brandName, brandName],
]) test('a registered official brand alias cannot authorize ' + name, async () => {
  const jobs = await run({ officialBrandName: brandName },
    url => url === roleURL ? role(nativeEmployer) : publisher(currentPublisher))
  assert.equal(jobs.length, 0)
  assert.notEqual(readInventoryEvidence(jobs)?.status, 'verified-empty')
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('an active declared recruitment navigation link can lead to a current native India role', async () => {
  const jobs = await run({}, url => url === roleURL ? role() : url === recruitmentURL
    ? publisher(provider.companyName) : publisher(provider.companyName, recruitmentURL, 'Recruitment'))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'fixture-brand-india-1')
})

test('inactive recruitment navigation does not grant a current role declaration', async () => {
  const jobs = await run({}, url => url === roleURL ? role()
    : `<title>${provider.companyName}</title><template><a href="${roleURL}">Recruitment</a></template>`)
  assert.equal(jobs.length, 0)
  assert.notEqual(readInventoryEvidence(jobs)?.status, 'verified-empty')
})
