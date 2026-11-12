import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readCurrentImmutaProgramme} from '../scraper/immuta/currentProgramme.js'
import {readImmutaIntake} from '../scraper/immuta/currentProgrammeData.js'
import {certifyLeverRequestMetadata} from '../scraper-support/utils/leverRequestMetadataCertificate.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/immuta-current-programme-20261111.json.gz',import.meta.url))))
const intakeOpenings=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/lever-request-metadata-immuta-openings-20261111.json.gz',import.meta.url))))
const PROFILE='immuta-intake-server-publication-v1',INTAKE=fixture.responses[3].requestedURL,sha=b=>createHash('sha256').update(b).digest('hex'),body=row=>Buffer.from(row.bodyBase64,'base64')
const historical=fixture.responses[3],diagnostic=intakeOpenings.responses[1],diagnosticBody=body(diagnostic),native=JSON.parse(body(fixture.responses[2])),grouped=JSON.parse(body(fixture.responses[1]))
const strictMetadata=row=>({headers:structuredClone(row.headers),headerEntries:structuredClone(row.headerEntries)})
const metadata=row=>({profile:PROFILE,requestedURL:row.requestedURL,finalURL:row.finalURL,...strictMetadata(row)})
const sourceTime=row=>{const c=certifyLeverRequestMetadata(body(row).toString('utf8'),strictMetadata(row)),slot=c.literalSlots.find(s=>s.name==='params.t');return{certificate:c,slot,digits:Buffer.from(slot.originalValue,'base64').toString('ascii')}}
function withT(row,digits){const text=body(row).toString('utf8'),{certificate,slot}=sourceTime(row),start=certificate.sourceOffset+slot.offset;return Buffer.from(text.slice(0,start)+Buffer.from(digits,'ascii').toString('base64')+text.slice(start+slot.length))}
function replay(change=p=>p){
 const calls=[]
 return{calls,run:()=>readCurrentImmutaProgramme({now:()=>fixture.capturedAtLast,readPage:async(url,init)=>{
  const index=calls.length,row=fixture.responses[index];assert(row,'No uncaptured extra read');assert.equal(url,row.requestedURL);calls.push({url,init})
  return change({url:row.finalURL,status:row.status,headers:structuredClone(row.headers),headerEntries:structuredClone(row.headerEntries),body:body(row)},{index,row,text:body(row).toString('utf8')})
 }})}
}
async function held(change,expectedReads){const r=replay(change);await assert.rejects(r.run(),e=>e.failureKind==='coverage_gap'&&e.nativeCollectionEvidence.currentDeclaredSourceProgramComplete===false);if(expectedReads!==undefined)assert.equal(r.calls.length,expectedReads);return r}
const synthetic=(page,c)=>c.row.requestedURL===INTAKE?{...page,body:withT(c.row,String(Number(sourceTime(c.row).digits)-(c.index===3?1:2)))}:page

