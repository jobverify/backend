import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {HOME,CAREERS,parseListing,parseRoleHTML,parseMarkdown,sha} from './parser.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/onsite-markdown-20261109.json.gz',import.meta.url))))
const packets=new Map(capture.packets.map(packet=>[packet.requestedURL,packet]))
for(const packet of packets.values())assert.equal(sha(Buffer.from(packet.rawBodyBase64,'base64')),packet.bodySHA256)
const body=url=>Buffer.from(packets.get(url).rawBodyBase64,'base64').toString('utf8')
const listing=parseListing(body(HOME),body(CAREERS))
const candidate=listing.candidates.find(row=>row.shortcode==='7752672F96')
const html=body(candidate.url),identity=parseRoleHTML(html,candidate),markdown=body(identity.markdownURL)
const nativeTitle='Working Student (m/w/d) - DevOps Support'
const titleMeta='<meta property="og:title" content="Working Student (m/w/d) - DevOps Support - IMTF">'

// Removing the narrowly corroborated marker support must reject this unmodified
// employer-linked role again; the source titles, full text and identity are literal.
test('unmodified DevOps role accepts the observed Working Student gender marker when native HTML and Markdown agree',()=>{
 assert.equal(candidate.title,'Working Student - DevOps Support')
 assert.ok(html.includes(titleMeta))
 const fact=parseMarkdown(markdown,candidate,identity)
 assert.equal(fact.title,nativeTitle)
 assert.equal(fact.nativeRoleTitle,nativeTitle)
 assert.equal(fact.listing.title,'Working Student - DevOps Support')
 assert.equal(fact.nativePublicURLShortcode,'7752672F96')
 assert.equal(fact.nativeNumericJobId,'6049211')
 assert.equal(fact.nativeAccountId,'071d270e-7d0d-4d5e-8d48-1187c51ab6f6')
 assert.equal(fact.country,'Germany')
 assert.equal(fact.nativeCityRaw,'Bensheim')
 assert.equal(fact.nativeFullMarkdown,markdown)
 assert.equal(fact.nativeFullMarkdownSHA256,'7cd63828ffa1bf6310313a1ef7ca2289c42807dde1d0d0abc0380374c1efab5f')
 assert.equal(fact.nativeApplicationURL,'https://apply.workable.com/imtf/j/7752672F96/apply')
 assert.equal(fact.applicationVisited,false)
})

for(const [label,changed]of[
 ['missing native title',html.replace(titleMeta,'')],
 ['duplicate native title',html.replace(titleMeta,titleMeta+titleMeta)],
 ['contradictory native title',html.replace(titleMeta,'<meta property="og:title" content="Working Student (m/w/d) - Different Support - IMTF">')],
])test('gender marker cannot excuse '+label,()=>{
 assert.notEqual(changed,html)
 assert.throws(()=>parseMarkdown(markdown,candidate,parseRoleHTML(changed,candidate)),/title\/employment\/header mismatch/)
})

test('ambiguous native title attributes cannot establish a role title',()=>{
 const changed=html.replace(titleMeta,'<meta property="og:title" content="Other" content="Working Student (m/w/d) - DevOps Support - IMTF">')
 assert.throws(()=>parseRoleHTML(changed,candidate),/Duplicate source attributes/)
})

for(const [label,title]of[
 ['substantive qualification','Working Student (Senior) - DevOps Support'],
 ['unknown parenthesis','Working Student (m/w/d, senior) - DevOps Support'],
 ['different marker','Working Student (f/m/d) - DevOps Support'],
 ['moved marker','Working Student - DevOps Support (m/w/d)'],
 ['different role','Working Student (m/w/d) - Cyber Security Engineering'],
])test('reviewed marker support still rejects '+label,()=>{
 const changedHTML=html.replace(titleMeta,'<meta property="og:title" content="'+title+' - IMTF">')
 const changedMarkdown=markdown.replace('# '+nativeTitle+'\n','# '+title+'\n')
 assert.throws(()=>parseMarkdown(changedMarkdown,candidate,parseRoleHTML(changedHTML,candidate)),/title\/employment\/header mismatch/)
})

test('gender marker support preserves the native placement and employment checks',()=>{
 assert.throws(()=>parseMarkdown(markdown,{...candidate,locationRaw:'Bensheim, India'},identity),/Conflicting listing\/detail placement/)
 assert.throws(()=>parseMarkdown(markdown,{...candidate,locationRaw:'Berlin, Germany'},identity),/Conflicting listing\/detail placement/)
 assert.throws(()=>parseMarkdown(markdown,{...candidate,employmentRaw:'Temporary'},identity),/title\/employment\/header mismatch/)
 assert.throws(()=>parseMarkdown(markdown,{...candidate,departmentRaw:'Other'},identity),/workplace or department mismatch/)
 assert.throws(()=>parseMarkdown(markdown,{...candidate,workplaceRaw:'Hybrid'},identity),/workplace or department mismatch/)
})

test('gender marker support cannot change canonical, tenant, or advertised Markdown identity',()=>{
 for(const changed of[
  html.replace('rel="canonical" href="https://apply.workable.com/imtf/j/7752672F96"','rel="canonical" href="https://apply.workable.com/imtf/j/6F87AB9489"'),
  html.replace('name="subdomain" content="imtf"','name="subdomain" content="other"'),
  html.replace('href="https://apply.workable.com/imtf/jobs/view/7752672F96.md"','href="https://apply.workable.com/other/jobs/view/7752672F96.md"'),
 ]){
  assert.notEqual(changed,html)
  assert.throws(()=>parseRoleHTML(changed,candidate))
 }
})
