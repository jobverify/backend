import test from 'node:test'
import assert from 'node:assert/strict'
import metadata from './catalog.js'

test('LeanData current runtime catalog uses the reviewed native publication path',()=>{
 assert.equal(metadata.source,'leandata');assert.equal(metadata.companyName,'LeanData')
 assert.equal(metadata.authoritativeCurrentPublication,true);assert.equal(metadata.adapter,'script')
 assert.equal(metadata.backfillMode,'live-parser');assert.equal(metadata.parser,'custom-script')
 assert.equal(metadata.companyCareerPage,'https://www.leandata.com/company/careers/')
})
test('LeanData current catalog never reuses historical sentinel dates or zero counts',()=>{
 for(const field of['verifiedOn','verifiedPublicJobCount','verifiedGlobalJobCount','verifiedIndiaJobCount'])assert.equal(metadata[field],null,field)
})
test('LeanData configured board proof keeps company completeness and cleanup held',()=>{
 assert.equal(metadata.sourceScopeComplete,false);assert.equal(metadata.lifecycleCleanupAllowed,false)
 assert.equal(metadata.scraperTimeoutMs,180000)
})