test('explicitly synthetic minus-one opening and minus-two closing qualify only the complete CONTROLLED eight-read protocol',async()=>{
 const r=replay(synthetic),jobs=await r.run(),a=jobs.nativeCollectionEvidence,c=a.intake.requestMetadataCertificate,close=a.intakeClosing.requestMetadataCertificate,e=readInventoryEvidence(jobs)
 assert.equal(r.calls.length,8);assert.deepEqual(r.calls.map(v=>v.url),fixture.responses.map(v=>v.requestedURL));assert.equal(jobs.length,0);assert.equal(e.status,'complete-inventory');assert.equal(e.indiaFacetCount,0);assert.equal(e.reportedTotal,11);assert(sourceLifecycleCleanupForbidden(jobs))
 assert.equal(c.comparisonProfile,PROFILE);assert.equal(close.comparisonProfile,PROFILE);assert.equal(c.timeLiteral.signedDifferenceSeconds,-1);assert.equal(close.timeLiteral.signedDifferenceSeconds,-2);assert.equal(c.comparisonFingerprint,close.comparisonFingerprint);assert.notEqual(c.originalEntitySHA256,close.originalEntitySHA256);assert.equal(a.allFourWholeOpeningClosingEntitiesEqual,false)
 assert.equal(c.tDateBound,false);assert.equal(c.sourceTimeSemanticsQualified,false);assert.equal(close.tDateBound,false);assert.equal(close.sourceTimeSemanticsQualified,false);assert.equal(a.tDateBound,false);assert.equal(a.sourceTimeSemanticsQualified,false);assert.equal(a.requestMetadataComparisonProfile,PROFILE)
 assert.deepEqual(c.requestBinding,{requestedURL:INTAKE,finalURL:INTAKE});assert.equal(c.timeLiteral.originalDate,historical.headers.date);assert.equal(c.timeLiteral.rawBase64,Buffer.from(String(Number(sourceTime(historical).digits)-1)).toString('base64'))
 assert.deepEqual(a.nativePayload,native);assert.deepEqual(a.groupedPayload,grouped);assert.equal(a.observedVacancyCount,11);assert.equal(a.observedRecordCount,12);assert.equal(readSourceObservationEvidence(jobs,'immuta').observedRecordCount,12)
 assert.equal(a.intake.classification,'explicit-native-general-interest-non-position');assert.equal(a.intake.nativeCountry,null);assert.equal(a.intake.nativeLocality,'Remote USA or UK');assert.equal(a.intake.nativeEmploymentType,'Full-time');assert.equal(a.intake.nativeDatePosted,'2024-09-04');assert.equal(a.intake.nativeSchema['@type'],'JobPosting')
 assert(a.intake.fullOwnText.includes('This is a general interest posting and is not tied to a specific open position or work location.'));assert(a.intake.nativeSchema.description.includes('Please see all of our current openings on our careers page.'))
 for(const key of['sourceScopeComplete','companyGlobalScopeQualified','lifecycleCleanupAllowed','legalEmployerQualified','nativePerRoleEmployerFieldQualified','ownVacancyUIQualified','applicationVisited','screeningQualified','browserCORSExecutionQualified','WebflowAndCSSExecutionQualified','otherHiringChannelsQualified'])assert.equal(a[key],false,key)
 assert.equal(a.archiveNativeCollectionEvidence,true);assert.deepEqual(JSON.parse(JSON.stringify(a)),a);assert.match(a.openingClosingEntityEquality.find(v=>v.URL===INTAKE).comparisonScope,/two.*ray.*opaque/i);assert.doesNotMatch(a.openingClosingEntityEquality.find(v=>v.URL===INTAKE).comparisonScope,/three.*header-bound/i)
 assert.equal(Buffer.compare(Buffer.from(a.rawPages[3].bodyBase64,'base64'),withT(historical,String(Number(sourceTime(historical).digits)-1))),0);assert.equal(sha(Buffer.from(a.rawPages[3].bodyBase64,'base64')),a.rawPages[3].bodySHA256);assert.deepEqual(a.rawPages[3].headers,historical.headers);assert.deepEqual(a.rawPages[3].headerEntries,historical.headerEntries)
})

test('strict default still rejects the same explicit synthetic canonical mismatch',()=>assert.throws(()=>certifyLeverRequestMetadata(withT(historical,String(Number(sourceTime(historical).digits)-1)).toString('utf8'),strictMetadata(historical)),/time.*Date/i))
test('legacy pure intake classification retains the unchanged no-profile strict certificate',()=>{
 const html=body(historical).toString('utf8'),model=readImmutaIntake(html,strictMetadata(historical)),certificate=certifyLeverRequestMetadata(html,strictMetadata(historical))
 assert.deepEqual(model.requestMetadataCertificate,certificate);assert.equal(Object.hasOwn(certificate,'comparisonProfile'),false);assert.equal(model.classification,'explicit-native-general-interest-non-position');assert.equal(model.nativeCountry,null)
 assert.throws(()=>readImmutaIntake(withT(historical,String(Number(sourceTime(historical).digits)-1)).toString('utf8'),strictMetadata(historical)),/time.*Date/i)
})

