import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'

import {fileURLToPath} from 'node:url'
import {run as legacyRun} from './legacyOfficial20261103.js'
const createCatalogScraper=()=>({run:legacyRun})
import { identifyPublicAtsBoard } from '../../scraper-support/utils/publicAtsIdentity.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { OFFICIAL_ATS_DISCOVERY } from '../../scraper-support/utils/officialAtsRecovery.js'
import { classifyProviderImplementation } from '../../scripts/reportScriptCatalogTopology.js'

const indiaDescription = '<p>Build and operate production software services, review API designs, and investigate distributed system failures.</p>'

export const registerCapturedOfficialAtsRecoveryTests = ({ source, fixtureURL }) => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixtureURL), 'utf8'))
  const receipts = manifest.requests.map(receipt => {
    const body = gunzipSync(readFileSync(new URL(receipt.filename, fixtureURL)))
    assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySHA256)
    assert.equal(body.length, receipt.bodyBytes)
    return { ...receipt, body: body.toString('utf8') }
  })
  const pages = new Map(receipts.flatMap(receipt => [[receipt.requestedURL, receipt], [receipt.finalURL, receipt]]))
  const nativeReceipt = receipts.at(-1)
  const nativePayload = JSON.parse(nativeReceipt.body)
  const board = identifyPublicAtsBoard(nativeReceipt.requestedURL)
  assert.ok(board)
  assert.equal(source,'leandata','Source-private historical control only')
  const provider={source,companyName:'LeanData',adapter:'script',modulePath:fileURLToPath(new URL('./legacyOfficial20261103.js',import.meta.url)),backfillMode:'live-parser',zeroResultPolicy:'evidence-required',verifiedPublicJobCount:null,verifiedIndiaJobCount:null,sourceScopeComplete:false}
  const fetchPage = async url => {
    const receipt = pages.get(url)
    assert.ok(receipt, 'Uncaptured employer resource: ' + url)
    return { status: receipt.status, url: receipt.finalURL, html: receipt.body }
  }

  test(`${source} historical November3 factory reads its retained employer and native feed`, async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Captured tests forbid uncontrolled HTTP'))
    assert.equal(manifest.source, source)
    assert.equal(classifyProviderImplementation(provider).type, 'script')
    assert.equal(provider.backfillMode, 'live-parser')
    assert.equal(provider.zeroResultPolicy, 'evidence-required')
    assert.equal(provider.verifiedPublicJobCount, null)
    assert.equal(provider.verifiedIndiaJobCount, null)
    assert.equal(provider.sourceScopeComplete, false)
    const apiReads = []
    const jobs = await createCatalogScraper(provider).run({ fetchPage, fetchJson: async url => {
      apiReads.push(url)
      assert.equal(url, nativeReceipt.requestedURL)
      return structuredClone(nativePayload)
    } })
    assert.deepEqual(apiReads, [nativeReceipt.requestedURL])
    assert.equal((nativePayload.jobs || nativePayload).length, manifest.expectedNativeCount)
    assert.equal(jobs.length, manifest.expectedIndiaCount)
    assert.equal(jobs[OFFICIAL_ATS_DISCOVERY].boards.length, 1)
    assert.equal(jobs[OFFICIAL_ATS_DISCOVERY].boards[0].boardToken, board.boardToken)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
    for (const job of jobs) {
      assert.equal(job.source, source)
      assert.equal(job.company, provider.companyName)
      assert.equal(job.lifecycleCleanupAllowed, false)
    }
  })

  test(`${source} historical factory extracts an explicitly synthetic controlled India role`, async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Controlled India tests forbid live HTTP'))
    // Deliberately synthetic geography/role content tests future qualifying
    // input. It is not represented as an observed live India job.
    const original = (nativePayload.jobs || nativePayload)[0]
    assert.ok(original)
    const local = structuredClone(original)
    if (board.atsPlatform === 'ashby') {
      Object.assign(local, { title: 'Software Engineer', isListed: true, location: 'Bengaluru, India',
        address: { postalAddress: { addressCountry: 'IN', addressLocality: 'Bengaluru' } },
        secondaryLocations: [], descriptionHtml: indiaDescription, descriptionPlain: null })
    } else if (board.atsPlatform === 'greenhouse') {
      Object.assign(local, { title: 'Software Engineer', location: { name: 'Bengaluru, India' }, offices: [],
        metadata: [], content: indiaDescription })
    } else {
      Object.assign(local, { text: 'Software Engineer', country: 'IN',
        categories: { location: 'Bengaluru, India', allLocations: ['Bengaluru, India'], commitment: 'Full-time' },
        description: indiaDescription, descriptionPlain: null, additional: '', additionalPlain: '', lists: [] })
    }
    const payload = board.atsPlatform === 'lever' ? [local]
      : board.atsPlatform === 'greenhouse' ? { jobs: [local], meta: { total: 1 } }
        : { apiVersion: '1', jobs: [local] }
    const jobs = await createCatalogScraper(provider).run({ fetchPage, fetchJson: async url => {
      assert.equal(url, nativeReceipt.requestedURL)
      return structuredClone(payload)
    } })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].source, source)
    assert.equal(jobs[0].company, provider.companyName)
    assert.equal(jobs[0].city, 'Bengaluru')
    assert.ok(jobs[0].jobDescription.includes('production software services'))
    assert.equal(jobs[0].officialAtsBinding.verified, true)
    assert.equal(jobs[0].sourceScopeComplete, false)
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  })

  test(`${source} historical factory refuses unavailable employer binding`, async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Binding regression tests forbid live HTTP'))
    await assert.rejects(createCatalogScraper(provider).run({
      fetchPage: async url => ({ status: 403, url, html: '' }),
      fetchJson: async () => assert.fail('An unverified employer must not authorize a native API read'),
    }), error => error.failureKind === 'coverage_gap' && error.softFailure === true)
  })

  test(`${source} historical factory preserves its malformed-inventory rejection`, async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Malformed payload tests forbid live HTTP'))
    await assert.rejects(createCatalogScraper(provider).run({ fetchPage,
      fetchJson: async () => ({ success: false, jobs: [] }),
    }), /inventory envelope|inventory/)
  })
}
