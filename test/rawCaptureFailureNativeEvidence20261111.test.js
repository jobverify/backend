import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {readFileSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readCurrentImmutaProgramme} from '../scraper/immuta/currentProgramme.js'
import {withRetry} from '../scraper-support/utils/retry.js'
import {saveRawSourceFailure} from '../scraper-support/utils/rawCapture.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/immuta-current-programme-20261111.json.gz',import.meta.url)))),sha=value=>createHash('sha256').update(value).digest('hex')
const temp=async t=>{
 const base=await fs.realpath(os.tmpdir()),directory=await fs.mkdtemp(path.join(base,'jobverify-failure-native-')),owned=path.resolve(directory)
 t.after(async()=>{
  const target=await fs.realpath(owned),relative=path.relative(base,target)
  assert.equal(target,owned,'Cleanup must resolve to the exact owned mkdtemp directory')
  assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Cleanup must stay inside the original temporary root')
  assert.equal(path.dirname(target),base);assert(path.basename(target).startsWith('jobverify-failure-native-'))
  await fs.rm(target,{recursive:true,force:true})
 })
 return owned
}
test('actual held native reader through real retry cause preserves every original raw opening in the failure archive',async t=>{
 const directory=await temp(t);let reads=0,attempts=0,held
 // Four complete original bodies are used. Only the intake cf-ray header is
 // synthetically mismatched to its unchanged source literals, controlling an
 // invariant hold without reconstructing actual31 or relying on t/Date equality.
 try{await withRetry(()=>{attempts++;return readCurrentImmutaProgramme({now:()=>fixture.capturedAtLast,readPage:async url=>{const row=fixture.responses[reads++];assert(row);assert.equal(url,row.requestedURL);const headers=structuredClone(row.headers);if(reads===4)headers['cf-ray']='0000000000000000-LHR';return{url:row.finalURL,status:row.status,headers,body:Buffer.from(row.bodyBase64,'base64')}}})},{label:'immuta-controlled-native-hold',attempts:4,baseDelayMs:0})}catch(error){held=error}
 assert(held);assert.equal(attempts,1);assert.equal(reads,4);assert.match(held.message,/Both exact source rays must bind to original cf-ray/);assert.equal(held.failureKind,'coverage_gap');const audit=Object.getOwnPropertyDescriptor(held.cause,'nativeCollectionEvidence').value;assert.equal(audit.archiveNativeCollectionEvidence,true);assert.equal(audit.currentDeclaredSourceProgramComplete,false);assert.equal(audit.rawPages.length,4);assert.equal(audit.nativePayload.length,11)
 const file=await saveRawSourceFailure(held,{source:'immuta',directory,dryRun:true,now:new Date(fixture.capturedAtLast)}),saved=JSON.parse(await fs.readFile(file,'utf8'))
 assert.equal(saved.type,'failure');assert.equal(saved.error.message,held.message);assert.equal(saved.error.failureKind,'coverage_gap');assert.equal(Object.hasOwn(saved,'jobs'),false);assert.equal(Object.hasOwn(saved,'jobCount'),false);assert(saved.nativeCollectionEvidence,'Missing opted-in native evidence from the original held reader behind actual retry cause')
 assert.deepEqual(saved.nativeCollectionEvidence,audit);for(let i=0;i<4;i++){const page=saved.nativeCollectionEvidence.rawPages[i],original=fixture.responses[i];assert.equal(page.bodySHA256,original.bodySHA256);assert.equal(page.bodyBytes,original.bodyBytes);assert.equal(sha(Buffer.from(page.bodyBase64,'base64')),original.bodySHA256)}
})


