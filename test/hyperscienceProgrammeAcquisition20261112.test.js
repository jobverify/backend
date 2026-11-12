import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {reconcileHyperscienceAcquiredProgramme} from '../scraper/hyperscience/currentProgrammeAcquisition.js';
import {reconcileHyperscienceServerProgramme} from '../scraper/hyperscience/currentProgrammeData.js';

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/hyperscience-server-programme-components-20261111.json.gz',import.meta.url))));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const packet=kind=>{const row=fixture.responses.find(row=>row.kind===kind);assert(row);return{body:Buffer.from(row.bodyBase64,'base64'),receipt:structuredClone(row.receipt)};};
const input=()=>({entry:packet('C0'),positions:packet('C1'),api:packet('A'),
  roles:JSON.parse(packet('A').body).jobs.map(row=>packet('O-'+row.id.slice(0,8))),
  intakeShell:packet('H'),intakeClient:{manifest:packet('M'),entry:packet('S'),requestBody:Buffer.from(fixture.request.bodyBase64,'base64')},
  intakeOpening:packet('Q-first'),intakeClosing:packet('Q-repeat')});
const queryKeys=['intakeOpening','intakeClosing'];
const counterKeys=['consumedBodyBytes','discardedOverflowBytes','overflowBytes'];
const code='HYPERSCIENCE_PROGRAMME_HOLD';
const held=(value,gate)=>assert.throws(()=>reconcileHyperscienceAcquiredProgramme(value),error=>error.code===code&&error.gate===gate);
const packets=value=>[value.entry,value.positions,value.api,...value.roles,value.intakeShell,value.intakeClient.manifest,value.intakeClient.entry,value.intakeOpening,value.intakeClosing];
function completeControlledMetadata(value){
  // These added GET entry views/completion flags/response clocks are controlled
  // test data. The historical fixture and its five missing views stay unchanged.
  for(const row of packets(value).slice(0,-2)){
    if(!Object.hasOwn(row.receipt,'headerEntries'))row.receipt.headerEntries=Object.entries(row.receipt.headers);
    row.receipt.bodyComplete=true;row.receipt.streamDone=true;row.receipt.decodedPrefixOnly=false;
    row.receipt.responseAt??=row.receipt.completedAt;
  }
  return value;
}
function measuredQueries(value){for(const key of queryKeys){const row=value[key];row.receipt.consumedBodyBytes=row.body.length;row.receipt.discardedOverflowBytes=0;row.receipt.overflowBytes=0;}return value;}
function setBody(row,bytes){row.body=Buffer.from(bytes);row.receipt.bodyBytes=row.body.length;row.receipt.bodySHA256=sha(row.body);if(Object.hasOwn(row.receipt,'consumedBodyBytes'))row.receipt.consumedBodyBytes=row.body.length;}
function assertPure(result){
  assert.equal(result.nativeRecords.length,4);
  assert.equal(result.intake.comparison.rawEntityEqual,false);
  assert.equal(result.intake.comparison.serverDefinitionCriteriaEqual,true);
  assert.equal(result.qualificationFacts.allWholeBodiesEqual,false);
  assert.equal(result.qualificationFacts.currentTransactionQualified,false);
  assert.equal(result.reportedTotal,null);
  for(const flag of ['sourceScopeComplete','companyGlobalScopeQualified','applicantEligibilityQualified','legalEmployerQualified','rendererConsumptionQualified','UIOrApplicationEquivalent','lifecycleCleanupAllowed','allChannelsClosed'])assert.equal(result.qualificationFacts[flag],false,flag);
}
let networkCalls=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=()=>{networkCalls++;throw Error('No network is authorized by this pure test');};
after(()=>{globalThis.fetch=originalFetch;assert.equal(networkCalls,0);});

test('original component bodies and the five absent historical header views remain original',()=>{
  assert.equal(fixture.responses.length,12);
  assert.equal(fixture.responses.filter(row=>!Object.hasOwn(row.receipt,'headerEntries')).length,5);
  assert.equal(fixture.genuineAcquiredClosing,false);assert.equal(fixture.coherentProgrammeInterval,false);
  const value=input(),before=packets(value).map(row=>({bodyBase64:row.body.toString('base64'),receipt:structuredClone(row.receipt)}));
  const result=reconcileHyperscienceAcquiredProgramme(value);assertPure(result);
  assert.equal(result.qualificationFacts.completeTransportMetadataQualified,false);
  assert.deepEqual(packets(value).map(row=>({bodyBase64:row.body.toString('base64'),receipt:row.receipt})),before);
  assert.deepEqual(result.nativePayload,JSON.parse(value.api.body));
  for(const key of queryKeys){const snapshot=result.intake.comparison[key==='intakeOpening'?'opening':'closing'];assert.equal(snapshot.bodyBase64,value[key].body.toString('base64'));assert.deepEqual(snapshot.receipt,value[key].receipt);}
});