for(const[label,row]of[['historical opening',historical],['separate diagnostic opening',diagnostic]])test(label+' preserves genuine equality with unknown time and non-position countryNULL',()=>{
 assert.equal(sha(body(row)),row.bodySHA256);const model=readImmutaIntake(body(row).toString('utf8'),metadata(row)),c=model.requestMetadataCertificate
 assert.equal(c.comparisonProfile,PROFILE);assert.equal(c.timeLiteral.signedDifferenceSeconds,0);assert.equal(c.tDateBound,false);assert.equal(c.sourceTimeSemanticsQualified,false);assert.equal(c.comparisonFingerprint,'2a2ac2c9a60ac5ce727c119d8fe5c48ad143f60b398939e90400e63a01002ca2');assert.equal(model.nativeCountry,null);assert.equal(model.classification,'explicit-native-general-interest-non-position');assert.equal(model.bodySHA256,row.bodySHA256);assert.equal(model.fullOwnHTML,body(row).toString('utf8'))
})

test('two separately clocked genuine openings reconcile in an explicitly CONTROLLED mixed-interval closing replay',async()=>{
 const jobs=await replay((p,c)=>c.index===4?{...p,url:diagnostic.finalURL,headers:diagnostic.headers,headerEntries:diagnostic.headerEntries,body:diagnosticBody}:p).run(),a=jobs.nativeCollectionEvidence,o=a.intake.requestMetadataCertificate,cl=a.intakeClosing.requestMetadataCertificate
 assert.notEqual(o.originalEntitySHA256,cl.originalEntitySHA256);assert.equal(o.comparisonFingerprint,cl.comparisonFingerprint);assert.equal(o.timeLiteral.signedDifferenceSeconds,0);assert.equal(cl.timeLiteral.signedDifferenceSeconds,0);assert.equal(a.intakeClosing.nativeCountry,null);assert.equal(a.intakeClosing.nativeRawSchema,a.intake.nativeRawSchema);assert.equal(a.intakeClosing.fullOwnText,a.intake.fullOwnText)
})

test('a controlled far canonical opaque literal adds no Date tolerance or freshness authority',async()=>{
 const jobs=await replay((p,c)=>c.index===4?{...p,body:withT(c.row,'1000000000')}:p).run(),c=jobs.nativeCollectionEvidence.intakeClosing.requestMetadataCertificate
 assert.equal(c.timeLiteral.decodedDigits,'1000000000');assert.equal(c.timeLiteral.signedDifferenceSeconds,1000000000-Number(sourceTime(historical).digits));assert.equal(c.tDateBound,false);assert.equal(c.sourceTimeSemanticsQualified,false)
})

for(const[name,value]of[['leading zero','0000000001'],['nine digits','123456789'],['nondigit','179441531X']])test(name+' controlled opaque literal holds',()=>held((p,c)=>c.index===3?{...p,body:withT(c.row,value)}:p,4))

for(const key of['requestedURL','finalURL','headers','headerEntries']){
 test('direct intake requires original own data '+key,()=>{const m=metadata(historical);delete m[key];assert.throws(()=>readImmutaIntake(body(historical).toString('utf8'),m),/metadata|own data|URL|header|provenance/i)})
 test('direct intake never executes receipt accessor '+key,()=>{let callbacks=0;const m=metadata(historical);Object.defineProperty(m,key,{get(){callbacks++;return metadata(historical)[key]}});assert.throws(()=>readImmutaIntake(body(historical).toString('utf8'),m),/metadata|own data|URL|header|provenance/i);assert.equal(callbacks,0)})
}
for(const key of['requestedURL','finalURL'])test('direct intake rejects cross-account '+key,()=>assert.throws(()=>readImmutaIntake(body(historical).toString('utf8'),{...metadata(historical),[key]:'https://jobs.lever.co/loadsmart/'}),/URL|route|profile|Immuta/i))

