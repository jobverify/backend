import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {getScraperCatalog} from '../scraper-support/providers/index.js'
import {recruitmentEmployerMatches} from '../scraper-support/utils/verifiedRecruitment.js'

const catalog=new Map(getScraperCatalog().map(row=>[row.source,row]))
const bindings=JSON.parse(readFileSync(new URL('./test-data/recruitmentNext50020261104/employer-bindings.json',import.meta.url)))
for(const binding of bindings)test(binding.source+' accepts only its reviewed native legal employers',()=>{
 const config=catalog.get(binding.source)
 assert.ok(binding.nativeEmployers.length)
 for(const entry of binding.nativeEmployers){assert.equal(entry.country,'India');assert.equal(recruitmentEmployerMatches(config,entry.name),true,entry.name)}
 for(const other of ['Unrelated Recruiting Services','Merck & Co., Inc.','Other ZB Global Services','Franklin Research Consulting']){
  assert.equal(recruitmentEmployerMatches(config,other),false,other)
 }
})
test('AB Volvo is bound to Volvo Group without accepting Volvo Cars',()=>{
 assert.equal(recruitmentEmployerMatches(catalog.get('abvolvo'),'Volvo Group'),true)
 assert.equal(recruitmentEmployerMatches(catalog.get('abvolvo'),'Volvo Cars'),false)
})
