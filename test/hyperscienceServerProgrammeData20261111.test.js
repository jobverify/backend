import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { reconcileHyperscienceServerProgramme } from '../scraper/hyperscience/currentProgrammeData.js';
import {readHyperscienceFormContract} from '../scraper/hyperscience/currentFormContract.js';
import * as formContract from '../scraper/hyperscience/currentFormContract.js';

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/hyperscience-server-programme-components-20261111.json.gz', import.meta.url))));
const packet = kind => { const row = fixture.responses.find(r => r.kind === kind); assert(row, `Original ${kind}`);
  return { body: Buffer.from(row.bodyBase64, 'base64'), receipt: structuredClone(row.receipt) }; };
const input = () => ({ entry: packet('C0'), positions: packet('C1'), api: packet('A'),
  roles: JSON.parse(packet('A').body).jobs.map(j => packet(`O-${j.id.slice(0, 8)}`)),
  intakeShell: packet('H'), intakeClient: { manifest: packet('M'), entry: packet('S'),
    requestBody: Buffer.from(fixture.request.bodyBase64, 'base64') },
  intakeOpening: packet('Q-first'), intakeClosing: packet('Q-repeat') });

test('original component fixture preserves all independent phases and absent header views', () => {
  assert.equal(fixture.responses.length, 12);
  assert.equal(fixture.genuineAcquiredClosing, false);
  assert.equal(fixture.coherentProgrammeInterval, false);
  assert.equal(fixture.responses.find(r => r.kind === 'C0').originalActualHeaderEntriesPresent, false);
  assert.equal(Object.hasOwn(packet('C0').receipt, 'headerEntries'), false);
  assert.equal(packet('S').body.length, 4274367);
});

test('all genuine source-specific bodies reconcile without a fabricated board or currentness claim', () => {
  const value=input(),result = reconcileHyperscienceServerProgramme(value);
  assert.equal(result.qualificationFacts.serverPublicationBodyFactsQualified, true);
  assert.equal(result.qualificationFacts.currentTransactionQualified, false);
  assert.equal(result.nativeRecords.length, 4);
  assert.deepEqual(result.nativePayload,JSON.parse(value.api.body));
  assert.deepEqual(result.nativeRecords.map(r=>r.country),['United States','United States','Bulgaria','Bulgaria']);
  assert.deepEqual(result.nativeRecords.map(r=>r.workplaceType),['Remote','Remote','Hybrid','Hybrid']);
  assert.equal(result.sourceObservationEvidence.recordKind,'mixed');
  assert.equal(result.sourceObservationEvidence.observedRecordCount,5);
  assert.equal(result.sourceObservationEvidence.observedVacancyCount,4);
  assert.equal(result.reportedTotal,null);
  assert.equal(result.intake.comparison.rawEntityEqual,false);
  assert.equal(result.intake.comparison.serverDefinitionCriteriaEqual,true);
  assert.equal(result.qualificationFacts.allWholeBodiesEqual,false,'Known differing Q pair disproves all-whole equality despite unacquired ordinary closes');
  assert.equal(result.intake.workCountry,null);
  assert.equal(result.intake.applicantCountry,null);
  assert.equal(result.qualificationFacts.completeTransportMetadataQualified,false);
  for(const key of ['sourceScopeComplete','companyGlobalScopeQualified','applicantEligibilityQualified','legalEmployerQualified',
    'rendererConsumptionQualified','UIOrApplicationEquivalent','lifecycleCleanupAllowed'])assert.equal(result.qualificationFacts[key],false,key);
  for(let i=0;i<4;i++){
    const original=JSON.parse(value.api.body).jobs[i],row=result.nativeRecords[i];
    assert.equal(row.originalAPI.descriptionHtml,original.descriptionHtml);
    assert.equal(row.originalLD.description,original.descriptionHtml);
    assert.equal(row.originalNativeModel.posting.descriptionHtml,original.descriptionHtml);
    assert.equal(row.sourceDescription.startsWith(original.descriptionHtml),true);
    assert.equal(row.originalNativeModel.posting.locationAddress,null);
    assert.equal(row.originalAPI.isRemote,true);
    assert.equal(row.originalLD.jobLocationType,'TELECOMMUTE');
    assert.equal(row.applicantCountry.name,row.country);
  }
  assert.deepEqual(result.nativeRecords.slice(0,3).map(r=>[r.compensation.currency,r.compensation.minValue,r.compensation.maxValue]),
    [['USD',90500,153000],['USD',122000,206500],['EUR',50000,68000]]);
  assert.equal(result.nativeRecords[3].compensation,null);
  assert.equal(Object.hasOwn(result.nativeRecords[3].originalLD,'baseSalary'),false);
});

test('controlled identical Q copy leaves unacquired whole-channel equality unknown',()=>{
  const value=input();value.intakeClosing=structuredClone(value.intakeOpening);
  const result=reconcileHyperscienceServerProgramme(value);
  assert.equal(result.intake.comparison.rawEntityEqual,true);assert.equal(result.qualificationFacts.allWholeBodiesEqual,null);
  assert.equal(result.qualificationFacts.allChannelsClosed,false);assert.equal(result.qualificationFacts.currentTransactionQualified,false);
});

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function setBody(row,bytes){const previous=row.body;row.body=Buffer.from(bytes);assert.equal(row.body.equals(previous),false,'Actual synthetic mutation');row.receipt.bodyBytes=row.body.length;row.receipt.bodySHA256=sha(row.body);if(Object.hasOwn(row.receipt,'consumedBodyBytes'))row.receipt.consumedBodyBytes=row.body.length;}
function apiEdit(value,edit){const original=JSON.parse(value.api.body);edit(original);setBody(value.api,Buffer.from(JSON.stringify(original)));}
function nativeParts(row){const html=row.body.toString(),prefix=/window\.__appData\s*=\s*/.exec(html);assert(prefix);const start=prefix.index+prefix[0].length;let depth=0,quoted=false,escape=false,end;
  for(let i=start;i<html.length;i++){const c=html[i];if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;continue;}if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if((c==='}'||c===']')&&!--depth){end=i+1;break;}}
  const raw=html.slice(start,end),app=JSON.parse(raw),match=/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  return {html,raw,app,rawLD:match?.[1]??null,ld:match?JSON.parse(match[1]):null};}
