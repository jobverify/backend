import test from 'node:test'
import assert from 'node:assert/strict'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'
import { createVerifiedRecruitmentScraper, recruitmentEmployerMatches } from '../utils/verifiedRecruitment.js'

// Synthetic first-party handoffs exercise the real registered source modules
// and their shared batch configuration; no employer recovery is inferred.
for (const source of ['anthology', 'abra']) {
  test(`${source} registered scraper starts from a complete checkout and retains its full native board`, async () => {
    const provider = getScraperCatalog().find(row => row.source === source)
    assert.ok(provider)
    const token = 'fixture-registered-' + source
    const board = 'https://jobs.ashbyhq.com/' + token
    const payload = { apiVersion: '1', originalEnvelope: { retained: source }, jobs: [{
      id: 'foreign-role', title: 'Software Engineer', isListed: true,
      hiringOrganization: { name: provider.companyName }, location: 'Boston, United States',
      address: { postalAddress: { addressCountry: 'US' } },
      descriptionHtml: '<p>Build production software, investigate distributed service failures, review API contracts, and work with product engineering colleagues on reliable delivery.</p>',
      jobUrl: board + '/foreign-role', applyUrl: board + '/foreign-role/application',
      nativeCriteria: { whole: ['preserve original record'] },
    }] }
    const jobs = await createCatalogScraper(provider).run({ requestIntervalMs: 0,
      now: () => '2026-11-09T06:00:00.000Z',
      fetchPage: async url => {
        assert.ok(new URL(url).hostname.replace(/^www\./, '').endsWith(source + '.com'))
        return { status: 200, url, html: `<title>${provider.companyName} Careers</title><a href="${board}">Open jobs</a>` }
      },
      fetchJson: async url => {
        assert.equal(url, 'https://api.ashbyhq.com/posting-api/job-board/' + token)
        return payload
      },
    })
    assert.equal(jobs.length, 0)
    const audit = Object.getOwnPropertyDescriptor(jobs, 'nativeCollectionEvidence')?.value
    assert.deepEqual(audit.nativeBoards[0].nativePayload, payload)
    assert.deepEqual(audit.nativeBoards[0].nativeRecords, payload.jobs)
    assert.equal(readSourceObservationEvidence(jobs, source).observedVacancyCount, 1)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
    assert.equal(audit.sourceScopeComplete, false)
    assert.equal(audit.companyGlobalTotal, null)
    assert.equal(audit.companyIndiaTotal, null)
  })
}

test('restored DeLonghi configuration accepts its correctly encoded native employer name', async () => {
  const { recruitmentBatchProviders } = await import('../utils/recruitmentBatch20261103.js')
  const configuration = recruitmentBatchProviders().find(row => row.source === 'delonghi')
  const nativeEmployer = 'De\u2019Longhi'
  assert.equal(recruitmentEmployerMatches(configuration, nativeEmployer), true,
    'Configuration encoding must not reject the real employer name')
  const payload = { jobs: [{ id: 1, title: 'Software Engineer', company_name: nativeEmployer,
    location: { name: 'United States' }, internal_job_id: 1,
    content: '<p>Build and maintain production software systems, review API contracts, and investigate distributed service failures.</p>',
    absolute_url: 'https://job-boards.greenhouse.io/delonghi-fixture/jobs/1' }], meta: { total: 1 } }
  const jobs = await createVerifiedRecruitmentScraper(configuration).run({ requestIntervalMs: 0,
    fetchPage: async url => ({ status: 200, url,
      html: '<title>DeLonghi Careers</title><a href="https://job-boards.greenhouse.io/delonghi-fixture">Open jobs</a>' }),
    fetchJson: async url => {
      assert.equal(url, 'https://boards-api.greenhouse.io/v1/boards/delonghi-fixture/jobs?content=true')
      return payload
    },
  })
  assert.equal(jobs.length, 0)
  assert.equal(jobs.nativeCollectionEvidence.nativeBoards[0].nativePayload.jobs[0].company_name, nativeEmployer)
  assert.equal(readSourceObservationEvidence(jobs, 'delonghi').observedVacancyCount, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
