import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {HOME,CAREERS,parseListing,parseRoleHTML,parseMarkdown} from './parser.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/placement-20261108.json.gz',import.meta.url)))),body=url=>Buffer.from(capture.packets.find(p=>p.requestedURL===url).rawBodyBase64,'base64').toString('utf8')
const candidate=parseListing(body(HOME),body(CAREERS)).candidates[0],identity=parseRoleHTML(body(candidate.url),candidate),markdown=body(identity.markdownURL)
test('observed Zurich corporate spelling agrees with Z\u00fcrich native placement in Switzerland while preserving both originals',()=>{
 const fact=parseMarkdown(markdown,candidate,identity)
 assert.equal(fact.country,'Switzerland');assert.equal(fact.nativeCityRaw,'Z\u00fcrich');assert.equal(fact.listing.locationRaw,'Zurich');assert.equal(fact.nativeFullMarkdown,markdown);assert.equal(fact.sourceDescriptionMarkdown.includes('## Requirements'),true)
})
for(const location of ['Zurich, France','Z\u00fcrich, Germany','Basel, Switzerland'])test('city spelling review cannot erase conflicting placement '+location,()=>{
 assert.throws(()=>parseMarkdown(markdown,{...candidate,locationRaw:location},identity),/Conflicting listing\/detail placement/)
})
test('Swiss city equivalence cannot infer a foreign country from a spelling alias',()=>{
 assert.throws(()=>parseMarkdown(markdown.replace('Z\u00fcrich, Switzerland','Z\u00fcrich, France'),candidate,identity),/Conflicting listing\/detail placement/)
})