const options=directory=>({source:'immuta',directory,dryRun:true,now:new Date(fixture.capturedAtLast)})
const flat=JSON.parse(Buffer.from(fixture.responses[2].bodyBase64,'base64'))
const audit=()=>({source:'immuta',archiveNativeCollectionEvidence:true,currentDeclaredSourceProgramComplete:false,sourceScopeComplete:false,companyGlobalScopeQualified:false,lifecycleCleanupAllowed:false,nativePayload:[structuredClone(flat[0])],rawPages:[structuredClone(fixture.responses[2])],note:'Original actual opening model and raw entity retained in a controlled failure archive.'})
const attach=(error,evidence=audit())=>{Object.defineProperty(error,'nativeCollectionEvidence',{value:evidence,configurable:true});return error}
const saved=async(error,directory)=>{const file=await saveRawSourceFailure(error,options(directory));return JSON.parse(await fs.readFile(file,'utf8'))}
const chain=(inner,count)=>{let error=inner;for(let i=0;i<count;i++)error=new Error('wrapper'+i,{cause:error});return error}

test('direct own opted-in failure evidence preserves original descriptions, response metadata and nonenumerable data',async t=>{const directory=await temp(t),evidence=audit();Object.defineProperty(evidence,'nonenumerableCriteria',{value:'All original mandatory criteria remain visible in the archive.'});const error=attach(new Error('native hold'),evidence);error.failureKind='coverage_gap';const result=await saved(error,directory);assert.equal(result.type,'failure');assert.equal(result.error.message,'native hold');assert.equal(result.error.failureKind,'coverage_gap');assert.equal(result.nativeCollectionEvidence.nonenumerableCriteria,evidence.nonenumerableCriteria);assert.deepEqual(result.nativeCollectionEvidence.nativePayload,evidence.nativePayload);assert.deepEqual(result.nativeCollectionEvidence.rawPages,evidence.rawPages);assert.equal(Object.hasOwn(result,'jobs'),false);assert.equal(Object.hasOwn(result,'inventoryEvidence'),false)})

test('nearest eligible own audit wins without merging inner native observations',async t=>{const directory=await temp(t),inner=attach(new Error('inner')),outerAudit=audit();outerAudit.note='Outer exact native observation';const outer=attach(new Error('outer',{cause:inner}),outerAudit),result=await saved(outer,directory);assert.deepEqual(result.nativeCollectionEvidence,outerAudit);assert.notEqual(result.nativeCollectionEvidence.note,inner.nativeCollectionEvidence.note)})

test('eight own-data error nodes can retain the innermost original audit',async t=>{const directory=await temp(t),inner=attach(new Error('native')),outer=chain(inner,7),result=await saved(outer,directory);assert.deepEqual(result.nativeCollectionEvidence,inner.nativeCollectionEvidence)})

test('a ninth cause node stays outside the bound and its metadata accessor never runs',async t=>{const directory=await temp(t);let calls=0;const inner=new Error('beyond bound');Object.defineProperty(inner,'nativeCollectionEvidence',{get(){calls++;return audit()}});const result=await saved(chain(inner,8),directory);assert.equal(Object.hasOwn(result,'nativeCollectionEvidence'),false);assert.equal(calls,0)})

test('own-data cause cycles terminate while retaining unchanged failure semantics',async t=>{const directory=await temp(t),first=new Error('cycle first'),second=new Error('cycle second');first.cause=second;second.cause=first;const result=await saved(first,directory);assert.equal(result.error.message,'cycle first');assert.equal(result.type,'failure');assert.equal(Object.hasOwn(result,'nativeCollectionEvidence'),false)})

test('inherited causes cannot supply a failure native audit',async t=>{const directory=await temp(t),inner=attach(new Error('inner')),outer=new Error('outer');Object.setPrototypeOf(outer,{cause:inner});const result=await saved(outer,directory);assert.equal(result.error.message,'outer');assert.equal(Object.hasOwn(result,'nativeCollectionEvidence'),false)})

test('own cause accessor is never invoked by the new metadata traversal',async t=>{const directory=await temp(t);let calls=0;const outer=new Error('ordinary fields');Object.defineProperty(outer,'cause',{get(){calls++;return attach(new Error('hidden native'))}});const result=await saved(outer,directory);assert.equal(Object.hasOwn(result,'nativeCollectionEvidence'),false);assert.equal(calls,0)})

