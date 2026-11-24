// Exact Native18 payloads and pass/hold expectation body; only Node-test/import/ready/run interfaces adapted.
import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {parse} from 'acorn';
import http from 'node:http';
import https from 'node:https';
import {createVerintSystemsScraper} from './script.js';
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js';
import {all,nativeCountryName} from './currentFacts20261120.js';
import {currentNativeModel} from './currentModel20261120.js';
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js';
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js';
const fixtureFile='scraper/verintsystems/fixtures/current-native-20261121.json.gz';
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(ok,message)=>{if(!ok)throw Object.assign(Error(message),{reviewHarness:true});};
const probes=[];
const fixture=JSON.parse(gunzipSync(fs.readFileSync(fixtureFile)));
const records=fixture.responses;
assert.equal(records.length,12);
assert.equal(records.reduce((sum,r)=>sum+r.bytes,0),1233766);
for(const r of records){const bytes=Buffer.from(r.bodyBase64,'base64');assert.equal(bytes.length,r.bytes);assert.equal(sha(bytes),r.sha256);assert.equal(r.status,200);assert.equal(r.method,'GET');assert.equal(r.redirected,false);assert.equal(r.bodyComplete,true);}
const text=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8');
const home='https://www.verint.com/careers/';
const feedURL='https://api.ashbyhq.com/posting-api/job-board/verint';
const groups=new Map();
for(const record of records){const url=record.requestedUrl;need(record.url===url,'Original final URL differs');if(!groups.has(url))groups.set(url,[]);groups.get(url).push(record);}
for(const pair of groups.values())need(pair.length===2&&pair[0]!==pair[1],'Two actual original observations required');
const feed=JSON.parse(text(groups.get(feedURL)[0]));
const typedIndia=row=>nativeCountryName(row.address?.postalAddress?.addressCountry)==='India';
const india=feed.jobs.filter(row=>typedIndia(row)&&groups.has(row.jobUrl));
need(india.length===3,'Genuine fixture India target selection changed');
const target=india[0],other=india.find(row=>row.id!==target.id);
const targetURL=target.jobUrl,expectedIds=india.map(row=>row.id).sort();
need(target.applyUrl===targetURL+'/application'&&other.applyUrl!==target.applyUrl,'Actual distinct application handoffs required');
const mutations=[];
function replaceRaw(html,raw,next){const start=html.indexOf(raw);need(start>=0&&html.indexOf(raw,start+raw.length)<0,'Actual carrier raw fragment must be unique');return html.slice(0,start)+next+html.slice(start+raw.length);}
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(item=>walk(item,visit));else if(value&&typeof value==='object')walk(value,visit);}}
const literal=value=>JSON.stringify(value).replaceAll('<','\\u003c');
function native(html,mutate){
 const d=document(html),state=currentNativeModel(d),node=all(d.root,n=>n.tag==='script'&&n.attrs===state.originalScriptAttributes)[0];need(node?.raw,'Original native state carrier absent');
 const tree=parse(node.raw,{ecmaVersion:'latest',sourceType:'script'}),assignments=[];
 walk(tree,n=>{if(n.type==='AssignmentExpression'&&n.operator==='='&&n.left.type==='MemberExpression'&&n.left.object.type==='Identifier'&&n.left.object.name==='window'&&((!n.left.computed&&n.left.property.name==='__appData')||(n.left.computed&&n.left.property.value==='__appData')))assignments.push(n);});
 need(assignments.length===1&&assignments[0].right.type==='ObjectExpression','Actual original top-level model assignment absent');
 const model=structuredClone(state.originalModel);mutate(model);const at=assignments[0].right,next=node.raw.slice(0,at.start)+literal(model)+node.raw.slice(at.end);parse(next,{ecmaVersion:'latest',sourceType:'script'});return replaceRaw(html,node.raw,next);
}
function structured(html,predicate,mutate){
 const d=document(html),matches=all(d.root,n=>n.tag==='script'&&(n.attrs.type??'').toLowerCase()==='application/ld+json').map(node=>({node,model:readLiteralModel(node.raw).value})).filter(({model})=>predicate(model));
 need(matches.length===1,'Exactly one actual structured carrier required');const{node,model}=matches[0];mutate(model);const next=literal(model);readLiteralModel(next);return replaceRaw(html,node.raw,next);
}
const ownGraph=model=>Array.isArray(model?.['@graph'])&&model['@graph'].some(n=>(Array.isArray(n['@type'])?n['@type']:[n['@type']]).includes('Organization'));
const ownOrg=model=>model['@graph'].find(n=>(Array.isArray(n['@type'])?n['@type']:[n['@type']]).includes('Organization'));
const schema=(html,mutate)=>structured(html,model=>model?.['@type']==='JobPosting',mutate);
const closing=(url,transform,field,values)=>({url,occurrence:field==='feed selected address.postalAddress.addressCountry'?'both':1,transform,field,values});
const full=(mutate,field,values)=>closing(targetURL,html=>native(html,mutate),field,values);
const cases=[
 {name:'genuine baseline retains three India partials and two eligible roles',positive:true},
 {name:'actual native state reserialization remains compatible',positive:true,mutation:full(()=>{},'native original model',{operation:'lossless JSON reserialization'})},
 {name:'owned bare root publisher URI remains compatible',positive:true,mutation:closing(home,html=>structured(html,ownGraph,model=>{ownOrg(model).url='https://verint.com/';}),'own @graph Organization.url',{to:'https://verint.com/'})},
 {name:'foreign own named publisher holds the source',sourceCritical:true,mutation:closing(home,html=>structured(html,ownGraph,model=>{ownOrg(model).name='Other Employer';}),'own @graph Organization.name',{to:'Other Employer'})},
 {name:'foreign actual native issuer URI holds only the affected role',mutation:full(model=>{model.organization.publicWebsite='https://other.example/';},'native organization.publicWebsite',{to:'https://other.example/'})},
 {name:'foreign actual native account slug holds only the affected role',mutation:full(model=>{model.organization.hostedJobsPageSlug='other-employer';},'native organization.hostedJobsPageSlug',{to:'other-employer'})},
 {name:'foreign structured hiringOrganization name holds only the affected role',mutation:closing(targetURL,html=>schema(html,model=>{model.hiringOrganization.name='Other Employer';}),'JobPosting.hiringOrganization.name',{to:'Other Employer'})},
 {name:'foreign structured hiringOrganization URI holds only the affected role',mutation:closing(targetURL,html=>schema(html,model=>{model.hiringOrganization.sameAs='https://other.example/';}),'JobPosting.hiringOrganization.sameAs',{to:'https://other.example/'})},
 {name:'contradictory typed schema work country holds only the affected role',mutation:closing(targetURL,html=>schema(html,model=>{const places=Array.isArray(model.jobLocation)?model.jobLocation:[model.jobLocation];places[0].address.addressCountry='United States';}),'JobPosting.jobLocation.address.addressCountry',{to:'United States'})},
 {name:'contradictory plural alternate workplace holds only the affected role',mutation:full(model=>{model.posting.workLocations=[{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'United States'}}];},'native posting.workLocations',{to:[{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'United States'}}]})},
 {name:'coherent typed India country code in both actual observations remains compatible',positive:true,mutation:closing(feedURL,raw=>{const model=JSON.parse(raw);model.jobs.find(row=>row.id===target.id).address.postalAddress.addressCountry='IN';return JSON.stringify(model);},'feed selected address.postalAddress.addressCountry',{from:'India',to:'IN'})},
 {name:'unlisted actual full posting holds only the affected role',mutation:full(model=>{model.posting.isListed=false;},'native posting.isListed',{to:false})},
 {name:'explicit applications-closed criteria holds only the affected role',mutation:full(model=>{model.posting.descriptionHtml='<p>Applications for this role are now closed.</p>'+model.posting.descriptionHtml;},'native posting.descriptionHtml',{prepend:'<p>Applications for this role are now closed.</p>'})},
 {name:'hidden authored withdrawn status holds only the affected role',mutation:full(model=>{model.posting.descriptionHtml='<section hidden><p>Posting status</p><p>Withdrawn</p></section>'+model.posting.descriptionHtml;},'native posting.descriptionHtml',{prepend:'<section hidden><p>Posting status</p><p>Withdrawn</p></section>'})},
 {name:'wrong-role singular native application alias holds only the affected role',mutation:full(model=>{model.posting.applicationUrl=other.applyUrl;},'native posting.applicationUrl',{to:other.applyUrl})},
 {name:'plural applicationUrls with a wrong-role handoff holds only the affected role',mutation:full(model=>{model.posting.applicationUrls=[target.applyUrl,other.applyUrl];},'native posting.applicationUrls',{to:[target.applyUrl,other.applyUrl]})},
 {name:'plural applicationUrls with malformed first value and duplicate good values holds only the affected role',mutation:full(model=>{model.posting.applicationUrls=['not a valid application URI',target.applyUrl,target.applyUrl];},'native posting.applicationUrls',{to:['not a valid application URI',target.applyUrl,target.applyUrl]})},
 {name:'coherent same-role duplicate applicationUrls remain compatible',positive:true,mutation:full(model=>{model.posting.applicationUrls=[target.applyUrl,target.applyUrl];},'native posting.applicationUrls',{to:[target.applyUrl,target.applyUrl]})}
];
assert.equal(cases.length,18);

