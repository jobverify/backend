import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
import metadata from './catalog.js'
test('Ecolab provider selects the native external script with unknown static counts and explicit provenance',()=>{
 const providers=getScraperCatalog(),matches=providers.filter(p=>p.source==='ecolab')
 assert.equal(matches.length,1)
 const p=matches[0]
 assert.equal(p.atsPlatform,'phenom-native-ecolab-external');assert.equal(p.adapter,'script')
 assert.match(p.modulePath,/ecolab\.workday[\\/]script\.js$/);assert.equal(p.originalModulePath,null)
 assert.equal(p.zeroResultPolicy,'evidence-required');assert.equal(p.sourceScopeComplete,false)
 assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedOn,null)
 assert.equal(p.bindingEvidence.verified,true);assert.equal(p.bindingEvidence.applicationsOpened,false)
 assert.equal(p.companyCareerPage,'https://jobs.ecolab.com/global/en');assert.equal(p.companyDomain,'ecolab.com')
 assert.equal(metadata.atsPlatform,p.atsPlatform);assert.equal(metadata.verifiedPublicJobCount,null);assert.equal(metadata.originalModulePath,null)
})
