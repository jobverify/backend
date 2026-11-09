import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
test('DataHub replaces its sentinel without asserting fresh successful runtime counts',()=>{
 const all=getScraperCatalog(),p=all.find(row=>row.source==='datahub')
 assert.equal(all.filter(row=>row.source==='datahub').length,1);assert.equal(p.atsPlatform,'greenhouse');assert.equal(p.boardToken,'acryldata');assert.equal(p.backfillMode,'live-parser')
 assert.equal(p.companyCareerPage,'https://datahub.com/company/careers/')
 assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedOn,null)
 assert.equal(p.sourceScopeComplete,false);assert.equal(p.zeroResultPolicy,'evidence-required')
 assert.equal(all.filter(row=>row.boardToken==='acryldata').length,1)
})
