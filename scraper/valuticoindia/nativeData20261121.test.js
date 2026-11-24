import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readCorporate,readModernShell,readAccount,readJob,strictJSON} from './nativeData20261121.js'
const fixture=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/current-native-prefix-20261121.json.gz',import.meta.url))))
const packets=new Map(fixture.responses.map(r=>{const b=Buffer.from(r.bodyBase64,'base64');assert.equal(createHash('sha256').update(b).digest('hex'),r.receipt.persistedSHA256);assert.equal(b.length,r.receipt.persistedBytes);return[r.kind,b.toString('utf8')]}))
const careers=()=>readCorporate(packets.get('corporateCareers'),'https://valutico.com/careers/')
const card=()=>careers().cards[0]
const shell=()=>readModernShell(packets.get('modern5856345'),'https://apply.workable.com/valutico-2/j/720E76FE8A',card())
const account=()=>readAccount(packets.get('account'))
const job=()=>JSON.parse(packets.get('job5856345'))
const read=value=>readJob(JSON.stringify(value),account(),card(),shell())
test('actual9 native corporate ApplyNow cards, all authored country lists and full direct card text retained',()=>{
 const value=careers()
 assert.equal(value.cards.length,9);assert.equal(new Set(value.cards.map(r=>r.legacyNativeId)).size,9)
 assert.deepEqual(value.cards[0].countries,['United Kingdom','Ireland','Austria','Netherlands','Portugal','Spain'])
 assert.equal(value.cards[1].countries.includes('India'),false)
 assert.ok(value.cards[0].nativeCardText.includes('Department: Sales'))
 assert.equal(value.cards[0].applicationDeclaration.label,'Apply Now')
})
test('current shell and account bind actual current client, legacy ID and route shortcode',()=>{
 const s=shell(),a=account()
 assert.equal(s.shortcode,'720E76FE8A');assert.equal(s.legacyNativeId,5856345)
 assert.equal(s.clientURL,'https://dcvxs6ggqztsa.cloudfront.net/candidate/releases/careers.161358c697182b07.js')
 assert.equal(a.name,'Valutico');assert.equal(a.uid,job().accountUid)
})
test('full actual19field native DTO and3authored HTML criteria fields retained without India or fresh date inference',()=>{
 const raw=job(),value=read(raw)
 assert.deepEqual(value.nativeJob,raw);assert.equal(Object.keys(value.nativeJob).length,19)
 assert.equal(value.nativeCountry,'United Kingdom');assert.equal(value.nativePublicationDate,'2026-06-02T00:00:00.000Z')
 assert.equal(value.sourceCountryQualifiedForIndia,false);assert.equal(value.roleFactsQualified,true)
 for(const key of ['description','requirements','benefits'])assert.ok(value.sourceDescription.includes(raw[key]))
})
for(const [name,change]of[
 ['foreign employer UID',j=>j.accountUid='00000000-0000-4000-8000-000000000000'],
 ['different legacy role ID',j=>j.id++],
 ['different shortcode',j=>j.shortcode='AAAAAAAAAA'],
 ['different authored title',j=>j.title='Unbound foreign role']
])test(name+' rejects role identity donation',()=>{assert.equal(read(job()).roleFactsQualified,true);const j=job();change(j);assert.throws(()=>read(j))})
for(const[name,change,issue]of[
 ['unknown native criterion',j=>j.additionalRequirements='New mandatory publisher instruction','unreviewed-native-fields'],
 ['hidden location',j=>j.locations[0].hidden=true,'unqualified-native-location'],
 ['missing country',j=>j.location.country=null,'unqualified-native-location'],
 ['city only',j=>{j.location.country=null;j.location.countryCode=null;j.location.city='Bangalore'},'unqualified-native-location'],
 ['internal posting',j=>j.isInternal=true,'not-current-public-publication'],
 ['unpublished role',j=>j.state='draft','not-current-public-publication'],
 ['missing native date',j=>j.published=null,'unqualified-native-publication-date']
])test(name+' remains a full held observation',()=>{
 assert.equal(read(job()).roleFactsQualified,true);const raw=job();change(raw);const value=read(raw)
 assert.deepEqual(value.nativeJob,raw);assert.equal(value.roleFactsQualified,false);assert.equal(value.sourceCountryQualifiedForIndia,false)
 assert.ok(value.qualificationIssues.includes(issue))
})
test('new aligned authored criteria retained, not rejected by obsolete prose whitelist',()=>{
 const raw=job();raw.requirements+='<p>Additional authored qualification.</p>'
 const value=read(raw);assert.equal(value.roleFactsQualified,true);assert.ok(value.sourceDescription.includes('Additional authored qualification.'))
})
test('duplicate/escaped JSON keys rejected before record admission',()=>{
 assert.throws(()=>strictJSON('{"id":1,"id":2}'))
 assert.throws(()=>strictJSON('{"x":{"name":1,"\\u006eame":2}}'))
})
for(const[name,extra]of[
 ['additional foreign hiring channel','<iframe src="/jobs/india"></iframe>'],
 ['parameterized JobPosting','<script type="application/ld+json; charset=utf-8">{"@type":"JobPosting","title":"Unobserved role"}</script>'],
 ['microdata JobPosting','<div itemscope itemtype="https://schema.org/JobPosting"></div>'],
 ['explicit closure','<p>Applications are closed.</p>']
])test(name+' prevents false configured inventory completion',()=>{assert.equal(careers().cards.length,9);assert.throws(()=>readCorporate(packets.get('corporateCareers')+extra,'https://valutico.com/careers/'))})
test('foreign Workable account handoff never qualifies',()=>{
 assert.equal(shell().account,'valutico-2');const text=packets.get('modern5856345').replaceAll('valutico-2','foreign-tenant')
 assert.throws(()=>readModernShell(text,'https://apply.workable.com/foreign-tenant/j/720E76FE8A',card()))
})

