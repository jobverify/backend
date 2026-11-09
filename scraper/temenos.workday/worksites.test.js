import test from'node:test'
import assert from'node:assert/strict'
import fs from'node:fs'
import{gunzipSync}from'node:zlib'
import{readTemenosOfficePage,reconcileTemenosOffices,buildTemenosWorksiteProof}from'./worksites.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/worksites-native-20261103.json.gz',import.meta.url))))
const pages=()=>fixture.responses.filter(r=>r.url.startsWith('https://www.temenos.com/offices/')&&r.status===200).map(r=>readTemenosOfficePage(r.body,r.url))
test('all six current first-party directory pages reconcile51 actual workplaces and directly published countries',()=>{
 const r=reconcileTemenosOffices(pages());assert.equal(r.reportedTotal,51);assert.equal(r.records.length,51);assert.equal(r.pages.length,6)
 const dubai=r.records.filter(r=>r.label==='Dubai');assert.equal(dubai.length,2);assert.ok(dubai.every(r=>r.country.alpha2Code==='AE'&&r.publisherCountryText==='United Arab Emirates'))
 assert.equal(r.records.find(r=>r.label==='Mexico City').country.alpha2Code,'MX');assert.equal(r.records.find(r=>r.label==='Johannesburg').country.alpha2Code,'ZA')
})
test('incomplete directory, duplicated worksite IDs, count drift and foreign page identity cannot qualify country',()=>{
 const p=pages();assert.throws(()=>reconcileTemenosOffices(p.slice(0,-1)),/incomplete|directory/i)
 const duplicate=structuredClone(p);duplicate[1].records[0].id=duplicate[0].records[0].id;assert.throws(()=>reconcileTemenosOffices(duplicate),/duplicate|directory/i)
 assert.throws(()=>readTemenosOfficePage(fixture.responses.find(r=>r.url==='https://www.temenos.com/offices/').body,'https://unrelated.example/offices/'),/identity|directory/i)
})
test('data proof retains actual workplace records and publisher country text without deriving country from city/HQ',()=>{
 const d=reconcileTemenosOffices(pages()),p=buildTemenosWorksiteProof(d,d,{requestedUrl:'https://www.temenos.com/about-us/careers/',responseUrl:'https://www.temenos.com/about-us/careers/',status:200,board:'https://temenos.wd103.myworkdayjobs.com/Temenoscareers',anchorUrl:'https://temenos.wd103.myworkdayjobs.com/Temenoscareers',sha256:'a'.repeat(64),fetchedAt:new Date().toISOString()})
 assert.equal(p.source,'temenos');assert.equal(p.snapshots.length,2);assert.ok(p.snapshots[0].records.every(r=>r.sourceUrl&&r.publisherCountryText));assert.ok(p.snapshots[0].records.some(r=>r.id===140809&&r.label==='Dubai'))
})