test('proxy cause nodes stop without any proxy traps',async t=>{const directory=await temp(t);let calls=0;const invoke=()=>{calls++;throw Error('must not invoke cause proxy')},proxy=new Proxy(attach(new Error('native')),{get:invoke,getOwnPropertyDescriptor:invoke,getPrototypeOf:invoke,ownKeys:invoke}),outer=new Error('ordinary fields',{cause:proxy}),result=await saved(outer,directory);assert.equal(Object.hasOwn(result,'nativeCollectionEvidence'),false);assert.equal(calls,0)})

test('audit accessors and inherited or false flags do not establish opt-in or execute callbacks',async t=>{const directory=await temp(t);let calls=0;const execute=()=>{calls++;throw Error('native metadata accessor must not run')},outerGetter=new Error('outer getter');Object.defineProperty(outerGetter,'nativeCollectionEvidence',{get:execute});const flagGetter={source:'immuta'};Object.defineProperty(flagGetter,'archiveNativeCollectionEvidence',{get:execute});const inheritedFlag=Object.assign(Object.create({archiveNativeCollectionEvidence:true}),{source:'immuta'});for(const error of[outerGetter,attach(new Error('flag getter'),flagGetter),attach(new Error('inherited flag'),inheritedFlag),attach(new Error('false flag'),{...audit(),archiveNativeCollectionEvidence:false}),attach(new Error('unflagged'),{source:'immuta'})]){const result=await saved(error,directory);assert.equal(Object.hasOwn(result,'nativeCollectionEvidence'),false)}assert.equal(calls,0)})

test('ineligible metadata accessors do not conceal a safe own-data cause audit',async t=>{const directory=await temp(t);let calls=0;const inner=attach(new Error('inner')),outer=new Error('outer',{cause:inner});Object.defineProperty(outer,'nativeCollectionEvidence',{get(){calls++;return audit()}});assert.deepEqual((await saved(outer,directory)).nativeCollectionEvidence,inner.nativeCollectionEvidence);assert.equal(calls,0)})

test('proxy audit carriers cannot establish opt-in and execute no traps',async t=>{const directory=await temp(t);let calls=0;const invoke=()=>{calls++;throw Error('must not invoke audit proxy')},proxy=new Proxy(audit(),{get:invoke,getOwnPropertyDescriptor:invoke,getPrototypeOf:invoke,ownKeys:invoke});const result=await saved(attach(new Error('native hold'),proxy),directory);assert.equal(Object.hasOwn(result,'nativeCollectionEvidence'),false);assert.equal(calls,0)})

for(const[name,mutate]of[
 ['source mismatch',a=>{a.source='loadsmart'}],['missing source',a=>{delete a.source}],['undefined',a=>{a.condition=undefined}],['nonfinite',a=>{a.condition=NaN}],['infinite',a=>{a.condition=Infinity}],['negative zero',a=>{a.condition=-0}],['BigInt',a=>{a.condition=1n}],['function',a=>{a.condition=()=>1}],['symbol value',a=>{a.condition=Symbol('data')}],['symbol key',a=>{a[Symbol('data')]='value'}],['Date instance',a=>{a.condition=new Date()}],['Map instance',a=>{a.condition=new Map([['country','GB']])}],['typed array',a=>{a.condition=new Uint8Array([1,2])}],['sparse array',a=>{a.condition=new Array(2)}],['extended array',a=>{a.condition=[];a.condition.extra='unknown'}],['cycle',a=>{a.condition=a}],['custom prototype',a=>{a.condition=Object.assign(Object.create({inherited:true}),{original:'data'})}]
])test('invalid flagged failure audit '+name+' rejects before any archive filesystem write',async t=>{const directory=await temp(t),a=audit();mutate(a);await assert.rejects(saveRawSourceFailure(new Error('retry wrapper',{cause:attach(new Error('native hold'),a)}),options(directory)),/nativeCollectionEvidence/i);assert.deepEqual(await fs.readdir(directory),[])})

