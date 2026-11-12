import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readCurrentLoadsmartProgramme} from '../scraper/loadsmart/currentProgramme.js'
import {readLoadsmartBoard} from '../scraper/loadsmart/currentProgrammeData.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../scraper-support/utils/inventoryEvidence.js'
import {certifyLeverRequestMetadata} from '../scraper-support/utils/leverRequestMetadataCertificate.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/loadsmart-opaque-comparison-20261111.json.gz',import.meta.url))))
const oldFixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/loadsmart-current-programme-20261111.json.gz',import.meta.url))))
const PROFILE='loadsmart-server-publication-v1',BOARD='https://jobs.lever.co/loadsmart/',order=fixture.controlledReplay.order
const sha=b=>createHash('sha256').update(b).digest('hex'),body=row=>Buffer.from(row.bodyBase64,'base64'),native=JSON.parse(body(fixture.responses[3]))
const metadata=row=>({requestedURL:row.requestedURL,finalURL:row.finalURL,headers:structuredClone(row.headers),headerEntries:structuredClone(row.headerEntries)})
function replay(change=p=>p){const calls=[];return{calls,run:()=>readCurrentLoadsmartProgramme({now:()=> '2026-11-11T18:18:16.185Z',readPage:async(url,init)=>{const index=calls.length,row=fixture.responses[order[index]];assert(row,'No unrecorded request');assert.equal(url,row.requestedURL);calls.push({url,init});return change({url:row.finalURL,status:row.status,headers:structuredClone(row.headers),headerEntries:structuredClone(row.headerEntries),body:body(row)},{index,row,text:body(row).toString('utf8')})}})}}
async function held(change){const r=replay(change);await assert.rejects(r.run(),e=>e.failureKind==='coverage_gap'&&e.nativeCollectionEvidence.currentDeclaredSourceProgramComplete===false);return r}

test('actual32 minus-one board qualifies only a complete CONTROLLED mixed-interval replay',async()=>{
 const r=replay(),jobs=await r.run(),a=jobs.nativeCollectionEvidence,i=readInventoryEvidence(jobs),c=a.board.requestMetadataCertificate
 assert.equal(r.calls.length,8);assert.equal(jobs.length,0);assert.equal(i.status,'complete-inventory');assert.equal(i.reportedTotal,null);assert.equal(i.indiaFacetCount,0);assert(sourceLifecycleCleanupForbidden(jobs))
 assert.deepEqual(a.nativePayload,native);assert.equal(a.observedVacancyCount,11);assert.equal(a.archiveNativeCollectionEvidence,true);assert.equal(c.comparisonProfile,PROFILE)
 assert.equal(c.timeLiteral.rawBase64,'MTc5NDQyMTEyNA==');assert.equal(c.timeLiteral.decodedDigits,'1794421124');assert.equal(c.timeLiteral.originalDate,'Wed, 11 Nov 2026 18:18:45 GMT');assert.equal(c.timeLiteral.signedDifferenceSeconds,-1)
 assert.equal(c.tDateBound,false);assert.equal(c.sourceTimeSemanticsQualified,false);assert.equal(a.tDateBound,false);assert.equal(a.sourceTimeSemanticsQualified,false)
 assert.equal(a.boardClosing.requestMetadataCertificate.timeLiteral.signedDifferenceSeconds,-1);assert.deepEqual(a.rawPages[1].headers,fixture.responses[1].headers);assert.deepEqual(a.rawPages[1].headerEntries,fixture.responses[1].headerEntries)
 assert.equal(a.rawPages[1].requestedURL,BOARD);assert.equal(a.rawPages[1].finalURL,BOARD);assert.equal(a.rawPages[1].bodySHA256,'5660a270598f28dcd288c37a68043aa5b89e300c2ff953b3d68d6190d3771cb3');assert.equal(sha(Buffer.from(a.rawPages[1].bodyBase64,'base64')),a.rawPages[1].bodySHA256)
 for(const k of['sourceScopeComplete','companyGlobalScopeQualified','lifecycleCleanupAllowed','nativePerRoleEmployerFieldQualified','legalEmployerQualified','ownVacancyUIQualified','applicationVisited','screeningQualified','browserCORSExecutionQualified','publisherScriptsExecuted','unacquiredChildrenQualified'])assert.equal(a[k],false,k)
 assert.equal(a.publicationDate,null);assert.equal(a.closingDate,null);assert.match(a.openingClosingEquality.find(p=>p.URL===BOARD).comparisonScope,/two.*ray.*opaque/i);assert.doesNotMatch(a.openingClosingEquality.find(p=>p.URL===BOARD).comparisonScope,/three.*header-bound/i)
 assert.equal(fixture.actual32.failed,true);assert.equal(fixture.actual32.acquiredOpenings,2);assert.equal(fixture.actual32.acquiredClosings,0);assert.equal(fixture.recoveryClaim,false)
})

test('strict default still rejects the same actual32 source timestamp',()=>{const row=fixture.responses[1];assert.throws(()=>certifyLeverRequestMetadata(body(row).toString('utf8'),{headers:row.headers,headerEntries:row.headerEntries}),/time.*Date/i)})

test('equal digits and Date do not qualify source time semantics under the opt-in',async()=>{const jobs=await replay((p,c)=>c.row.kind==='board'?{...p,headers:oldFixture.responses[1].headers,headerEntries:oldFixture.responses[1].headerEntries,body:body(oldFixture.responses[1])}:p).run(),c=jobs.nativeCollectionEvidence.board.requestMetadataCertificate;assert.equal(c.timeLiteral.signedDifferenceSeconds,0);assert.equal(c.tDateBound,false);assert.equal(c.sourceTimeSemanticsQualified,false)})

