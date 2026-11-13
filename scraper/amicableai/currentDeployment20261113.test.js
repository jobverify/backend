import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { decorateJobsWithProviderMetadata, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261113.json.gz', import.meta.url))))
const replay = async (mutate = () => {}) => {
  let audit
  const jobs = await run({ fetchPage: async url => {
    const page = structuredClone(packets.find(row => row.requestedUrl === url))
    assert.ok(page, 'captured current native URL ' + url)
    mutate(page, url)
    return page
  }, onAudit: value => { audit = value } })
  return { jobs, audit }
}

test('amicable reviewed November deployment reconciles eight current native UK records', async () => {
  const { jobs, audit } = await replay()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 8)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  assert.equal(audit.observedDetails.length, 8)
  assert.ok(audit.observedDetails.every(job => job.country === 'United Kingdom' && job.sourceDetailComplete))
  assert.equal(audit.nonVacancyRecords.length, 1)
  assert.equal(audit.sourceCompanyWideScopeComplete, false)
  assert.equal(audit.sourceLifecycleCleanupVerified, false)
  assert.equal(jobs.nativeCollectionEvidence?.observedDetails.length, 8)
  assert.equal(decorateJobsWithProviderMetadata(jobs, getScraperCatalog().find(row => row.source === 'amicableai')).nativeCollectionEvidence?.observedDetails.length, 8)
})

test('amicable unreviewed current stylesheet cannot qualify public frame visibility', async () => {
  await assert.rejects(replay((page, url) => {
    if (url.endsWith('.css')) page.html += '\n.iframe-wrapper{display:none!important}'
  }), /visibility|CSS/i)
})

test('amicable current public pagination dataflow change remains fail closed', async () => {
  await assert.rejects(replay((page, url) => {
    if (url.includes('/assets/application-')) page.html = page.html.replace('jobPosts.slice(prevIndex,nextIndex)', 'jobPosts.slice(0,1)')
  }), /dataflow|client|inventory/i)
})

test('amicable injected inline frame concealment cannot qualify current handoff', async () => {
  await assert.rejects(replay((page, url) => {
    if (url === 'https://amicable.io/careers') page.html = page.html.replace('</head>', '<style>.iframe-wrapper{display:none!important}</style></head>')
  }), /visibility|CSS/i)
})

for (const [scope, style] of [
  ['criteria ancestor', 'opacity:0'],
  ['criteria ancestor', 'position:fixed;left:-9999px'],
  ['individual body text', 'white-space: pre-wrap;opacity:0'],
]) test(`amicable ${scope} with ${style} holds the full current native audit`, async () => {
  const { jobs, audit } = await replay((page, url) => {
    if (url.includes('/job_posts/')) page.html = page.html.replace(
      /(data-react-class="applicant_tracking\/Jobs\/JobPostPage"[^>]*data-react-props=")([^"]*)(")/,
      (_all, open, encoded, close) => {
        const value = JSON.parse(decodeNativeEntities(encoded)), original = value.jobPostHtmlString
        value.jobPostHtmlString = scope === 'criteria ancestor'
          ? `<div style="${style}">${original}</div>`
          : original.replace('white-space: pre-wrap;', style)
        assert.notEqual(value.jobPostHtmlString, original, 'mutated actual native criteria')
        return open + JSON.stringify(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + close
      })
  })
  assert.equal(jobs.length, 0)
  assert.equal(audit.observedDetails.length, 0)
  assert.equal(audit.sourceDeclaredBoardScopeComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  const provider = getScraperCatalog().find(row => row.source === 'amicableai')
  const assessment = assessSoftFailureAcquisition(provider, decorateJobsWithProviderMetadata(jobs, provider))
  assert.equal(assessment.zeroJobEvidence, 'coverage-gap')
  assert.equal(assessment.cleanupOptions.replaceExisting, false)
})
