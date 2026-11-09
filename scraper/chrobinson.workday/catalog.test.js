import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
test('C.H. Robinson replaces one sentinel with an exact verified board, preserving its registration and unknown runtime counts',()=>{
 const all=getScraperCatalog(),p=all.find(p=>p.source==='chrobinson')
 assert.equal(all.filter(row=>row.source==='chrobinson').length,1);assert.equal(p.adapter,'script');assert.equal(p.atsPlatform,'workday')
 assert.equal(p.jobsBoardUrl,'https://chrobinson.wd5.myworkdayjobs.com/CHRobinson')
 assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedOn,null)
 assert.equal(all.filter(row=>row.jobsBoardUrl===p.jobsBoardUrl).length,1)
})
