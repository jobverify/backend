import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
test('Colgate replaces its sentinel with one current native SAP binding and unknown company counts',()=>{
 const all=getScraperCatalog(),p=all.find(p=>p.source==='colgatepalmolive')
 assert.equal(all.filter(row=>row.source==='colgatepalmolive').length,1);assert.equal(p.adapter,'script');assert.equal(p.atsPlatform,'successfactors-rmk-public-widget')
 assert.equal(p.jobsBoardUrl,'https://jobs.colgate.com/search/')
 assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedOn,null)
 assert.equal(all.filter(row=>row.jobsBoardUrl===p.jobsBoardUrl).length,1)
})
