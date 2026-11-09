import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {getScraperCatalog} from '../scraper-support/providers/index.js'
import {recruitmentEmployerMatches} from '../scraper-support/utils/verifiedRecruitment.js'

const bindings=JSON.parse(readFileSync(new URL('./test-data/recruitmentRemaining48720261104/employer-bindings.json',import.meta.url)))
const catalog=new Map(getScraperCatalog().map(p=>[p.source,p]))
for(const row of bindings)test(row.source+': current exact native employer names have source-scoped bindings',()=>{
 assert.ok(row.evidence.length)
 for(const name of row.names)assert.equal(recruitmentEmployerMatches(catalog.get(row.source),name),true,name)
 assert.equal(recruitmentEmployerMatches(catalog.get(row.source),'Unrelated Recruiting Services'),false)
})
test('acquired brands retain their parent-employer exclusions',()=>{
 for(const [source,parent]of [['calypsoai','630 F5 Networks India Private Limited'],['cnn','Warner Bros. Discovery'],['currencycloud','490 Visa Consolidated Support Services (India) Private Limited - Tech Unit']]){
  assert.equal(catalog.get(source).requireNativeEmployerName,true)
  assert.equal(recruitmentEmployerMatches(catalog.get(source),parent),false)
 }
})
test('the reviewed Citibank subsidiary binding does not authorize other Citigroup employers',()=>{
 const profile=catalog.get('citibank')
 assert.equal(profile.requireNativeEmployerName,true)
 for(const name of ['Citigroup','Citi','Citigroup Global Markets India Private Limited'])assert.equal(recruitmentEmployerMatches(profile,name),false)
})

const mappings=JSON.parse(readFileSync(new URL('./test-data/recruitmentRemaining48720261104/official-mappings.json',import.meta.url)))
for(const row of mappings)test(row.source+': registered extraction uses the reviewed official careers mapping',()=>{
 const profile=catalog.get(row.source)
 assert.equal(profile.companyCareerPage,row.companyCareerPage)
 assert.equal(profile.companyDomain,row.companyDomain)
 assert.equal(profile.officialHomepageUrl,row.officialHomepageUrl)
 for(const name of row.nativeEmployerNames||[])assert.equal(recruitmentEmployerMatches(profile,name),true)
 assert.equal(profile.sourceScopeComplete,false)
})
test('HPE is scoped to Hewlett Packard Enterprise and does not authorize HP Inc. roles',()=>{
 assert.equal(recruitmentEmployerMatches(catalog.get('hpenterprise'),'HPE'),true)
 assert.equal(recruitmentEmployerMatches(catalog.get('hpenterprise'),'HP Inc.'),false)
})
test('reviewed native traversal and source budget choices remain scoped to their intended providers',()=>{
 for(const source of ['mcdonalds','hatch','mccormickandcompany','newellbrands'])assert.equal(catalog.get(source).prioritizeRecruitmentRoleDetails,true)
 assert.equal(catalog.get('hpenterprise').stopAfterNativeIndiaLimit,true)
 for(const source of ['corning','fitchgroup','ametek','abvolvo'])assert.notEqual(catalog.get(source).prioritizeRecruitmentRoleDetails,true)
 assert.equal(recruitmentEmployerMatches(catalog.get('basf'),'Surventis Private Ltd.'),false)
})
