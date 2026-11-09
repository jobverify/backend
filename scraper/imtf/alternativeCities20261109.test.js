import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {HOME,CAREERS,parseListing,parseRoleHTML,parseMarkdown,sha} from './parser.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/onsite-markdown-20261109.json.gz',import.meta.url))))
const packets=new Map(capture.packets.map(packet=>[packet.requestedURL,packet]))
for(const packet of packets.values())assert.equal(sha(Buffer.from(packet.rawBodyBase64,'base64')),packet.bodySHA256)
const body=url=>Buffer.from(packets.get(url).rawBodyBase64,'base64').toString('utf8')
const candidate=parseListing(body(HOME),body(CAREERS)).candidates.find(row=>row.shortcode==='6F87AB9489')
const identity=parseRoleHTML(body(candidate.url),candidate),markdown=body(identity.markdownURL)

// Requiring one whole city string rejects a native city that is explicitly one
// member of this unmodified employer-advertised same-country alternative set.
test('unmodified Cyber Security role retains its advertised alternative city set and only the native Bensheim geography',()=>{
 assert.equal(candidate.locationRaw,'Bensheim or Berlin, Germany')
 const fact=parseMarkdown(markdown,candidate,identity)
 assert.equal(fact.title,'Working Student (m/w/d) - Cyber Security Engineering')
 assert.equal(fact.nativePublicURLShortcode,'6F87AB9489')
 assert.equal(fact.nativeNumericJobId,'6233604')
 assert.equal(fact.nativeAccountId,'071d270e-7d0d-4d5e-8d48-1187c51ab6f6')
 assert.equal(fact.listing.locationRaw,'Bensheim or Berlin, Germany')
 assert.equal(fact.nativeLocationRaw,'Bensheim, Germany')
 assert.equal(fact.nativeCityRaw,'Bensheim')
 assert.equal(fact.country,'Germany')
 assert.equal(fact.nativeFullMarkdown,markdown)
 assert.equal(fact.nativeFullMarkdownSHA256,'f690fdfdd9a6499603f236fa555b31b597cb7897c802a2b7eb69ff777a4f084c')
 assert.equal(fact.nativeApplicationURL,'https://apply.workable.com/imtf/j/6F87AB9489/apply')
 assert.equal(fact.applicationVisited,false)
})

test('DERIVED second explicitly advertised city can match without adding its sibling to native geography',()=>{
 const changed=markdown.replace('Bensheim, Germany','Berlin, Germany')
 const fact=parseMarkdown(changed,candidate,identity)
 assert.equal(fact.nativeCityRaw,'Berlin')
 assert.equal(fact.nativeLocationRaw,'Berlin, Germany')
 assert.equal(fact.country,'Germany')
 assert.equal(fact.listing.locationRaw,'Bensheim or Berlin, Germany')
})

for(const [label,locationRaw]of[
 ['different explicit country','Bensheim or Berlin, India'],
 ['absent explicit country','Bensheim or Berlin'],
 ['unrecognized country','Bensheim or Berlin, Unknownland'],
 ['nonmember native city','Berlin or Munich, Germany'],
 ['different separator','Bensheim and Berlin, Germany'],
 ['blank alternative','Bensheim or , Germany'],
 ['duplicate alternative','Bensheim or Bensheim, Germany'],
 ['unreviewed three-way alternative','Bensheim or Berlin or Munich, Germany'],
 ['unreviewed region-bearing alternatives','Bensheim or Berlin, Hesse, Germany'],
])test('same-country alternative-city support still rejects '+label,()=>{
 assert.throws(()=>parseMarkdown(markdown,{...candidate,locationRaw},identity),/Conflicting listing\/detail placement/)
})

test('explicit alternative-city set cannot excuse native country, workplace, department or employment contradictions',()=>{
 assert.throws(()=>parseMarkdown(markdown.replace('Bensheim, Germany','Bensheim, India'),candidate,identity),/Conflicting listing\/detail placement/)
 assert.throws(()=>parseMarkdown(markdown,{...candidate,workplaceRaw:'Hybrid'},identity),/workplace or department mismatch/)
 assert.throws(()=>parseMarkdown(markdown,{...candidate,departmentRaw:'Other'},identity),/workplace or department mismatch/)
 assert.throws(()=>parseMarkdown(markdown,{...candidate,employmentRaw:'Temporary'},identity),/title\/employment\/header mismatch/)
})
