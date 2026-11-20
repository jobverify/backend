import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
const api=await import('./currentConfigured20261120.js').catch(error=>error.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(error)),fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url))))
const HOME='https://www.sandboxaq.com/',CAREERS=HOME+'careers',LIST=HOME+'careers-list',EMBED='https://jobs.ashbyhq.com/sandboxaq/embed?version=2',BOARD='https://jobs.ashbyhq.com/sandboxaq'
function model(html,edit){const d=readNativeDocument(html),script=d.nodes(n=>n.tag==='script'&&!n.attrs.src).find(n=>n.raw?.includes('window.__appData ='));assert.ok(script);const ast=parse(script.raw,{ecmaVersion:'latest'}),assignment=ast.body.find(n=>n.expression?.left?.property?.name==='__appData').expression;const original=script.raw.slice(assignment.right.start,assignment.right.end),value=JSON.parse(original);edit(value);return html.replace(original,()=>JSON.stringify(value))}
async function replay(change,options={},entry=api.runCurrentConfiguredBoard){assert.equal(typeof entry,'function');const calls=[],counts=new Map();let failure;try{const jobs=await entry({now:()=>fixture.observedAt,requestIntervalMs:0,...options,fetchImpl:async(url,init)=>{assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');const index=counts.get(url)??0;counts.set(url,index+1);const packet=fixture.responses.filter(q=>q.requestedUrl===url)[index];assert.ok(packet,'Current declared original '+url+' #'+index);const q={...packet,headers:{...packet.headers},text:Buffer.from(packet.bodyBase64,'base64').toString()};try{change?.(q,url,index)}catch(error){failure=error;throw error}calls.push(url);return Object.defineProperties(new Response(q.originalBytes??q.text,{status:q.status,headers:q.headers}),{url:{value:q.url},redirected:{value:q.redirected}})}});if(failure)throw failure;return{jobs,calls,audit:jobs.nativeCollectionEvidence}}catch(error){if(failure)throw failure;throw error}}
const closing=edit=>(q,url,index)=>{if(url===BOARD&&index===1)q.text=model(q.text,edit)}
test('ten genuine own current handoff/embed/native-board originals retain exact bytes',()=>{assert.equal(fixture.responses.length,10);assert.equal(fixture.error,null);for(const p of fixture.responses){const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(bytes.length,p.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),p.sha256)}})
test('paired current configured native board has37 wholly explicit foreign records and fetched-zero evidence only for that surface',async()=>{const{jobs,calls,audit}=await replay(),e=readInventoryEvidence(jobs);assert.equal(jobs.length,0);assert.equal(calls.length,10);assert.equal(e.status,'complete-inventory');assert.equal(e.listingComplete,true);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(audit.configuredSurfaceClosingQualified,true);assert.equal(audit.nativeOpeningModel.jobBoard.jobPostings.length,37);assert.equal(audit.nativeClosingModel.jobBoard.jobPostings.length,37);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false);assert.ok(audit.workplaceObservations.every(r=>r.countries.length>0&&r.countries.every(c=>c!=='India')))})
for(const[name,edit]of[
 ['primary India',m=>m.jobBoard.jobPostings[0].locationName='India'],
 ['secondary India',m=>m.jobBoard.jobPostings[0].secondaryLocations=[{id:'india-location',locationName:'India'}]],
 ['primary unknown city',m=>m.jobBoard.jobPostings[0].locationName='Bengaluru'],
 ['compound primary country',m=>m.jobBoard.jobPostings[0].locationName='United States / India'],
 ['typed country contradicts whole foreign workplace',m=>m.jobBoard.jobPostings[0].country='India'],
 ['new explicit India JobPosting workplace',m=>m.jobBoard.jobPostings[0].jobLocation={'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'IN'}}],
 ['contradictory secondary whole name',m=>m.jobBoard.jobPostings[0].secondaryLocations=[{id:'canada-workplace',locationName:'Canada',name:'India'}]],
 ['new explicit India applicant region',m=>m.jobBoard.jobPostings[0].eligibleRegion={'@type':'Country',name:'India'}],
 ['new explicit different role employer',m=>m.jobBoard.jobPostings[0].employer='Other Employer'],
 ['native board unpublished',m=>m.jobBoard.isPublished=false],
 ['secondary nested India country',m=>m.jobBoard.jobPostings[0].secondaryLocations=[{id:'canada-workplace',locationName:'Canada',address:{'@type':'PostalAddress',addressCountry:'IN'}}]],
 ['empty native model',m=>m.jobBoard.jobPostings=[]],
 ['maintenance native model',m=>m.maintenanceMode=true],
 ['stealth native board',m=>m.jobBoard.stealthAccess=true],
 ['other employer',m=>m.organization.name='Other Employer'],
 ['other account',m=>m.organization.hostedJobsPageSlug='other'],
 ['other publisher website',m=>m.organization.publicWebsite='https://other.example/'],
 ['other custom publisher',m=>m.organization.customJobsPageUrl='https://other.example/jobs'],
 ['duplicate native identity',m=>m.jobBoard.jobPostings[1].id=m.jobBoard.jobPostings[0].id],
 ['missing title',m=>m.jobBoard.jobPostings[0].title=''],
 ['future supplied posting date',m=>m.jobBoard.jobPostings[0].datePosted='2099-01-01'],
 ['expired supplied availability',m=>m.jobBoard.jobPostings[0].validThrough='2020-01-01'],
 ['unpublished supplied role',m=>m.jobBoard.jobPostings[0].isPublished=false]
])test('new '+name+' prevents configured zero rather than becoming missing/foreign inventory',async()=>{await assert.rejects(replay(closing(edit)),/native|current|configured|country|workplace|publication|model|role/i)})
test('a changed wholly foreign native roster and explicit separate foreign secondary workplaces remain a current configured zero',async()=>{const{jobs,audit}=await replay(closing(m=>{m.jobBoard.jobPostings.pop();m.jobBoard.jobPostings[0].secondaryLocations=[{id:'canada-workplace',locationName:'Canada'}]}));assert.equal(jobs.length,0);assert.equal(audit.nativeClosingModel.jobBoard.jobPostings.length,36);assert.ok(audit.workplaceObservations.some(r=>r.countries.includes('Canada')));assert.equal(readInventoryEvidence(jobs).listingComplete,true)})
for(const[name,change]of[
 ['own current careers handoff removed',(q,url)=>{if(url===HOME)q.text=q.text.replaceAll('href="/careers"','href="/unrelated"')}],
 ['declared embed account changed',(q,url)=>{if(url===LIST)q.text=q.text.replaceAll('/sandboxaq/embed?','/other/embed?')}],
 ['embed native base declaration changed',(q,url)=>{if(url===EMBED)q.text=q.text.replace('https://jobs.ashbyhq.com/sandboxaq','https://jobs.ashbyhq.com/other')}],
 ['embed active native src disconnected',(q,url)=>{if(url===EMBED)q.text=q.text.replace('window.__Ashby.buildIFrameUrl(settings, filterParams)','"https://jobs.ashbyhq.com/other"')}],
 ['embed declared base overridden later',(q,url)=>{if(url===EMBED)q.text+='\nwindow.__ashbyBaseJobBoardUrl="https://jobs.ashbyhq.com/other";'}],
 ['embed automatic current board disabled',(q,url)=>{if(url===EMBED)q.text=q.text.replace('autoLoad: true','autoLoad: false')}],
 ['dead native base declaration',(q,url)=>{if(url===EMBED)q.text=q.text.replace('if (!window.__ashbyBaseJobBoardUrl)','if (false)')}],
 ['later settings merge native base override',(q,url)=>{if(url===EMBED)q.text=q.text.replace('settingsOverrides);','settingsOverrides, {ashbyBaseJobBoardUrl:"https://jobs.ashbyhq.com/other"});')}],
 ['later appData model mutation',(q,url)=>{if(url===BOARD)q.text=q.text.replace('</script>',';window.__appData.jobBoard.jobPostings=[];</script>')}]
])test(name+' rejects the configured source contract',async()=>{await assert.rejects(replay(change))})
test('unrelated UI styling, comments and embed local lexical renames do not pin a deployment',async()=>{const{jobs}=await replay((q,url)=>{if(url===EMBED)q.text=q.text.replaceAll('baseJobBoardUrl','reviewedBaseLocation').replaceAll('urlForIframe','reviewedUrl').replace('"use strict";','"use strict";\n// Ordinary release.');if(url===LIST)q.text=q.text.replace('ashby_embed','ashby_embed')});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,true)})
for(const status of[202,401,402,403,406,407,429,451,503])test('mandatory native HTTP'+status+' is retained and stops without retry or zero',async()=>{let calls=0;await assert.rejects(replay((q,url,index)=>{calls++;if(url===BOARD&&index===0){q.status=status;q.text='Unavailable'}}));assert.equal(calls,5)})
test('complete200 invalidUTF8, MIME and redirected metadata cannot qualify a zero',async()=>{for(const change of[q=>q.originalBytes=Buffer.from([0xc3,0x28]),q=>q.headers['content-type']='application/json',q=>q.redirected=true])await assert.rejects(replay((q,url)=>{if(url===BOARD)change(q)}))})
test('caller abort propagates exactly before any acquisition',async()=>{assert.equal(typeof api.runCurrentConfiguredBoard,'function');const c=new AbortController(),reason=Object.freeze({caller:'sandboxaq'});c.abort(reason);await assert.rejects(api.runCurrentConfiguredBoard({signal:c.signal}),error=>error===reason)})
test('current own production factory and standard assessor retain fetched-zero only for the configured native board',async()=>{const provider=(await import('./catalog.js')).default,{createSandboxAQScraper}=await import('./script.js');assert.equal(provider.authoritativeCurrentPublication,true);assert.equal(provider.backfillMode,'live-parser');assert.equal(provider.scraperTimeoutMs,180000);assert.equal(provider.verifiedOn,null);const{jobs,calls}=await replay(null,{},options=>createSandboxAQScraper().run(options)),assessment=assessSoftFailureAcquisition(provider,jobs);assert.equal(calls.length,10);assert.equal(assessment.zeroJobEvidence,'fetched-zero');assert.equal(assessment.runnerOutcome.success,true);assert.equal(assessment.cleanupOptions.replaceExisting,false)})
test('37 observed foreign native vacancy rows remain observations separately from company counts and zero India projection',async()=>{const{jobs}=await replay(),e=readSourceObservationEvidence(jobs,'sandboxaq');assert.equal(e?.observedVacancyCount,37);assert.equal(e?.sourceScopeComplete,false);assert.equal(e?.companyIndiaTotal,null)})
function originalModelScript(html,edit){const d=readNativeDocument(html),s=d.nodes(n=>n.tag==='script'&&!n.attrs.src&&n.raw?.includes('window.__appData ='))[0];assert.ok(s);return html.replace(s.raw,()=>edit(s.raw))}
for(const[name,change]of[
 ['dead literal assignment',html=>originalModelScript(html,raw=>raw.replace('window.__appData =','if (false) window.__appData ='))],
 ['computed model write',html=>originalModelScript(html,raw=>raw+";window['__appData'].jobBoard.jobPostings[0].locationName='India';")],
 ['lexical model alias write',html=>originalModelScript(html,raw=>raw+";var escapedNative=window.__appData;escapedNative.jobBoard.jobPostings[0].locationName='India';")],
 ['board immediate refresh',html=>html.replace('</head>','<meta http-equiv="refresh" content="0;url=https://other.invalid/"></head>')]
])test('independent peer '+name+' prevents stale native configured zero',async()=>{await assert.rejects(replay((q,url,index)=>{if(url===BOARD&&index===1)q.text=change(q.text)}))})
test('independent peer late caller abort at audit boundary propagates exact opaque reason',async()=>{const controller=new AbortController(),reason=Object.freeze({caller:'sandbox-after-audit'});await assert.rejects(replay(null,{signal:controller.signal,onAudit:()=>queueMicrotask(()=>controller.abort(reason))}),error=>error===reason)})
export{fixture,replay,model,HOME,CAREERS,LIST,EMBED,BOARD}