for(const control of cases)test('Verint independent issuer/applications: '+control.name,async()=>{
 const saved={fetch:globalThis.fetch,httpGet:http.get,httpRequest:http.request,httpsGet:https.get,httpsRequest:https.request};
 const fence=()=>{throw Object.assign(Error('Review network fence: undeclared network forbidden'),{reviewHarness:true});};
 globalThis.fetch=fence;http.get=fence;http.request=fence;https.get=fence;https.request=fence;
 try{
  const used=new Map(),requests=[],harness=[],payloads=[];let applied=0,jobs=null,error=null;
  const fetchImpl=async(input,options={})=>{
   try{
    const url=String(input),count=used.get(url)??0;used.set(url,count+1);
    need(options.method==='GET'&&options.redirect==='manual'&&options.credentials==='omit','Original GET/manual/omit transport changed');
    need(!/\/(?:application|form)(?:[/?#]|$)/.test(new URL(url).pathname),'Application or form request forbidden');
    const originals=groups.get(url);need(originals&&count<originals.length,'Undeclared, duplicated or unsaved request: '+url);
    const original=originals[count];let body=Buffer.from(original.bodyBase64,'base64');
    if(control.mutation?.url===url&&(control.mutation.occurrence==='both'||control.mutation.occurrence===count)){
     const updated=control.mutation.transform(body.toString('utf8'));need(typeof updated==='string','Mutator must return raw text');const next=Buffer.from(updated);applied++;
     payloads.push({url,phase:original.phase,observation:count,field:control.mutation.field,values:control.mutation.values,originalSHA256:original.sha256,mutatedSHA256:sha(next),originalBytes:body.length,mutatedBytes:next.length});body=next;
    }
    requests.push({url,method:options.method,redirect:options.redirect,credentials:options.credentials,originalObservation:count,originalPhase:original.phase,originalSHA256:original.sha256,responseSHA256:sha(body),bytes:body.length});
    const response=new Response(body,{status:original.status,headers:original.headers});Object.defineProperties(response,{url:{value:original.url},redirected:{value:original.redirected}});return response;
   }catch(e){harness.push(e.message);e.reviewHarness=true;throw e;}
  };
  try{jobs=await createVerintSystemsScraper({now:fixture.capturedAt,fetchImpl,requestIntervalMs:0}).run();}catch(e){error={name:e.name,message:e.message,nativeContradiction:e.nativeContradiction??false,failureKind:e.failureKind??null,reviewHarness:e.reviewHarness??false};}
  if(control.mutation&&applied!==(control.mutation.occurrence==='both'?2:1))harness.push('Actual mutation observation count differs, got '+applied);
  if(error?.reviewHarness&&!harness.includes(error.message))harness.push(error.message);
  let metrics=null,audit=null,ids=[],targetPresent=false,expected=false,details=[];
  if(jobs){
   metrics=analyzePublishableJobs(jobs,{now:new Date(fixture.capturedAt)});audit=jobs.nativeCollectionEvidence;ids=jobs.map(job=>job.jobId).sort();targetPresent=ids.includes(target.id);
   const scopeSafe=audit&&audit.companyIndiaTotal===null&&audit.companyGlobalTotal===null&&audit.sourceScopeComplete===false&&audit.sourceListingComplete===false&&audit.lifecycleCleanupAllowed===false&&audit.nativeProgramsExecuted===false&&audit.rendererOrUIActivationVerified===false&&audit.backendApplicationActivationVerified===false&&audit.applicationVisited===false&&audit.applicationsSubmitted===false;
   const nullAddressPreserved=jobs.every(job=>job.sourceNativeObservedRole?.originalNativePosting?.locationAddress===null&&job.nativeLegalEmployer===null&&job.requisitionId===null&&job.sourceDetailComplete===false);
   if(!scopeSafe)details.push('Scope or application assertions widened');
   if(!nullAddressPreserved)details.push('Original null address/legal/requisition/partial contract changed');
   if(control.positive){
    expected=ids.join('|')===expectedIds.join('|')&&metrics.indiaJobs.length===3&&metrics.eligibleJobs.length===2&&audit.heldRoles.length===0&&requests.length===12&&scopeSafe&&nullAddressPreserved;
   }else if(!control.sourceCritical){
    const unaffected=expectedIds.filter(id=>id!==target.id);expected=!targetPresent&&ids.join('|')===unaffected.join('|')&&audit.heldRoles.some(role=>role.id===target.id)&&scopeSafe&&nullAddressPreserved;
   }
  }else if(control.sourceCritical){expected=error?.nativeContradiction===true&&error?.failureKind==='parser_or_contract_error';}
  const verdict=harness.length?'harness-error':expected?'pass':'finding';
  probes.push({name:control.name,expectation:control.positive?'Genuine three India/two eligible partials remain with nulls and scope holds':control.sourceCritical?'Source publisher contradiction must hold the acquisition':'Affected role must be held while two unrelated India partials remain',positive:!!control.positive,sourceCritical:!!control.sourceCritical,verdict,details,error,rawJobs:jobs?.length??null,indiaJobs:metrics?.indiaJobs.length??null,eligibleJobs:metrics?.eligibleJobs.length??null,filterCounts:metrics?.filterCounts??null,targetPresent,returnedIds:ids,heldRoles:audit?.heldRoles??null,requests,payloads,harnessErrors:harness});
  mutations.push(...payloads);
  console.log(JSON.stringify({control:probes.length,name:control.name,verdict,rawJobs:jobs?.length??null,eligibleJobs:metrics?.eligibleJobs.length??null,requests:requests.length,harnessErrors:harness.length}));
  assert.equal(verdict,'pass',JSON.stringify({name:control.name,verdict,details,error,rawJobs:jobs?.length,returnedIds:ids,heldRoles:audit?.heldRoles,harness}));
 }finally{globalThis.fetch=saved.fetch;http.get=saved.httpGet;http.request=saved.httpRequest;https.get=saved.httpsGet;https.request=saved.httpsRequest;}
});
