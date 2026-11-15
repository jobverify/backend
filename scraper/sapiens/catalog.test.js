import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
import CATALOG,{LEGACY_CATALOG,NATIVE_CONFIG} from './catalog.js'

test('current Sapiens routing is source-local native data with no fixture count or business ID admission metadata',()=>{
 const actual=getScraperCatalog().find(row=>row.source==='sapiens')
 assert.match(actual.modulePath,/sapiens[\\/]nativeData20261115\.js$/);assert.match(CATALOG.modulePath,/nativeData20261115\.js$/);assert.match(LEGACY_CATALOG.modulePath,/script\.js$/)
 assert.equal(actual.source,'sapiens');assert.equal(actual.companyName,'Sapiens');assert.equal(actual.atsPlatform,'hibob');assert.equal(actual.companyDomain,'sapiens.com');assert.equal(actual.countryFilter,'India');assert.equal(NATIVE_CONFIG.board,'https://sapiens.careers.hibob.com/')
 for(const key of ['firstParty','sourceCorporateBindingQualified','formalLegalEmployerQualified','sourceScopeComplete','sourceListingComplete','sourceRenderedCriteriaComplete','sourceApplicationQualificationComplete','lifecycleCleanupAllowed'])assert.equal(actual[key],false,key)
 assert.equal(actual.verifiedOn,null);assert.equal(actual.verifiedPublicPostingCount,null);assert.equal(actual.verifiedIndiaRoleCount,null);assert.equal(Object.hasOwn(actual,'nativeObservedRecordCount'),false)
})
