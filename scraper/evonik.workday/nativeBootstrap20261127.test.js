import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readEvonikLanding,readEvonikRole} from './currentNativeData20261114.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-bootstrap-20261127.json.gz',import.meta.url))))
const original=Buffer.from(fixture.packet.bodyBase64,'base64').toString()
const reviewed=JSON.parse(readFileSync(new URL('./reviewedNativeData20261114.json',import.meta.url)))
const profile=reviewed.roles.find(row=>row.id==='R52507')
const page=(change=text=>text)=>{const text=change(original);return{text,bytes:Buffer.from(text)}}
const authority=error=>error.softFailure===true&&error.abortRetries===true&&error.lifecycleCleanupAllowed===false&&error.sourceScopeComplete===false
const schemaChange=(text,change)=>text.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(all,start,raw,end)=>{const value=JSON.parse(raw);change(value);return start+JSON.stringify(value)+end})

test('genuine current bootstrap retains exact account and complete original criteria as data with programme holds',()=>{
 const result=readEvonikLanding(page(),profile)
 assert.equal(result.model.identifier.value,'R52507')
 assert.equal(result.model.description,profile.publicSchema.description)
 assert.equal(result.account.tenant,'evonik')
 assert.equal(result.account.siteId,'External_Careers')
 assert.equal(result.account.postingAvailable,true)
 assert.equal(result.account.wholeProgramQualified,false)
 assert.equal(result.account.tokenValueShapeOrLengthQualified,false)
 assert.equal(result.wholeExecutableOrCSSOrUIOrApplicationQualified,false)
})

test('only the already unqualified public token literal may differ inside the finite current programme',()=>{
 const result=readEvonikLanding(page(text=>text.replace(/(token:\s*)"(?:[^"\\]|\\.)*"/,'$1"different-unqualified-public-token"')),profile)
 assert.equal(result.account.wholeProgramQualified,false)
 assert.equal(result.account.tokenValueShapeOrLengthQualified,false)
 assert.equal(result.model.identifier.value,'R52507')
})

const negatives=[
 ['changed toggle identity',text=>text.replace('d1584fca3857100011d5595041c00000','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')],
 ['extra toggle',text=>text.replace('toggles: [','toggles: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",')],
 ['missing toggle',text=>text.replace('"d1584fca3857100011d5595041c00000",','')],
 ['duplicate toggle',text=>text.replace('d1584fca3857100011d5595041c00000','d72ef83634b710001a93a11d485b0000')],
 ['foreign tenant',text=>text.replace('tenant: "evonik"','tenant: "other"')],
 ['foreign account site',text=>text.replace('siteId: "External_Careers"','siteId: "Other_Careers"')],
 ['foreign executable origin',text=>text.replace('clientOrigin: "https://wd3.myworkday.com"','clientOrigin: "https://other.example"')],
 ['changed executable action',text=>text.replace('document.head.appendChild(sharedVendorsLoaderScript)','document.body.appendChild(sharedVendorsLoaderScript)')],
 ['additional executable action',text=>text.replace('document.head.appendChild(sharedVendorsLoaderScript);','document.head.appendChild(sharedVendorsLoaderScript); window.unreviewed=true;')],
 ['nonliteral token action',text=>text.replace(/(token:\s*)"(?:[^"\\]|\\.)*"/,'$1getOtherToken()')],
 ['nonliteral token concatenation',text=>text.replace(/(token:\s*)"(?:[^"\\]|\\.)*"/,'$1"different" + "token"')],
 ['unavailable posting',text=>text.replace('postingAvailable: true','postingAvailable: false')],
 ['extra account authority',text=>text.replace('postingAvailable: true','postingAvailable: true, foreignAccount: true')],
 ['changed complete public criteria',text=>schemaChange(text,value=>value.description+='Mandatory new qualification.')],
 ['unknown country alternative',text=>schemaChange(text,value=>value.jobLocation.address.addressCountry='Singapore')],
]
for(const[label,change]of negatives)test('current native bootstrap carrier rejects '+label,()=>{
 const changed=page(change)
 assert.notEqual(changed.text,original,'Mutation changes the genuine entity')
 assert.throws(()=>readEvonikLanding(changed,profile),authority)
})

const relativeText=Buffer.from(fixture.relativeDayPacket.bodyBase64,'base64').toString()
const relativeRow=reviewed.IndiaRows.find(row=>row.bulletFields[0]==='R52796')
test('genuine singular time-left display preserves the original native absolute dates and full criteria',()=>{
 const result=readEvonikRole(relativeText,relativeRow,'2026-11-27T19:14:33.682Z').data
 assert.equal(result.jobPostingInfo.timeLeftToApply,'1 day left to apply')
 assert.equal(result.jobPostingInfo.startDate,'2026-11-05')
 assert.equal(result.jobPostingInfo.endDate,'2026-11-30')
 assert.equal(result.jobPostingInfo.jobDescription,reviewed.roles.find(row=>row.id==='R52796').APIRecord.jobPostingInfo.jobDescription)
})
for(const display of ['2 day left to apply','1 day left to apply; position closed','This job is closed.'])test('singular display support rejects unreviewed status '+display,()=>{
 const value=JSON.parse(relativeText);value.jobPostingInfo.timeLeftToApply=display
 assert.throws(()=>readEvonikRole(JSON.stringify(value),relativeRow,'2026-11-27T19:14:33.682Z'),authority)
})
test('singular time-left display cannot keep an absolutely expired native role open',()=>{
 assert.throws(()=>readEvonikRole(relativeText,relativeRow,'2026-12-01T00:00:00.000Z'),error=>authority(error)&&/future\/expired\/closed/.test(error.message))
})
