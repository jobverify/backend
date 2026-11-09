import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'

import {
  buildScrapers,
  getScraperCatalog,
  createCatalogScraper,
} from '../providers/index.js'

test('getScraperCatalog includes Electrifex as an official first-party careers scraper', () => {
  const catalog = getScraperCatalog()
  const electrifex = catalog.find((provider) => provider.source === 'electrifex')

  assert.ok(electrifex)
  assert.equal(electrifex.adapter, 'script')
  assert.equal(electrifex.atsPlatform, 'official-company-careers')
  assert.match(electrifex.companyCareerPage, /talents\.electrifex\.com/i)
  assert.equal(electrifex.companyDomain, 'talents.electrifex.com')
})

test('registered Electrifex execution preserves a current country coverage gap after full native extraction',async()=>{
  const provider=getScraperCatalog().find(row=>row.source==='electrifex')
  assert.equal(provider.nativeGlobalContentVerified,true)
  assert.equal(provider.fullInventoryVerified,false)
  const fixtureRoot=new URL('../../scraper/electrifex/fixtures/',import.meta.url)
  const capture=JSON.parse(readFileSync(new URL('current-capture.json',fixtureRoot),'utf8'))
  let evidence
  const jobs=await createCatalogScraper(provider).run({minimumIntervalMs:0,fetchText:async url=>{
    const receipt=capture.receipts.find(row=>row.url===url)
    assert.ok(receipt,'Unexpected source read '+url)
    return readFileSync(new URL(receipt.name==='board.html'?'current-board.html':receipt.name==='home.html'?'current-home.html':receipt.name,fixtureRoot),'utf8')
  },onEvidence:value=>{evidence=value}})
  assert.equal(jobs.length,0)
  assert.equal(evidence.fullHealthyGlobalRecords,3)
  assert.equal(evidence.nativeClientContractVerified,true)
  assert.equal(jobs[Symbol.for('jobverify.inventory-evidence')].status,'coverage-gap')
})

test('buildScrapers exposes a runnable Electrifex scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const electrifex = scrapers.find((scraper) => scraper.name === 'electrifex')

  assert.ok(electrifex)
  assert.equal(typeof electrifex.run, 'function')
  assert.match(electrifex.dryRunFile, /electrifex[\\/]jobs\.json$/)
  assert.equal(electrifex.provider.source, 'electrifex')
  assert.equal(electrifex.provider.atsPlatform, 'official-company-careers')
})
