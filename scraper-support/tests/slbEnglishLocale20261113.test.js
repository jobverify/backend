import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {slbListingIdentity,slbRoleURL,readSlbCurrentRole} from '../apiPortal/slbCurrentCareers.js'

const current=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-contracts-20261113/slb-search.json.gz',import.meta.url))))
test('SLB accepts the native English identifier from its explicit India index',()=>{
 const row=current.results.find(r=>r.uri.includes('EF12068-en 1'))
 assert.ok(row)
 const identity=slbListingIdentity(row)
 assert.equal(identity.id,'EF12068-en 1')
 assert.equal(identity.title,'Early Careers - Geoscience&Petrotechnical')
 assert.deepEqual(identity.country,['India'])
 assert.equal(current.results.map(slbListingIdentity).length,49)
 const html=gunzipSync(readFileSync(new URL('./fixtures/native-contracts-20261113/slb-english-role.html.gz',import.meta.url))).toString()
 const role=readSlbCurrentRole(html,row,{now:'2026-11-13T23:59:59Z'})
 assert.equal(role.location,'India, Multi-Location')
 assert.equal(role.city,null)
 assert.ok(role.description.length>1000)
 assert.equal(role.backendJobId,'563499730906613')
 assert.equal(role.applyURL,'https://apply.slb.com/careers/apply?pid=563499730906613&domain=slb.com')
})

for(const id of ['EF12068-de 1','EF12068-en 1 extra','EF12068-en_US/1','EF12068-en 1&id=other'])test('SLB rejects unreviewed role identifier '+id,()=>{
 assert.throws(()=>slbRoleURL('https://careers.slb.com/jobdescription.aspx?id='+encodeURIComponent(id)),/unreviewed/)
})