test('consistent measured queries preserve the complete frozen full-reader result',()=>{
  const value=measuredQueries(completeControlledMetadata(input()));
  const result=reconcileHyperscienceAcquiredProgramme(value);assertPure(result);
  assert.equal(result.qualificationFacts.completeTransportMetadataQualified,true,'Controlled transport shape is never currentness');
  assert.deepEqual(result,reconcileHyperscienceServerProgramme(value));
  for(const phase of ['opening','closing']){const receipt=result.intake.comparison[phase].receipt;assert.equal(receipt.consumedBodyBytes,8405);assert.equal(receipt.discardedOverflowBytes,0);assert.equal(receipt.overflowBytes,0);}
});

test('absent optional query counters remain absent instead of being manufactured',()=>{
  const value=input();for(const key of queryKeys)for(const counter of counterKeys)delete value[key].receipt[counter];
  const result=reconcileHyperscienceAcquiredProgramme(value);assertPure(result);
  for(const phase of ['opening','closing'])for(const key of counterKeys)assert.equal(Object.hasOwn(result.intake.comparison[phase].receipt,key),false);
});

for(const[key,field,value]of [
  ['intakeOpening','consumedBodyBytes',8404],['intakeClosing','discardedOverflowBytes',1],['intakeOpening','overflowBytes',1]
])test(`frozen standalone reader still accepts the known ${key}/${field} witness`,()=>{
  const valueInput=completeControlledMetadata(input());valueInput[key].receipt[field]=value;
  const result=reconcileHyperscienceServerProgramme(valueInput);assertPure(result);
  assert.equal(result.qualificationFacts.completeTransportMetadataQualified,true);
});

for(const phase of queryKeys){
  for(const value of [8404,8406,-1,8405.5,'8405',Number.MAX_SAFE_INTEGER+1,null])test(`acquisition holds ${phase} consumedBodyBytes ${JSON.stringify(value)}`,()=>{
    const source=input();source[phase].receipt.consumedBodyBytes=value;held(source,'transport');
  });
  for(const field of ['discardedOverflowBytes','overflowBytes'])for(const value of [1,-1,0.5,'0',Number.MAX_SAFE_INTEGER+1,null])test(`acquisition holds ${phase} ${field} ${JSON.stringify(value)}`,()=>{
    const source=input();source[phase].receipt[field]=value;held(source,'transport');
  });
  for(const invalid of ['discardedOverflowBytes','overflowBytes'])test(`one zero alias cannot mask ${phase} ${invalid}`,()=>{
    const source=measuredQueries(input());source[phase].receipt[invalid]=1;held(source,'transport');
  });
  test(`query ${phase} is copied and checked before the full reader touches a malformed API`,()=>{
    const source=input();source[phase].receipt.consumedBodyBytes=8404;let calls=0;
    Object.defineProperty(source.api,'body',{get(){calls++;throw Error('Do not execute');}});
    held(source,'transport');assert.equal(calls,0);
  });
}

for(const[name,mutate]of [
  ['options accessor',(value,hit)=>Object.defineProperty(value,'intakeOpening',{get:hit})],
  ['raw body accessor',(value,hit)=>Object.defineProperty(value.intakeOpening,'body',{get:hit})],
  ['closing receipt accessor',(value,hit)=>Object.defineProperty(value.intakeClosing,'receipt',{get:hit})],
  ['receipt counter accessor',(value,hit)=>Object.defineProperty(value.intakeOpening.receipt,'consumedBodyBytes',{get:hit})],
  ['nested receipt accessor',(value,hit)=>Object.defineProperty(value.intakeClosing.receipt.headers,'synthetic',{get:hit})],
  ['byte length accessor',(value,hit)=>Object.defineProperty(value.intakeOpening.body,'length',{get:hit})],
  ['byte constructor accessor',(value,hit)=>Object.defineProperty(value.intakeClosing.body,'constructor',{get:hit})],
  ['byte conversion hook',(value,hit)=>{value.intakeOpening.body.valueOf=hit;}],
  ['receipt JSON hook',(value,hit)=>{value.intakeOpening.receipt.toJSON=hit;}]
])test(`unsafe ${name} is rejected with zero callbacks`,()=>{
  const value=input();let calls=0;mutate(value,()=>{calls++;throw Error('Caller callback must never run');});held(value,'ownership');assert.equal(calls,0);
});

