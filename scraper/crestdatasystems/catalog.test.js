import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
test('Crest replaces one sentinel; metadata retains unknown runtime and legal scope',()=>{
 const all=getScraperCatalog(),p=all.find(p=>p.source==='crestdatasystems')
 assert.equal(all.filter(row=>row.source==='crestdatasystems').length,1);assert.equal(p.adapter,'script');assert.equal(p.atsPlatform,'wordpress-public-job-career')
 assert.equal(p.jobsBoardUrl,'https://www.crestdata.ai/careers/open-positions/')
 assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedOn,null)
 assert.equal(p.sourceScopeComplete,false);assert.equal(p.runtimeQualification,'ordinary-http-failed-no-current-runtime-qualification')
 assert.equal(all.filter(r=>r.jobsBoardUrl===p.jobsBoardUrl).length,1)
})