for(const[name,extra]of[
 ['role-shell JSONLD conflict','<script type="application/ld+json; charset=utf-8">{"@type":"JobPosting","title":"Conflicting role criteria","applicantLocationRequirements":"India"}</script>'],
 ['role-shell microdata conflict','<div itemscope itemtype="https://schema.org/JobPosting"><meta itemprop="applicantLocationRequirements" content="India"></div>'],
 ['role-shell explicit closure','<p>Applications are closed.</p>']
])test(name+' cannot be ignored in favour of otherwise intact API binding',()=>{
 assert.equal(shell().legacyNativeId,5856345)
 assert.throws(()=>readModernShell(packets.get('modern5856345')+extra,'https://apply.workable.com/valutico-2/j/720E76FE8A',card()))
})
test('additional country-filtered native hiring form remains an unreviewed channel',()=>{
 assert.equal(careers().cards.length,9)
 assert.throws(()=>readCorporate(packets.get('corporateCareers')+'<form action="/careers/search"><select name="country"><option>India</option></select><button>Search jobs</button></form>','https://valutico.com/careers/'))
})

function replaceRawAttribute(html,key,value,next){
 for(const quote of ['"',"'"]){const literal=key+'='+quote+value+quote;if(html.includes(literal))return html.replace(literal,key+'='+quote+next+quote)}
 throw Error('Original raw attribute setup absent')
}
for(const[name,mutate]of[
 ['own legacy role href',()=>readCorporate(replaceRawAttribute(packets.get('corporateCareers'),'href',card().legacyURL,card().legacyURL.replace('workable','work&#x26;#97;ble')),'https://valutico.com/careers/')],
 ['modern canonical account',()=>readModernShell(packets.get('modern5856345').replace(/<link\b[^>]*>/gi,tag=>/\brel=['"']canonical['"']/i.test(tag)?replaceRawAttribute(tag,'href',shell().canonical,shell().canonical.replace('valutico-2','valutic&#x26;#111;-2')):tag),shell().canonical,card())],
 ['modern native account meta',()=>readModernShell(replaceRawAttribute(packets.get('modern5856345'),'content','valutico-2','valutic&#x26;#111;-2'),shell().canonical,card())]
])test(name+' is decoded exactly once from actual raw attribute token',()=>{
 assert.equal(careers().cards.length,9);assert.equal(shell().account,'valutico-2')
 assert.throws(mutate)
})
test('single entity authority spelling preserves native literal token and one decoded URL',()=>{
 const html=replaceRawAttribute(packets.get('corporateCareers'),'href',card().legacyURL,card().legacyURL.replace('workable','work&#97;ble'))
 const observed=readCorporate(html,'https://valutico.com/careers/').cards[0]
 assert.equal(observed.legacyURL,card().legacyURL)
 assert.ok(observed.nativeCardHTML.includes('work&#97;ble'))
 assert.ok(observed.applicationDeclaration.rawAttributeTokens.some(([name,value])=>name==='href'&&value.includes('work&#97;ble')))
})

test('nested numeric entity in own card title never matches unchanged native DTO',()=>{
 const html=packets.get('corporateCareers'),mutated=html.replace(card().nativeCardHTML,card().nativeCardHTML.replace('Account Executive','&#x26;#65;ccount Executive'))
 assert.ok(mutated!==html,'Original card mutation must change retained HTML');assert.equal(read(job()).roleFactsQualified,true)
 const changed=readCorporate(mutated,'https://valutico.com/careers/').cards[0]
 assert.notEqual(changed.title,card().title)
 assert.throws(()=>readJob(packets.get('job5856345'),account(),changed,shell()))
})
test('nested numeric entity in own card country remains literal and cannot donate the unchanged native country',()=>{
 const html=packets.get('corporateCareers'),mutated=html.replace(card().nativeCardHTML,card().nativeCardHTML.replace('United Kingdom','&#x26;#85;nited Kingdom'))
 assert.ok(mutated!==html,'Original card mutation must change retained HTML');assert.equal(read(job()).roleFactsQualified,true)
 const changed=readCorporate(mutated,'https://valutico.com/careers/').cards[0]
 assert.notDeepEqual(changed.countries,card().countries)
 const value=readJob(packets.get('job5856345'),account(),changed,shell())
 assert.equal(value.roleFactsQualified,false);assert.ok(value.qualificationIssues.includes('corporate-native-country-mismatch'))
})

test('object native requisition code stays a full held actual foreign observation',()=>{
 const raw=job();assert.equal(read(raw).roleFactsQualified,true);raw.code={}
 const value=read(raw)
 assert.deepEqual(value.nativeJob,raw);assert.equal(value.nativeCountry,'United Kingdom')
 assert.equal(value.nativePublicationDate,'2026-06-02T00:00:00.000Z')
 assert.equal(value.roleFactsQualified,false);assert.ok(value.qualificationIssues.includes('unqualified-native-requisition-code'))
})
