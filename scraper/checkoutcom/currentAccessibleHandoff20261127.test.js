import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {currentCareerHandoff} from './currentPublisher20261121.js'

const packet=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-careers-20261127.json.gz',import.meta.url))))

test('Checkout.com current icon links declare their own job handoff through accessible names',()=>{
 const authority=currentCareerHandoff(packet.body,packet.observedAt)
 assert.equal(authority.listingURL,'https://www.checkout.com/jobs')
 const iconLinks=authority.originalHandoffs.filter(link=>!link.text.trim())
 assert.equal(iconLinks.length,2)
 assert.ok(iconLinks.every(link=>link.attributes['aria-label']==='Explore open positions'))
 assert.equal(authority.authority.publisher,'Checkout.com')
})

for(const[label,replacement]of[
 ['missing accessible career name',''],
 ['unrelated accessible name','aria-label="Contact our team"'],
])test('Checkout.com still holds icon handoffs with '+label,()=>{
 const changed=packet.body.replace('aria-label="Explore open positions"',replacement)
 assert.notEqual(changed,packet.body)
 assert.throws(()=>currentCareerHandoff(changed,packet.observedAt),/career meaning/)
})
