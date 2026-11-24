import test from 'node:test'
import assert from 'node:assert/strict'
import metadata from './catalog.js'
test('Freshpaint current catalog binds the exact source to the current Freshpaint publisher without legal-employer inference',()=>{assert.equal(metadata.source,'freshpaint');assert.equal(metadata.companyName,'Freshpaint');assert.equal(metadata.officialBrandName,'Freshpaint');assert.equal(metadata.companyCareerPage,'https://www.freshpaint.io/careers');assert.equal(metadata.adapter,'script');assert.equal(metadata.authoritativeCurrentPublication,true);assert.equal(metadata.backfillMode,'live-parser');assert.equal(metadata.parser,'custom-script')})
test('Freshpaint current assessment never reuses historical sentinel dates or zero counts',()=>{for(const field of['verifiedOn','verifiedPublicJobCount','verifiedGlobalJobCount','verifiedIndiaJobCount'])assert.equal(metadata[field],null,field)})
test('Freshpaint configured collection scope holds company completeness and cleanup',()=>{assert.equal(metadata.sourceScopeComplete,false);assert.equal(metadata.lifecycleCleanupAllowed,false);assert.equal(metadata.scraperTimeoutMs,180000)})
