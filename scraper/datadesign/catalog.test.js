import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Data Design as a first-party tj_job script provider without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'datadesign')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Data Design')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'wordpress-jobs-api')
  assert.equal(provider.companyCareerPage, 'https://recruit.datadesign.co.jp/jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'wp-total-headers+all-pages+full-native-details+closing-reconciliation')
  assert.equal(provider.extractionStrategy, 'official-corporate-handoff+native-role-api-parity+explicit-country+full-visible-criteria')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'datadesign.co.jp')
  assert.match(provider.modulePath, /datadesign[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Data Design'), false)
})

test('registered empty India output exposes runtime audit without relying on array metadata decoration', async () => {
  const priorFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('Unexpected global fetch') }
  try {
    const dd = await import('./script.js')
    const r = readFileSync(new URL('./fixtures/native-jobs-api.json', import.meta.url), 'utf8')
    const role = readFileSync(new URL('./fixtures/native-role.html', import.meta.url), 'utf8')
    const homepage = '<title>データ・デザイン</title><a href="https://recruit.datadesign.co.jp">採用情報</a>'
    const hub = '<title>株式会社データ・デザイン採用サイト</title><a href="/jobs/">募集要項</a><a href="/jobs/generalist">総合職</a>'
    const archive = '<title>株式会社データ・デザイン採用サイト</title><body class="post-type-archive-tj_job wp-theme-data-design-recruit-theme"><h1>募集要項</h1><a href="/jobs/generalist">総合職</a></body>'
    let audit, requests = 0
    const provider = getScraperCatalog().find(p => p.source === 'datadesign')
    const jobs = await createCatalogScraper(provider).run({ onAudit: value => { audit = value }, fetchPage: async (url, init) => {
      requests++
      assert.equal(init.method, 'GET')
      const isJson = url.startsWith(dd.JOBS_API_URL + '?')
      const body = url === dd.HOMEPAGE_URL ? homepage : url === dd.RECRUIT_HOME_URL ? hub : url === dd.CAREERS_PAGE_URL ? archive : url.endsWith('/jobs/generalist') ? role : isJson ? r : 'Unavailable public profile'
      return { url, status: url.includes('mynavi.jp') ? 400 : 200, body, contentType: isJson ? 'application/json' : 'text/html', headers: isJson ? { 'x-wp-total': '1', 'x-wp-totalpages': '1' } : {} }
    } })
    assert.equal(jobs.length, 0)
    assert.equal(requests, 10)
    assert.equal(audit.primaryNativeGlobal, 1)
    assert.equal(audit.foreignPrimary, 1)
    assert.equal(audit.confirmedPrimaryIndia, 0)
    assert.equal(audit.primaryInventoryComplete, true)
    assert.equal(audit.inventoryComplete, false)
  } finally { globalThis.fetch = priorFetch }
})

test('buildScrapers and company coverage resolve Data Design directly from provider metadata', () => {
  const scraper = buildScrapers().find((item) => item.name === 'datadesign')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /datadesign[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'datadesign')

  const report = generateCompanyCoverageReport({
    csvText: 'Data Design,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Data Design', 'datadesign', 'Data Design']],
  )
})
