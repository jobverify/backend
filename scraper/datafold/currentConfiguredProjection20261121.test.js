import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import metadata from './catalog.js'
const api=await import('./currentConfiguredProjection20261121.js').catch(error=>error.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(error))
const fixture=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/complete-native-facts-20261120.json.gz',import.meta.url)))),sha=value=>createHash('sha256').update(value).digest('hex')
const HOME='https://www.datafold.com/careers/',BOARD='https://jobs.ashbyhq.com/datafold',FEED='https://api.ashbyhq.com/posting-api/job-board/datafold'
const decode=row=>Buffer.from(row.bodyBase64,'base64').toString('utf8'),html=decode(fixture.responses.find(row=>row.requestedURL===HOME)),first=JSON.parse(decode(fixture.responses.find(row=>row.requestedURL===FEED))).jobs[0],ROLE=first.jobUrl
const exact=(source,old,value)=>{assert.equal(source.split(old).length,2,'Unique genuine Datafold carrier: '+old.slice(0,70));assert.notEqual(old,value);return source.replace(old,()=>value)}
const walk=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(walk)]
function element(source,predicate,change){const d=document(source),nodes=walk(d.root).filter(node=>predicate(node,d));assert.equal(nodes.length,1,'Unique actual original carrier');const node=nodes[0],old=d.outer(node),changed=change(old,node,d);assert.notEqual(old,changed);return source.slice(0,node.start)+changed+source.slice(node.end)}
const attribute=(source,node,value)=>source.slice(0,node.openEnd-node.start-1)+' '+value+'>'+source.slice(node.openEnd-node.start)
const programme=(value,change)=>element(value,node=>node.tag==='script'&&!node.attrs.src&&(node.raw??'').includes('const ASHBY_ORG'),(source,node)=>{const changed=change(node.raw);parse(changed,{ecmaVersion:'latest'});return exact(source,node.raw,changed)})
const authority=value=>{assert.equal(typeof api.currentDatafoldAuthority,'function','Current semantic own GQL authority required');return api.currentDatafoldAuthority(value,fixture.capturedAt)}
const held=value=>{assert.equal(typeof api.currentDatafoldAuthority,'function','Current semantic own GQL authority required');assert.throws(()=>authority(value),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error')}
const closing=(url,change)=>(response,current,phase)=>{if(current===url&&phase===1)response.text=change(response.text)}
const feed=change=>closing(FEED,text=>{const model=JSON.parse(text),row=model.jobs.find(row=>row.id===first.id);assert.ok(row);change(row,model);return JSON.stringify(model)})
function modelEdit(value,change){return element(value,node=>node.tag==='script'&&(node.raw??'').includes('window.__appData ='),(source,node)=>{const tree=parse(node.raw,{ecmaVersion:'latest'}),assignment=tree.body.find(node=>node.type==='ExpressionStatement'&&node.expression.type==='AssignmentExpression'&&node.expression.left.property?.name==='__appData')?.expression;assert.ok(assignment);const model=JSON.parse(node.raw.slice(assignment.right.start,assignment.right.end));change(model);return exact(source,node.raw,node.raw.slice(0,assignment.right.start)+JSON.stringify(model).replaceAll('<','\\u003c')+node.raw.slice(assignment.right.end))})}
async function replay(change,options={}){assert.equal(typeof api.runCurrentConfiguredProjection,'function','Current configured listed projection collector required');const counts=new Map(),calls=[],audits=[];let mutations=0
 const jobs=await api.runCurrentConfiguredProjection({now:fixture.capturedAt,requestIntervalMs:0,...options,onAudit:async value=>{audits.push(value);await options.onAudit?.(value)},fetchImpl:async(url,init)=>{
  assert.ok(url===HOME||url===BOARD||url===FEED||JSON.parse(decode(fixture.responses.find(row=>row.requestedURL===FEED))).jobs.some(row=>url===row.jobUrl),'Only original own, native board, documented feed and own public role GETs; no CDN or application requests')
  assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');options.captureSignal?.(init.signal);const phase=counts.get(url)??0;counts.set(url,phase+1)
  const original=fixture.responses.filter(row=>row.requestedURL===url)[phase];assert.ok(original,'Only paired genuine original responses');const response={...original,headers:{...original.headers},text:decode(original)},before=JSON.stringify(response);change?.(response,url,phase);if(JSON.stringify(response)!==before)mutations++;calls.push({url,phase,status:response.status})
  return Object.defineProperties(new Response(response.bytesOverride??Buffer.from(response.text),{status:response.status,headers:response.headers}),{url:{value:response.finalURL},redirected:{value:false}})
 }})
 if(change)assert.ok(mutations>0,'Actual original response was changed');return{jobs,calls,audits,mutations,evidence:readInventoryEvidence(jobs),assessment:assessSoftFailureAcquisition(metadata,jobs)}}
test('Datafold all20 genuine originals retain all9479394bytes before configured-projection adaptation',()=>{let bytes=0;for(const row of fixture.responses){const body=Buffer.from(row.bodyBase64,'base64');assert.equal(sha(body),row.sha256);assert.equal(body.length,row.bytes);assert.equal(row.status,200);bytes+=body.length}assert.equal(bytes,9479394);assert.equal(fixture.responses.length,20)})
test('Datafold current own IIFE statically binds GQL operations, same-record native links and original mount while browser execution stays held',()=>{const value=authority(html);assert.equal(value.publisher,'Datafold');assert.equal(value.board,BOARD);assert.equal(value.feed,FEED);assert.equal(value.programme.boardOperation,'ApiJobBoardWithTeams');assert.equal(value.programme.detailOperation,'ApiJobPosting');assert.equal(value.nativeProgramsExecuted,false);assert.equal(value.rendererOrUIActivationVerified,false);assert.equal(value.marketingEmptyMessageUsedAsEvidence,false)})
for(const[label,change]of[
 ['unrelated own marketing comment',value=>value+'<!-- current marketing release -->'],
 ['own account binding rename',value=>programme(value,source=>source.replaceAll('ASHBY_ORG','CURRENT_PUBLIC_ACCOUNT'))],
 ['own local function renames',value=>programme(value,source=>source.replace(/\bgql\b/g,'requestCurrentPublicData').replace(/\bloadJobs\b/g,'loadCurrentOpenings').replace(/\bcardHtml\b/g,'currentRoleCard').replace(/\besc\b/g,'escapeCurrentValue'))],
 ['own query layout whitespace',value=>programme(value,source=>source.replaceAll('teams { id name }','teams {\n id\n name\n }'))],
 ['own unrelated inline comment',value=>programme(value,source=>source+'\n// non-recruitment release\n')],
 ['own unused scoped browser shadows',value=>programme(value,source=>'function unused(window,fetch,document){window.fetch=fetch;document.getElementById=function(){};}\n'+source)],
 ['own unrelated sparse analytics',value=>programme(value,source=>'Math.max(...[,1]); Math.max.apply(null,[,1]);\n'+source)],
 ['own unused bound mutator',value=>programme(value,source=>'var unused=Object.assign.bind(Object,window); void unused;\n'+source)],
 ['own unrelated SVG title',value=>exact(value,'</body>','<svg><title>Company illustration</title></svg></body>')]
])test('Datafold current authority accepts '+label,()=>assert.equal(authority(change(html)).board,BOARD))
for(const[label,old,value]of[
 ['foreign native account','const ASHBY_ORG = "datafold"','const ASHBY_ORG = "other"'],
 ['foreign GQL origin',"const ASHBY_GQL = 'https://jobs.ashbyhq.com/api/non-user-graphql'","const ASHBY_GQL = 'https://other.example/api/non-user-graphql'"],
 ['disconnected native mount',"document.getElementById('careers-jobs-root')","document.getElementById('other-root')"],
 ['IIFE early return','(function(){const ASHBY_ORG','(function(){return; const ASHBY_ORG'],
 ['loader early return','async function loadJobs() {','async function loadJobs() { return;'],
 ['unreachable loader invocation','    loadJobs()','    (false && loadJobs())'],
 ['uninvoked loader','    loadJobs()','    Promise.resolve()'],
 ['unknown board operation',"'ApiJobBoardWithTeams',","'AnotherBoardOperation',"],
 ['unknown detail operation',"'ApiJobPosting',","'AnotherPostingOperation',"],
 ['board query record disconnect','jobPostings { id title teamId locationName workplaceType }','otherPostings { id title teamId locationName workplaceType }'],
 ['board account variable disconnect','{ organizationHostedJobsPageName: ASHBY_ORG },','{ organizationHostedJobsPageName: "other" },'],
 ['detail role variable disconnect','{ jobPostingId: job.id, organizationHostedJobsPageName: ASHBY_ORG },','{ jobPostingId: "other", organizationHostedJobsPageName: ASHBY_ORG },'],
 ['detail tiers disconnect','compensationTiers { id title tierSummary }','otherTiers { id title tierSummary }'],
 ['original board data disconnect','const board = boardData?.data?.jobBoardWithTeams;','const board = otherData?.data?.jobBoardWithTeams;'],
 ['original listed array disconnect','(board?.jobPostings ?? []).map','(otherBoard?.jobPostings ?? []).map'],
 ['native title disconnect','title: job.title,','title: job.otherTitle,'],
 ['native location disconnect','location: job.locationName,','location: job.otherLocation,'],
 ['native URL ID disconnect','${ASHBY_ORG}/${job.id}','${ASHBY_ORG}/${job.otherId}'],
 ['native record URL origin disconnect','applyUrl: `https://jobs.ashbyhq.com/','applyUrl: `https://other.example/'],
 ['native card title disconnect','${esc(job.title)}','${esc(job.otherTitle)}'],
 ['native card application disconnect','${esc(job.applyUrl)}','${esc(job.otherUrl)}'],
 ['native cards disconnected from output',"root.innerHTML = jobs.map(cardHtml).join('');","root.innerHTML = EMPTY_HTML;"],
 ['native card map empties original records',"root.innerHTML = jobs.map(cardHtml).join('');","root.innerHTML = [].map(cardHtml).join('');"],
 ['native markup effect unreachable',"root.innerHTML = jobs.map(cardHtml).join('');","if (false) { root.innerHTML = jobs.map(cardHtml).join(''); }"],
 ['same-record input URL overwritten','return {\n            title: job.title,','job.id = "other";\n          return {\n            title: job.title,'],
 ['actual card URL overwritten','function cardHtml(job) {','function cardHtml(job) { job.applyUrl = "https://other.example/apply";'],
 ['actual output overwritten',"root.innerHTML = jobs.map(cardHtml).join('');","root.innerHTML = jobs.map(cardHtml).join(''); root.innerHTML = EMPTY_HTML;"],
 ['POST consumer replaced with GET',"method: 'POST'","method: 'GET'"],
 ['query disconnected from actual request','body: JSON.stringify({ operationName: op, variables, query })','body: JSON.stringify({ operationName: op, variables, otherQuery: query })']
])test('Datafold current static authority holds '+label,()=>held(programme(html,source=>exact(source,old,value))))
for(const[label,code]of[
 ['bare fetch replacement','fetch=function(){};'],
 ['browser fetch replacement','window.fetch=function(){};'],
 ['reflected browser fetch replacement','Object.assign(window,{fetch:function(){}});'],
 ['mount selector replacement','document.getElementById=function(){};'],
 ['request serializer replacement','JSON.stringify=function(){return "{}";};']
])test('Datafold current actual browser dependencies hold '+label,()=>held(programme(html,source=>code+'\n'+source)))
for(const[label,predicate,attrs]of[
 ['inactive programme',node=>node.tag==='script'&&(node.raw??'').includes('const ASHBY_ORG'),'type="application/json"'],
 ['hidden native mount',node=>node.attrs.id==='careers-jobs-root','hidden'],
 ['unpublished native mount',node=>node.attrs.id==='careers-jobs-root','data-is-published="false"'],
 ['foreign programme employer',node=>node.tag==='script'&&(node.raw??'').includes('const ASHBY_ORG'),'data-employer="Other Employer"']
])test('Datafold current authority holds actual '+label,()=>held(element(html,predicate,(source,node)=>attribute(source,node,attrs))))
test('Datafold current own head title cannot name another employer',()=>held(element(html,node=>node.tag==='title',(source,node)=>source.slice(0,node.openEnd-node.start)+'Careers at Other Employer</title>')))
test('Datafold configured listed projection reconciles both originalUS roles and full criteria without renderer certificate or company/facet claims',async()=>{const result=await replay();assert.equal(result.calls.length,10);assert.equal(result.jobs.length,0);assert.equal(result.audits.length,1);assert.deepEqual(result.audits[0].observations.map(value=>value.roles.length),[2,2]);assert.ok(result.audits[0].observations.every(value=>value.roles.every(role=>role.country==='United States')));assert.equal(result.audits[0].rendererOrUIActivationVerified,false);assert.equal(result.audits[0].currentRendererQualified,false);assert.equal(result.audits[0].backendApplicationActivationVerified,false);assert.equal(result.audits[0].companyIndiaTotal,null);assert.equal(result.audits[0].sourceScopeComplete,false);assert.equal(result.evidence.status,'complete-inventory');assert.equal(result.evidence.listingComplete,true);assert.equal(result.evidence.reportedTotal,null);assert.equal(result.evidence.indiaFacetCount,null);assert.equal(result.assessment.runnerOutcome.success,true);assert.equal(result.assessment.zeroJobEvidence,'fetched-zero');assert.equal(result.assessment.cleanupOptions.replaceExisting,false)})
for(const[label,change]of[
 ['India primary country',row=>{row.address.postalAddress.addressCountry='India'}],
 ['missing primary country',row=>{delete row.address.postalAddress.addressCountry}],
 ['India secondary location',row=>{row.secondaryLocations.push({location:'India',address:{postalAddress:{addressCountry:'India'}}})}],
 ['global authored primary location',row=>{row.location='Worldwide'}],
 ['foreign account application',row=>{row.applyUrl='https://other.example/apply'}],
 ['unlisted native role',row=>{row.isListed=false}],
 ['withdrawn native optional publication',row=>{row.isPublished=false}],
 ['India authored full criteria',row=>{row.descriptionHtml+='<p>Location: Bengaluru, India</p>'}],
 ['future original posting date',row=>{row.publishedAt='2027-01-01T00:00:00Z'}],
 ['closing role removal',(row,value)=>{value.jobs.pop()}],
 ['duplicate native role',(row,value)=>{value.jobs.push(structuredClone(row))}],
 ['unknown feed pagination',(row,value)=>{value.nextCursor='next'}]
])test('Datafold current collector holds '+label,async()=>{assert.equal(typeof api.runCurrentConfiguredProjection,'function','Current collector required');await assert.rejects(replay(feed(change)),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error')})
for(const[label,url,change]of[
 ['native organization slug',BOARD,model=>{model.organization.hostedJobsPageSlug='other'}],
 ['native employer',BOARD,model=>{model.organization.name='Other Employer'}],
 ['native board membership',BOARD,model=>{model.jobBoard.jobPostings.pop()}],
 ['own role title',ROLE,model=>{model.posting.title='Other role'}],
 ['own role listed status',ROLE,model=>{model.posting.isListed=false}],
 ['own role criteria',ROLE,model=>{model.posting.descriptionHtml+='<p>Different full criteria.</p>'}],
 ['own compensation country criterion',ROLE,model=>{model.posting.compensationPhilosophyHtml='<p>Applicants must reside in India.</p>'}],
 ['native later global replacement',BOARD,null]
])test('Datafold current collector holds '+label,async()=>{assert.equal(typeof api.runCurrentConfiguredProjection,'function','Current collector required');await assert.rejects(replay(closing(url,text=>change?modelEdit(text,change):exact(text,'</body>','<script>Object.assign(window,{__appData:{}});</script></body>'))),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error')})
test('Datafold current native comments do not pin whole boot/HTML bodies',async()=>{const result=await replay(closing(BOARD,text=>text+'<!-- independent native metadata comment -->'));assert.equal(result.evidence.status,'complete-inventory')})
test('Datafold source caller cap0 cannot give configured empty evidence',async()=>{const result=await replay(null,{maxJobs:0});assert.equal(result.calls.length,0);assert.equal(result.evidence.status,'coverage-gap');assert.equal(result.assessment.runnerOutcome.success,false)})
test('Datafold actual own denial403 stops at first origin response',async()=>{assert.equal(typeof api.runCurrentConfiguredProjection,'function','Current collector required');let calls=0;await assert.rejects(replay((response,url,phase)=>{calls++;if(url===HOME&&phase===0)response.status=403}),error=>error.nativeUnavailable===true&&error.status===403);assert.equal(calls,1)})
export{fixture,HOME,BOARD,FEED,ROLE,html,first,exact,element,attribute,programme,modelEdit,replay,closing,feed}
