import assert from 'node:assert/strict'
import test from 'node:test'
import {fileURLToPath} from 'node:url'
import {
  createCatalogScraper,
  getScraperCatalog,
  loadProviderExtensions,
} from '../providers/index.js'
import {PROVIDER_METADATA as localCatalog} from '../../scraper/alaan/catalog.js'

const careersURL='https://www.alaan.com/careers'
const modulePath=fileURLToPath(new URL('../../scraper/alaan/script.js',import.meta.url))
const findProvider=options=>{
  const providers=getScraperCatalog(options).filter(row=>row.source==='alaan')
  assert.equal(providers.length,1)
  return providers[0]
}
const assertCurrentUnverifiedMetadata=provider=>{
  assert.equal(provider.companyName,'Alaan')
  assert.equal(provider.companyCareerPage,careersURL)
  assert.equal(provider.companyDomain,'alaan.com')
  assert.equal(provider.modulePath,modulePath)
  assert.equal(provider.countryFilter,'India')
  assert.equal(provider.verifiedOn,null)
  assert.equal(provider.verifiedPublicJobCount,null)
  assert.equal(provider.verifiedIndiaJobCount,null)
  assert.equal(provider.backfillMode,null)
  assert.notEqual(provider.atsPlatform,'verified-first-party-careers-empty-result')
  assert.ok(['coverage-gap','discovery-only','evidence-required'].includes(provider.zeroResultPolicy))
}

test('default Alaan metadata binds its current source catalog without historical zero totals',()=>{
  const provider=findProvider()
  assertCurrentUnverifiedMetadata(provider)
  for(const key of ['atsPlatform','paginationStrategy','extractionStrategy','verifiedSurfaceSummary','zeroResultPolicy']){
    assert.equal(provider[key],localCatalog[key],key)
  }
})

test('an ordinary legacy extension cannot restore historical Alaan zero claims',()=>{
  const provider=findProvider({providerExtensions:[...loadProviderExtensions(),{
    source:'alaan',atsPlatform:'verified-first-party-careers-empty-result',
    verifiedOn:'1999-01-01',verifiedPublicJobCount:0,verifiedIndiaJobCount:0,
    backfillMode:'verified-empty-state',
  }]})
  assertCurrentUnverifiedMetadata(provider)
})

test('the registered Alaan collector uses the injected current document transport and rejects unavailable inventory',async()=>{
  const provider=findProvider(),calls=[],previousFetch=globalThis.fetch
  const unavailable=new Error('C38 injected current Alaan document is unavailable')
  const injected=async url=>{calls.push(url);throw unavailable}
  let forbiddenNetworkCalls=0
  globalThis.fetch=async()=>{forbiddenNetworkCalls++;throw new Error('Unexpected uninjected network request')}
  try{
    await assert.rejects(()=>createCatalogScraper(provider).run({
      fetchImpl:injected,fetchPage:injected,fetchText:injected,fetchResponse:injected,
    }))
    assert.ok(calls.length>0,'registered source must read its current configured document')
    assert.ok(calls.every(url=>url===careersURL))
    assert.equal(forbiddenNetworkCalls,0)
  }finally{globalThis.fetch=previousFetch}
})
