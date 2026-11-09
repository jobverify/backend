import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
import {nativeFixture} from '../../scraper/alkemlaboratories/nativeFixture.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
globalThis.fetch=async()=>{throw Error('OFFLINE four-source catalog tripwire')}
const expected={alkemlaboratories:'turbohire-public-careerpage',bluebinaries:'wordpress-native-accordion',amurahealth:'first-party-career-editorial-unknown-inventory',anrsoftwareprivatelimited:'first-party-public-role-criteria-country-and-id-gap'}
for(const[source,platform]of Object.entries(expected))test('registered '+source+' uses current source-owned native contract without static inventory totals',async()=>{
 const provider=getScraperCatalog().find(row=>row.source===source);assert.ok(provider);assert.equal(provider.adapter,'script');assert.equal(provider.atsPlatform,platform);assert.match(provider.modulePath,new RegExp(source+'[\\\\/]script\\.js$'))
 assert.equal(provider.verifiedPublicJobCount,null);assert.equal(provider.verifiedIndiaJobCount,null);assert.equal(provider.zeroResultPolicy,'evidence-required')
 const fixture=nativeFixture(new URL('../../scraper/'+source+'/native20261103.test.js',import.meta.url)),jobs=await createCatalogScraper(provider).run({fetchPage:fixture.fetchPage})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,source==='alkemlaboratories')
 if(source!=='alkemlaboratories'){const e=readSourceObservationEvidence(jobs,source);assert.ok(e);assert.equal(e.sourceScopeComplete,false);assert.equal(e.observedRecordCount,({bluebinaries:9,amurahealth:1,anrsoftwareprivatelimited:47})[source]);assert.equal(e.companyGlobalTotal,null);assert.equal(e.companyIndiaTotal,null)}
})
