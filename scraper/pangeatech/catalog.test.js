import test from 'node:test'
import assert from 'node:assert/strict'
import candidate from './catalog-candidate.json' with {type:'json'}
import {PROVIDER_METADATA,COMPANY,SOURCE} from './script.js'
test('candidate disambiguates exact .net AI employer and retains unresolved inventory',()=>{
 assert.equal(SOURCE,'pangeatech');assert.equal(COMPANY,'Pangea Tech')
 assert.equal(candidate.companyDomain,'pangeatech.net')
 assert.equal(candidate.companyCareerPage,'https://pangeatech.net/meet-pangea/the-tribe')
 assert.equal(candidate.modulePath,'../pangeatech/script.js')
 assert.equal(candidate.firstParty,true)
 assert.equal(candidate.sourceListingComplete,false)
 assert.equal(candidate.lifecycleCleanupAllowed,false)
 assert.equal(candidate.verifiedPublicJobCount,null)
 assert.equal(candidate.verifiedIndiaJobCount,null)
 assert.match(PROVIDER_METADATA.modulePath,/pangeatech[\\/]script.js$/)
})