test('controlled distinct canonical opaque t changes only comparison, not raw evidence or time authority',async()=>{
 const r=replay((p,c)=>c.index===6?{...p,body:Buffer.from(c.text.replace('MTc5NDQyMTEyNA==','MTAwMDAwMDAwMA=='))}:p),jobs=await r.run(),a=jobs.nativeCollectionEvidence,o=a.board.requestMetadataCertificate,cl=a.boardClosing.requestMetadataCertificate
 assert.equal(o.comparisonFingerprint,cl.comparisonFingerprint);assert.notEqual(o.originalEntitySHA256,cl.originalEntitySHA256);assert.notEqual(a.rawPages[1].bodySHA256,a.rawPages[6].bodySHA256);assert.equal(cl.timeLiteral.decodedDigits,'1000000000');assert.equal(cl.timeLiteral.signedDifferenceSeconds,1000000000-1794421125);assert.equal(cl.tDateBound,false);assert.equal(cl.sourceTimeSemanticsQualified,false)
 assert.equal(a.openingClosingEquality.find(p=>p.URL===BOARD).wholeRawEntityEqual,false)
})

for(const[name,value]of[['leading-zero','MDAwMDAwMDAwMQ=='],['nine digits','MTIzNDU2Nzg5'],['nondigit','MTc5NDQyMTEyWA=='],['noncanonical padding','MTc5NDQyMTEyNA=']])test(name+' opaque literal withholds controlled protocol',()=>held((p,c)=>c.row.kind==='board'?{...p,body:Buffer.from(c.text.replace('MTc5NDQyMTEyNA==',value))}:p))

for(const key of['requestedURL','finalURL']){
 test('direct board proof refuses missing original '+key,()=>{const m=metadata(oldFixture.responses[1]);delete m[key];assert.throws(()=>readLoadsmartBoard(body(oldFixture.responses[1]).toString('utf8'),m),/URL|provenance|metadata|own data/i)})
 test('direct board proof never executes accessor '+key,()=>{let calls=0;const m=metadata(oldFixture.responses[1]);Object.defineProperty(m,key,{get(){calls++;return BOARD}});assert.throws(()=>readLoadsmartBoard(body(oldFixture.responses[1]).toString('utf8'),m),/URL|metadata|own data/i);assert.equal(calls,0)})
 test('direct board proof rejects foreign '+key,()=>{const m={...metadata(oldFixture.responses[1]),[key]:'https://jobs.lever.co/immuta/'};assert.throws(()=>readLoadsmartBoard(body(oldFixture.responses[1]).toString('utf8'),m),/URL|route|Loadsmart|profile/i)})
}
test('proxy receipt is ineligible without trap inspection',()=>{let traps=0;const m=new Proxy(metadata(oldFixture.responses[1]),{get(){traps++;throw Error('trap')},getOwnPropertyDescriptor(){traps++;throw Error('trap')},getPrototypeOf(){traps++;throw Error('trap')}});assert.throws(()=>readLoadsmartBoard(body(oldFixture.responses[1]).toString('utf8'),m),/metadata|receipt|provenance/i);assert.equal(traps,0)})
test('unknown supplied receipt profile does not borrow the known Loadsmart caller',()=>{const m={...metadata(oldFixture.responses[1]),profile:'unknown-profile'};assert.throws(()=>readLoadsmartBoard(body(oldFixture.responses[1]).toString('utf8'),m),/profile/i)})
test('raw transport redirected board cannot be given fabricated final identity',async()=>{const r=await held((p,c)=>c.index===1?{...p,url:BOARD+'?location=India'}:p);assert.equal(r.calls.length,2)})
test('raw transport absent final URL remains absent',async()=>{const r=await held((p,c)=>c.index===1?{...p,url:undefined}:p);assert.equal(r.calls.length,2)})
test('full API original criteria drift at closing still holds',async()=>{const r=await held((p,c)=>{if(c.index!==4)return p;const rows=JSON.parse(c.text);rows[0].lists.push({text:'New condition',content:'<p>Mandatory current certification required for all applicants.</p>'});return{...p,body:Buffer.from(JSON.stringify(rows))}});assert.equal(r.calls.length,5)})
test('native country India remains held under the new metadata profile',async()=>{const r=await held((p,c)=>{if(c.index!==3)return p;const rows=JSON.parse(c.text);rows[0].country='IN';return{...p,body:Buffer.from(JSON.stringify(rows))}});assert.equal(r.calls.length,4)})
test('wrong complete client remains held before native API read',async()=>{const r=await held((p,c)=>c.index===2?{...p,body:Buffer.concat([p.body,Buffer.from('fetch("/new-jobs")')])}:p);assert.equal(r.calls.length,3)})
test('opening board CSP denial holds before metadata comparison',async()=>{const r=await held((p,c)=>c.index===1?{...p,headers:{...p.headers,'content-security-policy':"script-src 'none'"},headerEntries:[...p.headerEntries,['content-security-policy',"script-src 'none'"]]}:p);assert.equal(r.calls.length,2)})
test('outside-literal closing board byte remains in complete entity comparison',async()=>{const r=await held((p,c)=>c.index===6?{...p,body:Buffer.from(c.text.replace('</body>','<!-- changed --> </body>'))}:p);assert.equal(r.calls.length,7)})
test('actual32 original literal fingerprints do not rewrite the source bytes',async()=>{const jobs=await replay().run(),a=jobs.nativeCollectionEvidence;assert.equal(Buffer.compare(Buffer.from(a.rawPages[1].bodyBase64,'base64'),body(fixture.responses[1])),0);assert.equal(Object.hasOwn(a.board.requestMetadataCertificate,'html'),false);assert.deepEqual(a.nativePayload,native);assert.equal(a.allOpeningReadsBeforeClosing,true)})