test('proxy intake metadata is rejected without inspecting traps',()=>{let calls=0;const m=new Proxy(metadata(historical),{get(){calls++;throw Error('trap')},getOwnPropertyDescriptor(){calls++;throw Error('trap')},getPrototypeOf(){calls++;throw Error('trap')}});assert.throws(()=>readImmutaIntake(body(historical).toString('utf8'),m),/metadata|receipt|provenance/i);assert.equal(calls,0)})
test('inherited receipt provenance does not become source-owned metadata',()=>assert.throws(()=>readImmutaIntake(body(historical).toString('utf8'),Object.create(metadata(historical))),/metadata|receipt|provenance|own/i))
test('unknown supplied profile cannot borrow the exact caller profile',()=>assert.throws(()=>readImmutaIntake(body(historical).toString('utf8'),{...metadata(historical),profile:'loadsmart-server-publication-v1'}),/profile/i))
test('receipt profile accessor is rejected without execution',()=>{let calls=0;const m=metadata(historical);Object.defineProperty(m,'profile',{get(){calls++;return PROFILE}});assert.throws(()=>readImmutaIntake(body(historical).toString('utf8'),m),/profile/i);assert.equal(calls,0)})
test('present undefined profile cannot fall back to strict classification',()=>assert.throws(()=>readImmutaIntake(body(historical).toString('utf8'),{...metadata(historical),profile:undefined}),/profile/i))
test('proxy profile value cannot execute or fall back to strict classification',()=>{let calls=0;const profile=new Proxy({},{get(){calls++;throw Error('trap')},getPrototypeOf(){calls++;throw Error('trap')}});assert.throws(()=>readImmutaIntake(body(historical).toString('utf8'),{...metadata(historical),profile}),/profile/i);assert.equal(calls,0)})

for(const[url,label]of[[undefined,'missing'],[INTAKE+'/apply','redirected']])test(label+' original finalURL is held before intake metadata comparison',()=>held((p,c)=>c.index===3?{...p,url}:p,4))
for(const[name,change]of[
 ['own and LD non-position disclaimer',text=>text.replaceAll('This is a general interest posting and is not tied to a specific open position or work location.','This is a specific India vacancy with a work location.')],
 ['current careers direction',text=>text.replaceAll('Please see all of our current openings on our careers page.','This page now contains all current open roles.')],
 ['native schema country',text=>text.replace(/"addressCountry"\s*:\s*null/,'"addressCountry":"IN"')],
 ['outside-literal native criteria',text=>text.replace('</body>','<p>Applicants must be in India.</p></body>')]
])test(name+' remains a complete-entity classification dependency',()=>held((p,c)=>c.index===3?{...p,body:Buffer.from(change(c.text))}:p,4))

test('closing complete API criteria still hold independently of valid intake comparison',()=>held((p,c)=>{if(c.index!==5)return p;const rows=JSON.parse(c.text);rows[0].descriptionBody+='<p>New mandatory certification required.</p>';return{...p,body:Buffer.from(JSON.stringify(rows))}},6))
test('opening native India country remains held',()=>held((p,c)=>{if(c.index!==2)return p;const rows=JSON.parse(c.text);rows[0].country='IN';return{...p,body:Buffer.from(JSON.stringify(rows))}},3))
test('opening intake security policy still holds before comparison',()=>held((p,c)=>c.index===3?{...p,headers:{...p.headers,'content-security-policy':"script-src 'none'"},headerEntries:[...p.headerEntries,['content-security-policy',"script-src 'none'"]]}:p,4))
test('closing corporate consumer changes remain held',()=>held((p,c)=>c.index===7?{...p,body:Buffer.concat([p.body,Buffer.from('<!-- new declaration -->')])}:p,8))