for(const[name,place]of [
  ['options',(value,p)=>p(value)],
  ['raw opening',(value,p)=>{value.intakeOpening=p(value.intakeOpening);return value;}],
  ['closing receipt',(value,p)=>{value.intakeClosing.receipt=p(value.intakeClosing.receipt);return value;}],
  ['nested headers',(value,p)=>{value.intakeOpening.receipt.headers=p(value.intakeOpening.receipt.headers);return value;}],
  ['body',(value,p)=>{value.intakeClosing.body=p(value.intakeClosing.body);return value;}]
])test(`Proxy ${name} is rejected before any trap`,()=>{
  let calls=0;const proxy=target=>new Proxy(target,{get(){calls++;throw Error('get');},getPrototypeOf(){calls++;throw Error('prototype');},ownKeys(){calls++;throw Error('keys');},getOwnPropertyDescriptor(){calls++;throw Error('descriptor');}});
  held(place(input(),proxy),'ownership');assert.equal(calls,0);
});

for(const[name,mutate]of [
  ['query symbol',value=>{value.intakeOpening[Symbol('authority')]=true;}],
  ['receipt symbol',value=>{value.intakeClosing.receipt[Symbol('authority')]=true;}],
  ['receipt cycle',value=>{value.intakeOpening.receipt.cycle=value.intakeOpening.receipt;}],
  ['non-plain receipt',value=>{value.intakeClosing.receipt=Object.create({consumedBodyBytes:8405});}],
  ['array receipt',value=>{value.intakeOpening.receipt=[];}],
  ['query extra field',value=>{value.intakeClosing.qualified=true;}],
  ['caller bypass',value=>{value.skipQueryCounters=true;}],
  ['undefined counter',value=>{value.intakeOpening.receipt.consumedBodyBytes=undefined;}],
  ['shared bytes',value=>{const bytes=new Uint8Array(new SharedArrayBuffer(8405));bytes.set(value.intakeOpening.body);value.intakeOpening.body=bytes;}],
  ['resizable bytes',value=>{const bytes=new Uint8Array(new ArrayBuffer(8405,{maxByteLength:9000}));bytes.set(value.intakeClosing.body);value.intakeClosing.body=bytes;}],
  ['oversized bytes',value=>{value.intakeOpening.body=Buffer.alloc(4194305);}],
  ['converted string',value=>{value.intakeClosing.body=value.intakeClosing.body.toString();}]
])test(`unsupported ${name} cannot create acquisition authority`,()=>{const value=input();mutate(value);held(value,'ownership');});

test('private copies leave caller bytes and receipt objects writable and independent',()=>{
  const value=measuredQueries(input()),result=reconcileHyperscienceAcquiredProgramme(value);
  const saved=structuredClone(result.intake.comparison.opening);
  value.intakeOpening.body.fill(0);value.intakeOpening.receipt.headers.synthetic='changed';value.intakeOpening.receipt.consumedBodyBytes=1;
  assert.deepEqual(result.intake.comparison.opening,saved);
  assert.equal(Object.isFrozen(value.intakeOpening.receipt),false);
  result.intake.comparison.opening.receipt.consumedBodyBytes=0;
  const next=reconcileHyperscienceAcquiredProgramme(measuredQueries(input()));assert.equal(next.intake.comparison.opening.receipt.consumedBodyBytes,8405);
});

test('shared caller receipt aliases do not become aliases inside the returned evidence',()=>{
  const value=input();value.intakeOpening.receipt.extra={a:{value:'original'}};value.intakeOpening.receipt.extra.b=value.intakeOpening.receipt.extra.a;
  const result=reconcileHyperscienceAcquiredProgramme(value),extra=result.intake.comparison.opening.receipt.extra;
  extra.a.value='changed';assert.equal(extra.b.value,'original');assert.equal(value.intakeOpening.receipt.extra.a.value,'original');
});

test('an altered typed native work-country still reaches the frozen country hold',()=>{
  const value=measuredQueries(input()),api=JSON.parse(value.api.body);api.jobs[0].address.postalAddress.addressCountry='India';setBody(value.api,JSON.stringify(api));held(value,'country');
});

test('an altered selected entry still reaches the frozen whole-source SRI hold',()=>{
  const value=measuredQueries(input());setBody(value.intakeClient.entry,Buffer.concat([value.intakeClient.entry.body,Buffer.from('\n')]));held(value,'source-integrity');
});

test('full original Q provenance checks remain mandatory after valid counters',()=>{
  const value=measuredQueries(input());value.intakeClosing.receipt.bodySHA256='0'.repeat(64);held(value,'intake');
});
