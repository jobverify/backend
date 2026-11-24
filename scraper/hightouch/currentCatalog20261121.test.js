import test from 'node:test'
import assert from 'node:assert/strict'
import meta from './catalog.js'
test('Hightouch catalog identifies current own/native live parser',()=>{assert.equal(meta.source,'hightouch');assert.equal(meta.atsPlatform,'ashby');assert.equal(meta.backfillMode,'live-parser');assert.equal(meta.parser,'custom-script');assert.equal(meta.companyCareerPage,'https://hightouch.com/careers')})
test('Hightouch source catalog never embeds observed counts or dates as current authority',()=>{assert.equal(meta.verifiedOn,null);assert.equal(meta.verifiedIndiaJobCount,null);assert.equal(meta.verifiedPublicJobCount,null);assert.equal(meta.authoritativeCurrentPublication,true)})
test('Hightouch country projection does not declare complete company inventory or cleanup',()=>{assert.equal(meta.sourceScopeComplete,false);assert.equal(meta.lifecycleCleanupAllowed,false);assert.equal(meta.scraperTimeoutMs,180000)})
