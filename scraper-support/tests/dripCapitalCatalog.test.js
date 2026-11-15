import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import {replayNative} from '../../scraper/dripcapital/fixtures/nativeReplay20261114.js'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Drip catalog accurately registers the bounded native text collector and retains employer/country identity', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'dripcapital')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Drip Capital')
  assert.equal(provider.officialBrandName, 'Drip Capital')
  assert.equal(provider.companyDomain, 'dripcapital.com')
  assert.equal(provider.companyCareerPage, 'https://www.dripcapital.com/en-in/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.modulePath, path.resolve('scraper/dripcapital/nativeCareers20261114.js'))
  assert.equal(provider.atsPlatform, 'trakstar-hire')
  assert.equal(provider.verifiedOn, '2026-11-14')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.sourceActivationComplete, false)
  assert.equal(provider.sourceRenderedCriteriaComplete, false)
  assert.equal(provider.sourceApplicationQualificationComplete, false)
  assert.equal(provider.verifiedPublicJobCount ?? null, null)
  assert.equal(provider.verifiedIndiaJobCount ?? null, null)
  assert.equal(provider.legacyCareersPayloadUrl, 'https://assets.dripcapital.com/_nuxt/static/1786337464/careers/payload.js')
  assert.equal(provider.indiaCareersPayloadUrl, 'https://assets.dripcapital.com/_nuxt/static/1786337464/en-in/careers/payload.js')
  assert.equal(provider.usCareersPayloadUrl, 'https://assets.dripcapital.com/_nuxt/static/1786337464/en-us/careers/payload.js')
})

test('Registered Drip native collector retains metadata and performs no legacy fallback or foreign detail reads', async () => {
  const scraper = buildScrapers().find((item) => item.name === 'dripcapital')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.dripcapital.com/en-in/careers/')
  const noFallback = () => assert.fail('Current native collector must not add legacy recovery requests')
  const replay = replayNative()
  const jobs = await scraper.run({fetchImpl: replay.fetchImpl,
    softFailureRecovery: {fetchPage: noFallback}, emptyOnlyRecovery: {fetchPage: noFallback}})
  assert.equal(jobs.length, 4)
  assert.ok(jobs.every(job => job.companyDomain === 'dripcapital.com' && job.careerPage === 'https://www.dripcapital.com/en-in/careers/' && job.atsPlatform === 'trakstar-hire'))
  assert.equal(jobs.nativeCollectionEvidence.closingInventoryEqual, true)
  assert.equal(replay.reads.length, 14)
  const denied = replayNative({mutate: ({requestIndex, raw}) => requestIndex === 3 ? Buffer.concat([raw, Buffer.from('Changed')]) : undefined})
  await assert.rejects(scraper.run({fetchImpl: denied.fetchImpl,
    softFailureRecovery: {fetchPage: noFallback}, emptyOnlyRecovery: {fetchPage: noFallback}}), /coverage gap/)
  assert.equal(denied.reads.length, 4)
})