function nativeEdit(row,edit){const part=nativeParts(row);edit(part.app,part.ld);let html=part.html.replace(part.raw,JSON.stringify(part.app));if(part.rawLD!==null)html=html.replace(part.rawLD,JSON.stringify(part.ld));setBody(row,Buffer.from(html));}
function headerEdit(row,name,value){row.receipt.headers[name]=value;if(Object.hasOwn(row.receipt,'responseHeaders'))row.receipt.responseHeaders[name]=value;if(Object.hasOwn(row.receipt,'headerEntries'))row.receipt.headerEntries=Object.entries(row.receipt.headers).sort(([a],[b])=>a.localeCompare(b));}
function held(value,gate){assert.throws(()=>reconcileHyperscienceServerProgramme(value),e=>e.code==='HYPERSCIENCE_PROGRAMME_HOLD'&&e.gate===gate,`Intended ${gate} HOLD`);}
function removeCard(value,id){const html=value.positions.body.toString();const expression=new RegExp('<a\\s+href="https://jobs\\.ashbyhq\\.com/hyperscience/'+id+'"[\\s\\S]*?</a>');assert(expression.test(html));setBody(value.positions,Buffer.from(html.replace(expression,'')));}
function alignedCriterion(value,text,plainText=text){
  const api=JSON.parse(value.api.body),job=api.jobs[0],fragment=`<p style="min-height:1.5em">${text}</p>`;
  job.descriptionHtml+=fragment;job.descriptionPlain+=`\n\n${plainText}`;
  setBody(value.api,Buffer.from(JSON.stringify(api)));
  const part=nativeParts(value.roles[0]);part.app.posting.descriptionHtml=job.descriptionHtml;part.ld.description=job.descriptionHtml;
  let html=part.html.replace(part.raw,JSON.stringify(part.app)).replace(part.rawLD,JSON.stringify(part.ld));
  const encode=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  html=html.replace(/(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*(")/g,(_m,a,b)=>a+encode(job.descriptionPlain)+b);
  setBody(value.roles[0],Buffer.from(html));
}

for(const count of [1,3])test(`controlled consistent N${count} derives native/mixed counts without fixing four`,()=>{
  const value=input(),api=JSON.parse(value.api.body);for(const row of api.jobs.slice(count))removeCard(value,row.id);
  apiEdit(value,m=>{m.jobs=m.jobs.slice(0,count);});value.roles=value.roles.slice(0,count);
  const result=reconcileHyperscienceServerProgramme(value);assert.equal(result.nativeRecords.length,count);
  assert.equal(result.sourceObservationEvidence.observedRecordCount,count+1);assert.equal(result.sourceObservationEvidence.observedVacancyCount,count);
});

test('controlled fifth complete publication is not rejected by original country/mode counts',()=>{
  const value=input(),api=JSON.parse(value.api.body),old=api.jobs[0].id,id='00000000-0000-4000-8000-000000000005';
  const added=JSON.parse(JSON.stringify(api.jobs[0]).replaceAll(old,id));api.jobs.push(added);setBody(value.api,Buffer.from(JSON.stringify(api)));
  const html=value.positions.body.toString(),card=new RegExp('<a\\s+href="https://jobs\\.ashbyhq\\.com/hyperscience/'+old+'"[\\s\\S]*?</a>').exec(html)[0];
  setBody(value.positions,Buffer.from(html.replace(card,card+card.replaceAll(old,id))));
  const own=structuredClone(value.roles[0]);own.body=Buffer.from(value.roles[0].body.toString().replaceAll(old,id));own.receipt.requestedURL=added.jobUrl;own.receipt.finalURL=added.jobUrl;own.receipt.bodyBytes=own.body.length;own.receipt.bodySHA256=sha(own.body);value.roles.push(own);
  const result=reconcileHyperscienceServerProgramme(value);assert.equal(result.nativeRecords.length,5);assert.equal(result.sourceObservationEvidence.observedRecordCount,6);
});

test('original corporate/API orders remain independent and native envelope order stays exact',()=>{
  const value=input();apiEdit(value,m=>m.jobs.reverse());value.roles.reverse();const result=reconcileHyperscienceServerProgramme(value);
  assert.deepEqual(result.nativePayload,JSON.parse(value.api.body));assert.equal(result.nativeRecords[0].id,'617d4ed8-c3c5-4b9f-ad1e-4a4b2802ee54');
});

for(const [name,edit,gate]of [
  ['numeric APIversion',v=>apiEdit(v,m=>{m.apiVersion=1;}),'api'],['other APIversion',v=>apiEdit(v,m=>{m.apiVersion='2';}),'api'],
  ['unknown envelope',v=>apiEdit(v,m=>{m.nextPage=null;}),'api'],['no vacancies',v=>apiEdit(v,m=>{m.jobs=[];}),'membership'],
  ['duplicate native ID',v=>apiEdit(v,m=>{m.jobs.push(m.jobs[0]);}),'membership'],
  ['unknown record field',v=>apiEdit(v,m=>{m.jobs[0].newRequirement='unknown';}),'api'],
  ['unlisted record',v=>apiEdit(v,m=>{m.jobs[0].isListed=false;}),'api'],
  ['missing own model',v=>{v.roles.pop();},'membership'],
  ['missing corporate card',v=>removeCard(v,JSON.parse(v.api.body).jobs[0].id),'membership'],
  ['lowercase intake alias',v=>setBody(v.positions,Buffer.from(v.positions.body.toString().replace('/Hyperscience/form/talent-community','/hyperscience/form/talent-community'))),'corporate-programme'],
  ['unknown visible hiring label',v=>setBody(v.positions,Buffer.from(v.positions.body.toString()+'<a href="https://new.example/team">India engineering openings</a>')),'corporate-programme'],
  ['unknown hidden hiring label',v=>setBody(v.positions,Buffer.from(v.positions.body.toString()+'<div hidden><a href="https://new.example/team">India engineering openings</a></div>')),'corporate-programme'],
  ['new filter',v=>setBody(v.positions,Buffer.from(v.positions.body.toString()+'<select name="job-country"><option>India</option></select>')),'corporate-programme'],
  ['wrong native account',v=>nativeEdit(v.roles[0],m=>{m.organization.name='Other';}),'native-organization'],
  ['unknown native criterion field',v=>nativeEdit(v.roles[0],m=>{m.posting.qualifications='12years';}),'native-model'],
  ['confidential native role',v=>nativeEdit(v.roles[0],m=>{m.posting.isConfidential=true;}),'native-model'],
  ['unknown automated notice',v=>nativeEdit(v.roles[0],m=>{m.posting.automatedProcessingLegalNotice='<p>Mandatory condition</p>';}),'supplement'],
  ['changed texting legal label',v=>nativeEdit(v.roles[0],m=>{m.posting.legalEntityNameForTextingConsent='Other legal label';}),'supplement'],
  ['changed primary native',v=>nativeEdit(v.roles[0],m=>{m.posting.descriptionHtml+='<p>New criterion.</p>';}),'criteria'],
  ['changed primary LD',v=>nativeEdit(v.roles[0],(_m,l)=>{l.description+='<p>New criterion.</p>';}),'criteria'],
  ['changed plain requirement',v=>apiEdit(v,m=>{m.jobs[0].descriptionPlain+=' Additional certification required.';}),'projection'],
  ['changed head criterion',v=>setBody(v.roles[0],Buffer.from(v.roles[0].body.toString().replace('name="description" content="','name="description" content="Extra condition. '))),'native-head'],
  ['wrong employment',v=>nativeEdit(v.roles[0],m=>{m.posting.employmentType='PartTime';}),'employment-date'],
  ['LD date disagreement',v=>nativeEdit(v.roles[0],(_m,l)=>{l.datePosted='2026-10-25';}),'employment-date'],
  ['unknown deadline',v=>nativeEdit(v.roles[0],m=>{m.posting.applicationDeadline='2026-12-31';}),'employment-date'],
  ['mode disagreement',v=>nativeEdit(v.roles[0],m=>{m.posting.workplaceType='Hybrid';}),'mode'],
  ['false API remote',v=>apiEdit(v,m=>{m.jobs[2].isRemote=false;}),'mode'],
  ['unknown LD remote mode',v=>nativeEdit(v.roles[0],(_m,l)=>{l.jobLocationType=null;}),'mode'],
  ['primary India',v=>apiEdit(v,m=>{m.jobs[0].address.postalAddress.addressCountry='India';}),'country'],
  ['unknown primary country',v=>apiEdit(v,m=>{m.jobs[0].address.postalAddress.addressCountry='';}),'country'],
  ['new additional country',v=>apiEdit(v,m=>{m.jobs[0].secondaryLocations=[{location:'India'}];}),'country'],
  ['contradictory applicant',v=>nativeEdit(v.roles[0],(_m,l)=>{l.applicantLocationRequirements.name='India';}),'country'],
  ['nested applicant conflict',v=>nativeEdit(v.roles[0],(_m,l)=>{l.applicantLocationRequirements.identifier='IN';}),'country'],
  ['nested country conflict',v=>nativeEdit(v.roles[0],(_m,l)=>{l.jobLocation.address.addressCountry={name:'United States',identifier:'IN'};}),'country'],
  ['new native address',v=>nativeEdit(v.roles[0],m=>{m.posting.locationAddress={addressCountry:'India'};}),'country'],
  ['direct team mismatch',v=>nativeEdit(v.roles[0],m=>{m.posting.teamNames=['Other','Team'];}),'department'],
  ['new salary decimal',v=>nativeEdit(v.roles[0],m=>{m.posting.compensationTierSummary=m.posting.compensationTierSummary.replace('90.5','90.6');}),'salary'],
  ['salary word split',v=>nativeEdit(v.roles[0],m=>{m.posting.compensationTierSummary=m.posting.compensationTierSummary.replace('90.5','90 .5');}),'salary'],
  ['salary dash punctuation',v=>nativeEdit(v.roles[0],m=>{m.posting.compensationTierSummary=m.posting.compensationTierSummary.replace(' – ',' - ');}),'salary'],
  ['salary currency mismatch',v=>nativeEdit(v.roles[2],(_m,l)=>{l.baseSalary.currency='USD';}),'salary'],
  ['salary LD precision loss',v=>nativeEdit(v.roles[1],(_m,l)=>{l.baseSalary.value.maxValue=206000;}),'salary'],
  ['salary commission removed',v=>nativeEdit(v.roles[0],m=>{m.posting.compensationTiers[0].tierSummary=m.posting.compensationTiers[0].tierSummary.replace(' • Offers Commission','');}),'salary'],
  ['null salary gains unreviewed tier',v=>nativeEdit(v.roles[3],m=>{m.posting.compensationTiers=[{id:'new',tierSummary:'€50K'}];}),'salary'],
  ['philosophy criterion removed',v=>nativeEdit(v.roles[0],m=>{m.posting.compensationPhilosophyHtml=m.posting.compensationPhilosophyHtml.replace('Bonus opportunities','');}),'supplement'],
])test(`synthetic ${name} reaches its intended source gate`,()=>{const value=input();edit(value);held(value,gate);});

for(const sentence of ['This position is based in India.','Applicants may work from any country.','Applicants may work globally.','Remote work is available from any location.','Work country: United States.','Work location: London, United Kingdom.'])test(`aligned new authored geography holds: ${sentence}`,()=>{const value=input();alignedCriterion(value,sentence);held(value,'geography');});
for(const text of ['In\u200bdia','In\u200ddia','\u202eaidnI\u202c','Ind&#105;a'])test(`aligned authored format/entity country does not evade qualification: ${text}`,()=>{const value=input();alignedCriterion(value,`This position is based in ${text}.`,text.includes('&#')?'This position is based in India.':`This position is based in ${text}.`);held(value,text.includes('&#')?'geography':'authored');});
test('once-decoded entity format control is unreviewed and never stripped',()=>{const value=input();alignedCriterion(value,'This position is based in In&#8203;dia.','This position is based in In\u200bdia.');held(value,'authored');});
test('reviewed inline emphasis cannot split and hide an India work condition',()=>{const value=input();alignedCriterion(value,'This position is based in In<em>di</em>a.','This position is based in India.');held(value,'geography');});

for(const [name,fragment]of [['hidden inline','I<span style="display:none">X</span>ndia'],['font zero','I<em style="font-size:0">X</em>ndia'],['unknown class','<strong class="new">condition</strong>'],['SVG','<svg><text>condition</text></svg>'],['comment','<!--condition-->'],['unknown philosophy class','<p class="new">condition</p>']])test(`unreviewed authored ${name} holds even with aligned primary HTML`,()=>{
  const value=input();if(name==='unknown philosophy class')nativeEdit(value.roles[0],m=>{m.posting.compensationPhilosophyHtml+=fragment;});else alignedCriterion(value,fragment);held(value,'authored');
});

for(const [name,transform]of [
  ['SVG LD',html=>html.replace('<script type="application/ld+json">','<svg><script type="application/ld+json">').replace('</script>','</script></svg>')],
  ['external LD source',html=>html.replace('<script type="application/ld+json">','<script src="" type="application/ld+json">')],
  ['template LD',html=>html.replace('<script type="application/ld+json">','<template><script type="application/ld+json">').replace('</script>','</script></template>')],
  ['duplicate LD type attribute',html=>html.replace('<script type="application/ld+json">','<script type="application/ld+json" type="text/plain">')],
  ['hidden root',html=>html.replace('id="root"','hidden id="root"')],
  ['duplicate title',html=>html.replace('</head>','<title>Other</title></head>')],
  ['different document title',html=>html.replace('Technical Deployment Lead @ Hyperscience','Other @ Hyperscience')],
])test(`native carrier ${name} holds`,()=>{const value=input();setBody(value.roles[0],Buffer.from(transform(value.roles[0].body.toString())));held(value,'native-carrier');});

for(const [name,edit,gate]of [
  ['H lowercase requested alias',v=>{v.intakeShell.receipt.requestedURL=v.intakeShell.receipt.requestedURL.replace('/Hyperscience/','/hyperscience/');},'transport'],
  ['H posting unexpectedly populated',v=>nativeEdit(v.intakeShell,m=>{m.posting={id:'new'};}),'native-model'],
  ['manifest selection wrong SRI',v=>{const m=JSON.parse(v.intakeClient.manifest.body);m['index.html'].integrity='sha384-'+Buffer.alloc(48).toString('base64');setBody(v.intakeClient.manifest,Buffer.from(JSON.stringify(m)));},'source-integrity'],
  ['manifest unsafe selected file',v=>{const m=JSON.parse(v.intakeClient.manifest.body);m['index.html'].file='../index.js';setBody(v.intakeClient.manifest,Buffer.from(JSON.stringify(m)));},'manifest'],
  ['missing current client raw bytes',v=>{v.intakeClient.entry={parsed:true};},'ownership'],
  ['wrong frozen public request',v=>{v.intakeClient.requestBody=Buffer.concat([v.intakeClient.requestBody,Buffer.from(' ')]);},'intake'],
  ['non-null intake values',v=>{const m=JSON.parse(v.intakeOpening.body);m.data.sourcingForm.sourcingFormRender.sections[0].fieldEntries[0].fieldValue='synthetic';setBody(v.intakeOpening,Buffer.from(JSON.stringify(m)));},'intake'],
])test(`current intake/client ${name} holds`,()=>{const value=input();edit(value);held(value,gate);});

for(const binding of ['Cle=12e4','organizationHostedJobsPageName','ApiSourcingForm'])test(`recomputed SRI cannot authorize changed current ${binding} code`,()=>{
  const value=input(),source=value.intakeClient.entry.body.toString(),replacement=binding==='Cle=12e4'?'Cle=13e4':binding+'Changed';
  assert(source.includes(binding));let at=source.indexOf(binding);
  if(binding==='organizationHostedJobsPageName'){const declaration=source.indexOf('hke=');assert(declaration>=0&&source.indexOf('hke=',declaration+4)===-1);at=source.indexOf(binding,declaration);assert(at>declaration&&at<declaration+7296);}
  setBody(value.intakeClient.entry,Buffer.from(source.slice(0,at)+replacement+source.slice(at+binding.length)));
  const m=JSON.parse(value.intakeClient.manifest.body);m['index.html'].integrity='sha384-'+createHash('sha384').update(value.intakeClient.entry.body).digest('base64');setBody(value.intakeClient.manifest,Buffer.from(JSON.stringify(m)));held(value,'source-contract');
});

for(const channel of ['entry','positions','api','role','shell','manifest','source'])test(`introduced security policy holds independently on ${channel}`,()=>{const value=input();const row=channel==='role'?value.roles[0]:channel==='shell'?value.intakeShell:channel==='manifest'?value.intakeClient.manifest:channel==='source'?value.intakeClient.entry:value[channel];headerEdit(row,'permissions-policy','geolocation=()');held(value,'security');});
for(const [name,content]of [['refresh','0;url=https://foreign.example'],['content-disposition','attachment'],['cf-mitigated','challenge'],['content-type','text/html;charset=utf-16le']])test(`unsafe actual native ${name} does not qualify body transport`,()=>{const value=input();headerEdit(value.roles[0],name,content);held(value,name==='content-type'?'encoding':'security');});

test('shared mutable bytes and raw-record accessor cannot confer input authority',()=>{let calls=0;const value=input();Object.defineProperty(value.api,'body',{get(){calls++;throw Error('getter');}});held(value,'ownership');assert.equal(calls,0);
  const other=input(),bytes=new Uint8Array(new SharedArrayBuffer(other.api.body.length));bytes.set(other.api.body);other.api.body=bytes;held(other,'ownership');});
test('caller parsed authority and unknown skip switches never replace raw requalification',()=>{const value=input();value.skipBoard=true;held(value,'ownership');});
test('unknown own byte getter is rejected without execution, even over a genuine body',()=>{let calls=0;const value=input();Object.defineProperty(value.api.body,'extra',{get(){calls++;throw Error('getter');}});held(value,'ownership');assert.equal(calls,0);});
test('both public raw entrypoints reject accessor options before dereferencing them',()=>{
  let calls=0;const value=input();Object.defineProperty(value,'entry',{get(){calls++;throw Error('entry getter');}});held(value,'ownership');
  const nested={};Object.defineProperty(nested,'shell',{get(){calls++;throw Error('shell getter');}});
  assert.throws(()=>readHyperscienceFormContract(nested),e=>e.code==='HYPERSCIENCE_PROGRAMME_HOLD'&&e.gate==='ownership');assert.equal(calls,0);
});
test('controlled generated entry views qualify only transport shape, never a genuine interval',()=>{
  const value=input(),all=[value.entry,value.positions,value.api,...value.roles,value.intakeShell,value.intakeClient.manifest,value.intakeClient.entry];
  for(const row of all){if(!Object.hasOwn(row.receipt,'headerEntries')){row.receipt.headerEntries=Object.entries(row.receipt.headers);row.receipt.evidenceKind='explicitly-controlled-generated-transport-views';}
    row.receipt.bodyComplete=true;row.receipt.streamDone=true;row.receipt.decodedPrefixOnly=false;row.receipt.responseAt??=row.receipt.completedAt;}
  const result=reconcileHyperscienceServerProgramme(value);assert.equal(result.qualificationFacts.completeTransportMetadataQualified,true);assert.equal(result.qualificationFacts.currentTransactionQualified,false);
  assert.equal(Object.hasOwn(packet('C0').receipt,'headerEntries'),false,'Original fixture remains absent');
});
test('mutating a previous pure result cannot alter future source qualification or original payloads',()=>{
  const value=input(),first=reconcileHyperscienceServerProgramme(value),original=JSON.parse(value.api.body);
  first.intake.currentQuery.completeRequiredASTNodes[0].sha256='0'.repeat(64);first.nativePayload.jobs[0].title='changed';
  assert.equal(first.nativeRecords[0].originalAPI.title,original.jobs[0].title);
  assert.deepEqual(JSON.parse(value.api.body),original);
  const second=reconcileHyperscienceServerProgramme(value);assert.deepEqual(second.nativePayload,original);assert.notEqual(second.intake.currentQuery.completeRequiredASTNodes[0].sha256,'0'.repeat(64));
});
test('new own schema criterion is not silently discarded',()=>{const value=input();nativeEdit(value.roles[0],(_m,l)=>{l.experienceRequirements='12 years mandatory';});held(value,'own-schema');});
test('duplicate own schema keys survive raw boundary rejection',()=>{const value=input(),part=nativeParts(value.roles[0]);const changed=part.rawLD.replace('"@type":"JobPosting"','"@type":"Other","@type":"JobPosting"');assert.notEqual(changed,part.rawLD);setBody(value.roles[0],Buffer.from(part.html.replace(part.rawLD,changed)));held(value,'json-duplicate');});
for(const name of ['Cookie','Authorization'])test(`declared supplied ${name} cannot qualify an anonymous native GET`,()=>{const value=input();value.api.receipt.requestHeaders={[name]:'synthetic-only'};held(value,'transport');});

for(const [name,edit]of [
  ['decoded prefix only',r=>{r.decodedPrefixOnly=true;}],
  ['unfinished stream',r=>{r.streamDone=false;}],
  ['response error',r=>{r.error={name:'Error',message:'synthetic incomplete entity'};}],
])test(`explicit ${name} cannot qualify otherwise complete original raw records`,()=>{const value=input();edit(value.api.receipt);held(value,'transport');});

for(const text of ['Applicants may work around the world.','Applicants may work in the UK.','Additional mandatory certification is required.'])test(`novel aligned complete authored content requires family review: ${text}`,()=>{
  const value=input();alignedCriterion(value,text);held(value,'criteria-family');
});

for(const key of ['title','team'])test(`novel consistently published ${key} requires independent family review`,()=>{
  const value=input(),api=JSON.parse(value.api.body),old=api.jobs[0][key];
  const next=key==='title'?'Technical Deployment Lead (UK)':'Sales Engineering Worldwide';
  const original=nativeParts(value.roles[0]);
  apiEdit(value,m=>{m.jobs[0][key]=next;});
  assert(value.positions.body.toString().includes(old));setBody(value.positions,Buffer.from(value.positions.body.toString().replaceAll(old,next)));
  if(key==='title'){
    nativeEdit(value.roles[0],(model,ld)=>{model.posting.title=next;ld.title=next;});
    let html=value.roles[0].body.toString();
    for(const [before,after]of [[`<title>${old} @ Hyperscience</title>`,`<title>${next} @ Hyperscience</title>`],
      [`name="title" content="${old} @ Hyperscience"`,`name="title" content="${next} @ Hyperscience"`],
      [`property="og:title" content="${old}"`,`property="og:title" content="${next}"`],
      [`name="twitter:title" content="${old}"`,`name="twitter:title" content="${next}"`]]){assert(html.includes(before));html=html.replace(before,after);}
    setBody(value.roles[0],Buffer.from(html));
  }else{assert(value.roles[0].body.toString().includes(old));setBody(value.roles[0],Buffer.from(value.roles[0].body.toString().replaceAll(old,next)));}
  assert.equal(nativeParts(value.roles[0]).app.posting.descriptionHtml,original.app.posting.descriptionHtml,'Only metadata changed; primary retained');
  held(value,'criteria-family');
});

for(const [name,transform]of [['inline emphasis',s=>s.replace('At Hyperscience','At Hyper<em>science</em>')],['entity',s=>s.replace('At Hyperscience','At Hyperscienc&#101;')]])test(`supported source-equivalent ${name} retains the whole reviewed projection`,()=>{
  const value=input(),original=JSON.parse(value.api.body).jobs[0].descriptionHtml,next=transform(original);assert.notEqual(next,original);
  apiEdit(value,m=>{m.jobs[0].descriptionHtml=next;});nativeEdit(value.roles[0],(m,l)=>{m.posting.descriptionHtml=next;l.description=next;});
  const result=reconcileHyperscienceServerProgramme(value);assert.equal(result.nativeRecords[0].originalAPI.descriptionHtml,next);assert.equal(result.nativeRecords[0].originalAPI.descriptionPlain,JSON.parse(packet('A').body).jobs[0].descriptionPlain);
});

function alignedAddress(value,address){apiEdit(value,m=>{m.jobs[0].address.postalAddress=address;});nativeEdit(value.roles[0],(_m,l)=>{l.jobLocation.address={...l.jobLocation.address,...address};});}
for(const [name,address]of [
  ['explicit India locality/region',{addressCountry:'United States',addressLocality:'Mumbai, India',addressRegion:'India'}],
  ['unknown foreign locality/region',{addressCountry:'United States',addressLocality:'Toronto',addressRegion:'Ontario'}],
])test(`final5 coherent ${name} cannot qualify the unchanged US content family`,()=>{const value=input();alignedAddress(value,address);held(value,'country');});

for(const [name,fragment,where]of [
  ['unlinked current C1 vacancy','<p>Current opening: Senior Engineer — India. Contact recruiting@hyperscience.ai to apply.</p>','tail'],
  ['hidden current C1 vacancy','<p hidden>Current opening: Senior Engineer — India.</p>','tail'],
  ['unlinked current C1 vacancy inside list','<p>Current opening: Senior Engineer — India.</p>','inside'],
  ['duplicate archive','<div class="posts-archive"></div>','tail'],
  ['unchecked card comment','<!--Additional mandatory work condition-->','card'],
])test(`final5 ${name} is not erased by corporate card slots`,()=>{
  const value=input(),html=value.positions.body.toString();let next;
  if(where==='tail')next=html+fragment;
  else if(where==='inside')next=html.replace('<div class="posts-archive">','<div class="posts-archive">'+fragment);
  else next=html.replace('<div class="separator"></div>','<div class="separator"></div>'+fragment);
  assert.notEqual(next,html);setBody(value.positions,Buffer.from(next));held(value,'corporate-programme');
});
test('final5 unchecked archive attribute cannot add an unaccounted declaration',()=>{const value=input();setBody(value.positions,Buffer.from(value.positions.body.toString().replace('<div class="posts-archive">','<div class="posts-archive" data-country="India">')));held(value,'corporate-programme');});
test('final5 complete C0 context includes non-anchor new hiring content',()=>{const value=input();setBody(value.entry,Buffer.from(value.entry.body.toString()+'<p>Current India vacancy. Contact recruiting to apply.</p>'));held(value,'corporate-programme');});

function controlledComplete(row){if(!Object.hasOwn(row.receipt,'headerEntries'))row.receipt.headerEntries=Object.entries(row.receipt.headers);row.receipt.evidenceKind='explicitly-controlled-generated-complete-metadata';row.receipt.bodyComplete=true;row.receipt.streamDone=true;row.receipt.decodedPrefixOnly=false;row.receipt.responseAt??=row.receipt.completedAt;}
for(const current of [false,true])for(const [key,content]of [
  ['consumedBodyBytes',73198],['consumedBodyBytes',-1],['consumedBodyBytes',73199.5],['consumedBodyBytes','73199'],
  ['discardedOverflowBytes',1],['discardedOverflowBytes',-1],['discardedOverflowBytes',0.5],['discardedOverflowBytes','0'],
  ['overflowBytes',1],['overflowBytes',-1],['overflowBytes',0.5],['overflowBytes','0'],
])test(`final5 ${current?'controlled complete':'historical'} ${key}=${content} is contradictory provenance`,()=>{
  const value=input();if(current)controlledComplete(value.api);value.api.receipt[key]=content;held(value,'transport');
});
test('final5 exact optional byte counters qualify without fabricating old receipt fields',()=>{
  const value=input();for(const row of [value.entry,value.positions,value.api,...value.roles,value.intakeShell,value.intakeClient.manifest,value.intakeClient.entry]){row.receipt.consumedBodyBytes=row.body.length;row.receipt.discardedOverflowBytes=0;row.receipt.overflowBytes=0;}
  const result=reconcileHyperscienceServerProgramme(value);assert.equal(result.nativeRecords.length,4);assert.equal(result.qualificationFacts.completeTransportMetadataQualified,false);assert.equal(Object.hasOwn(packet('A').receipt,'consumedBodyBytes'),false);
});

test('final5 controlled complete six-role set remains dynamic without a four-role cap',()=>{
  const value=input(),api=JSON.parse(value.api.body);let html=value.positions.body.toString();
  for(let i=0;i<2;i++){
    const old=api.jobs[i].id,id='00000000-0000-4000-8000-00000000000'+(6+i),added=JSON.parse(JSON.stringify(api.jobs[i]).replaceAll(old,id));api.jobs.push(added);
    const match=new RegExp('<a\\s+href="https://jobs\\.ashbyhq\\.com/hyperscience/'+old+'"[\\s\\S]*?</a>').exec(html);assert(match);html=html.replace(match[0],match[0]+match[0].replaceAll(old,id));
    const own=structuredClone(value.roles[i]);own.body=Buffer.from(value.roles[i].body.toString().replaceAll(old,id));own.receipt.requestedURL=added.jobUrl;own.receipt.finalURL=added.jobUrl;own.receipt.bodyBytes=own.body.length;own.receipt.bodySHA256=sha(own.body);if(Object.hasOwn(own.receipt,'consumedBodyBytes'))own.receipt.consumedBodyBytes=own.body.length;value.roles.push(own);
  }
  setBody(value.api,Buffer.from(JSON.stringify(api)));setBody(value.positions,Buffer.from(html));
  const result=reconcileHyperscienceServerProgramme(value);assert.equal(result.nativeRecords.length,6);assert.equal(result.sourceObservationEvidence.observedRecordCount,7);assert.equal(result.sourceObservationEvidence.observedVacancyCount,6);
});
test('final5 independent corporate card order retains the exact full native payload order',()=>{
  const value=input(),html=value.positions.body.toString(),cards=[...html.matchAll(/<a\s+href="https:\/\/jobs\.ashbyhq\.com\/hyperscience\/[a-f0-9-]{36}"[\s\S]*?<\/a>/g)];assert.equal(cards.length,4);
  const next=html.slice(0,cards[0].index)+cards.map(m=>m[0]).reverse().join('\n'+' '.repeat(44))+html.slice(cards.at(-1).index+cards.at(-1)[0].length);setBody(value.positions,Buffer.from(next));
  const result=reconcileHyperscienceServerProgramme(value);assert.deepEqual(result.nativePayload,JSON.parse(value.api.body));assert.equal(result.originalCorporate.independentCorporateOrder[0],JSON.parse(value.api.body).jobs[3].jobUrl);
});

const selectionInput=()=>({shell:packet('H'),manifest:packet('M')});
const clientInput=()=>({shell:packet('H'),client:{manifest:packet('M'),entry:packet('S'),requestBody:Buffer.from(fixture.request.bodyBase64,'base64')}});
const stageHeld=(fn,value,gate)=>assert.throws(()=>fn(value),e=>e.code==='HYPERSCIENCE_PROGRAMME_HOLD'&&e.gate===gate,`Intended staged ${gate} HOLD`);
test('final5 callable H/M selection derives the actual S URL without any Q record',()=>{
  const result=formContract.readHyperscienceFormSelection(selectionInput());
  assert.equal(result.selectedEntry.url,packet('S').receipt.requestedURL);assert.equal(result.selectedEntry.integrity,JSON.parse(packet('M').body)['index.html'].integrity);
  assert.equal(result.selectionFactsQualified,true);assert.equal(result.targetedSourceFactsQualified,false);assert.equal(result.QServerDefinitionCriteriaQualified,null);assert.equal(result.currentTransactionQualified,false);
  assert.equal(result.rawPackets.shell.bodySHA256,sha(packet('H').body));assert.equal(result.rawPackets.manifest.bodySHA256,sha(packet('M').body));
});
test('final5 callable current client and exact request qualify before any Q record',()=>{
  const result=formContract.readHyperscienceFormClientContract(clientInput());
  assert.equal(result.targetedSourceFactsQualified,true);assert.equal(result.requestQualified,true);assert.equal(result.QServerDefinitionCriteriaQualified,null);assert.equal(result.currentTransactionQualified,false);
  assert.equal(result.request.bodyBytes,1983);assert.equal(result.request.bodySHA256,'26301b880ec3355a303c0431fa61fdc78c804d4d3964711771061c44876e51a8');assert.deepEqual(Buffer.from(result.request.bodyBase64,'base64'),Buffer.from(fixture.request.bodyBase64,'base64'));
  assert.equal(result.classification,null);assert.equal(result.workCountry,null);assert.equal(result.applicantCountry,null);assert.equal(result.wholeRendererQualified,false);
});
for(const [name,edit,gate]of [
  ['unsafe selected file',v=>{const m=JSON.parse(v.manifest.body);m['index.html'].file='../unsafe.js';setBody(v.manifest,Buffer.from(JSON.stringify(m)));},'manifest'],
  ['foreign manifest route',v=>{v.manifest.receipt.finalURL='https://foreign.example/manifest.json';},'transport'],
  ['parsed-only manifest',v=>{v.manifest={parsed:true};},'ownership'],
])test(`final5 staged selection ${name} holds without Q`,()=>{const value=selectionInput();edit(value);stageHeld(formContract.readHyperscienceFormSelection,value,gate);});
for(const [name,edit,gate]of [
  ['wrong SRI',v=>{const m=JSON.parse(v.client.manifest.body);m['index.html'].integrity='sha384-'+Buffer.alloc(48).toString('base64');setBody(v.client.manifest,Buffer.from(JSON.stringify(m)));},'source-integrity'],
  ['targeted source drift with recomputed SRI',v=>{setBody(v.client.entry,Buffer.from(v.client.entry.body.toString().replace('Cle=12e4','Cle=13e4')));const m=JSON.parse(v.client.manifest.body);m['index.html'].integrity='sha384-'+createHash('sha384').update(v.client.entry.body).digest('base64');setBody(v.client.manifest,Buffer.from(JSON.stringify(m)));},'source-contract'],
  ['request mismatch',v=>{v.client.requestBody=Buffer.from(v.client.requestBody);v.client.requestBody[0]=32;},'intake'],
  ['missing original source bytes',v=>{v.client.entry={parsed:true};},'ownership'],
  ['public authority flag',v=>{v.certified=true;},'ownership'],
])test(`final5 staged client ${name} holds before Q`,()=>{const value=clientInput();edit(value);stageHeld(formContract.readHyperscienceFormClientContract,value,gate);});
test('final5 staged outputs cannot replace later raw validation',()=>{
  const selected=formContract.readHyperscienceFormSelection(selectionInput());selected.selectedEntry.url='https://foreign.example/source';selected.rawPackets.manifest.bodyBase64='changed';
  const value=clientInput(),result=formContract.readHyperscienceFormClientContract(value);assert.equal(result.selectedEntry.url,packet('S').receipt.requestedURL);
  const changed=clientInput(),bytes=Buffer.from(changed.client.entry.body);bytes[0]^=1;setBody(changed.client.entry,bytes);stageHeld(formContract.readHyperscienceFormClientContract,changed,'source-integrity');
});
test('final5 both staged boundaries reject descriptors/proxies/byte hooks without execution',()=>{
  let calls=0;const selection=selectionInput();Object.defineProperty(selection,'manifest',{get(){calls++;throw Error('getter');}});stageHeld(formContract.readHyperscienceFormSelection,selection,'ownership');
  const client=clientInput();Object.defineProperty(client.client,'entry',{get(){calls++;throw Error('getter');}});stageHeld(formContract.readHyperscienceFormClientContract,client,'ownership');
  const proxy=new Proxy(clientInput(),{ownKeys(){calls++;throw Error('proxy');}});stageHeld(formContract.readHyperscienceFormClientContract,proxy,'ownership');
  const hook=clientInput();Object.defineProperty(hook.client.requestBody,'valueOf',{value(){calls++;throw Error('hook');}});stageHeld(formContract.readHyperscienceFormClientContract,hook,'ownership');assert.equal(calls,0);
});

test('final5 whole-card descendant attributes cannot carry an unchecked condition',()=>{
  const value=input(),html=value.positions.body.toString();setBody(value.positions,Buffer.from(html.replace('<div class="separator"></div>','<div class="separator" data-condition="Must reside in India"></div>')));held(value,'corporate-programme');
});
test('final5 typed card scalar cannot hide raw attribute delimiters',()=>{
  const value=input(),previous='Sales',department='Sales" data-condition="India';
  apiEdit(value,m=>{m.jobs[0].department=department;});nativeEdit(value.roles[0],m=>{m.posting.departmentName=department;m.posting.departmentExternalName=department;m.posting.teamNames[0]=department;});
  const old='<span class="department-team">'+previous+' - Sales Engineering</span>',html=value.positions.body.toString();assert.equal(html.split(old).length,2);
  setBody(value.positions,Buffer.from(html.replace(old,'<span class="department-team">'+department+' - Sales Engineering</span>')));held(value,'corporate-programme');
});