for(const kind of['source getter','nested getter','array getter','toJSON function','toJSON getter','nested proxy'])test('flagged failure audit '+kind+' rejects without executing native metadata code',async t=>{const directory=await temp(t),a=audit();let calls=0;const execute=()=>{calls++;throw Error('do not execute native data')};if(kind==='source getter')Object.defineProperty(a,'source',{get:execute});else if(kind==='nested getter'){a.condition={};Object.defineProperty(a.condition,'criterion',{get:execute})}else if(kind==='array getter'){a.condition=[1];Object.defineProperty(a.condition,'0',{get:execute})}else if(kind==='toJSON function')a.toJSON=execute;else if(kind==='toJSON getter')Object.defineProperty(a,'toJSON',{get:execute});else a.condition=new Proxy({native:'data'},{get:execute,getPrototypeOf:execute,getOwnPropertyDescriptor:execute,ownKeys:execute});await assert.rejects(saveRawSourceFailure(attach(new Error('hold'),a),options(directory)),/nativeCollectionEvidence/i);assert.equal(calls,0);assert.deepEqual(await fs.readdir(directory),[])})

test('an invalid nearest flagged audit cannot be skipped for a valid inner one',async t=>{const directory=await temp(t),bad=audit();bad.source='different';const inner=attach(new Error('inner')),outer=attach(new Error('outer',{cause:inner}),bad);await assert.rejects(saveRawSourceFailure(outer,options(directory)),/nativeCollectionEvidence/i);assert.deepEqual(await fs.readdir(directory),[])})

test('live and no-directory failures perform no new audit or cause metadata work',async t=>{const directory=await temp(t);let calls=0;const execute=()=>{calls++;throw Error('metadata work must be skipped')},error=new Error('ordinary legacy fields');Object.defineProperty(error,'nativeCollectionEvidence',{get:execute});Object.defineProperty(error,'cause',{get:execute});const previous=process.env.SCRAPER_RAW_CAPTURE_DIRECTORY;delete process.env.SCRAPER_RAW_CAPTURE_DIRECTORY;t.after(()=>{if(previous===undefined)delete process.env.SCRAPER_RAW_CAPTURE_DIRECTORY;else process.env.SCRAPER_RAW_CAPTURE_DIRECTORY=previous});assert.equal(await saveRawSourceFailure(error,{source:'immuta',directory,dryRun:false}),null);assert.equal(await saveRawSourceFailure(error,{source:'immuta',directory:' ',dryRun:true}),null);assert.equal(await saveRawSourceFailure(error,{source:'immuta',dryRun:true}),null);const bad=audit();bad.condition=1n;assert.equal(await saveRawSourceFailure(attach(new Error('ordinary'),bad),{source:'immuta',directory,dryRun:false}),null);assert.equal(calls,0);assert.deepEqual(await fs.readdir(directory),[])})

test('legacy failure field extraction and immutable capture references remain unchanged',async t=>{const directory=await temp(t),error=new Error('original message');error.name='OriginalError';error.code='NATIVE_HOLD';error.failureKind='coverage_gap';error.classificationPending=true;const file=await saveRawSourceFailure(error,{...options(directory),captureFile:'prior-immutable.jobs.json'}),result=JSON.parse(await fs.readFile(file,'utf8'));assert.deepEqual(result.error,{name:'OriginalError',message:'original message',code:'NATIVE_HOLD',failureKind:'coverage_gap',classificationPending:true});assert.equal(result.captureFile,'prior-immutable.jobs.json');assert.equal(Object.hasOwn(result,'nativeCollectionEvidence'),false);assert.equal(Object.hasOwn(result,'jobs'),false);assert.equal(Object.hasOwn(result,'jobCount'),false);assert.deepEqual((await fs.readdir(path.dirname(file))).filter(name=>name.endsWith('.tmp')),[])})
