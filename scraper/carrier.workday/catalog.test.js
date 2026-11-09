import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
test('Carrier replaces only its sentinel while preserving its registration and unknown runtime counts',()=>{
 const all=getScraperCatalog(),p=all.find(p=>p.source==='carrier'),alias=all.find(p=>p.source==='carrierglobal')
 assert.equal(all.filter(row=>row.source==='carrier').length,1);assert.equal(all.filter(row=>row.source==='carrierglobal').length,1);assert.equal(p.parser,'current-official-binding-and-native-country-validated-workday-cxs');assert.equal(p.adapter,'script');assert.equal(p.atsPlatform,'workday');assert.equal(p.jobsBoardUrl,'https://carrier.wd5.myworkdayjobs.com/jobs')
 assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedOn,null);assert.ok(alias);assert.notEqual(alias.modulePath,p.modulePath)
})
