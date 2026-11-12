import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readJasperCorporate,readJasperBoard,readJasperApi,readJasperOwn,reconcileJasperServerProgramme} from '../scraper/jasper/currentProgrammeData.js'
import * as representation from '../scraper/jasper/currentProgrammeRenderer.js'

// Ten genuine independent openings only. Every altered packet is controlled
// test evidence; no closing or current programme is represented by this suite.
let networkAttempts=0
globalThis.fetch=()=>{networkAttempts++;throw Error('Jasper pure tests forbid HTTP')}
const sha=b=>createHash('sha256').update(b).digest('hex')
const fixtureBytes=fs.readFileSync(new URL('./fixtures/jasper-server-programme-originals-20261111.json.gz',import.meta.url))
const fixture=JSON.parse(gunzipSync(fixtureBytes))
const B='https://jobs.ashbyhq.com/Jasper%20AI',A='https://api.ashbyhq.com/posting-api/job-board/Jasper%20AI'
const IDs=['788b07a9-1d7c-4c07-9dac-0d6b230238fc','54b7f667-feff-4df3-8ece-238f0c668851','721ceaea-3c25-481d-979d-861251b1a83a','630c8ab8-d9a0-4a4c-847c-c9d17161a91e','e85a9104-c15a-429c-a7f1-d7f581c402ca','6c949b3c-bbd9-4dc6-8818-0366f77778bf','365bc527-6f65-4c24-aaa2-aab59d06c3c3']
const packets=()=>fixture.responses.map(p=>({...structuredClone(p.originalReceipt),body:Buffer.from(p.bodyBase64,'base64')}))
const text=p=>Buffer.from(p.body).toString('utf8')
function changed(packet,source){
 const body=Buffer.from(source),result={...packet,body,bodyBytes:body.length,bodySHA256:sha(body),consumedBodyBytes:body.length,
  controlledEvidence:'Altered original opening for an offline negative/expansion control; never acquired publisher evidence.'}
 return result
}
function originalBoot(packet){
 const body=text(packet),match=/<script nonce="[^"]+">([\s\S]*?window\.__appData[\s\S]*?)<\/script>/.exec(body)
 assert.ok(match,'Actual original boot carrier must exist in control setup')
 const source=match[1],ast=parse(source,{ecmaVersion:'latest'}),expression=ast.body[0].expression
 assert.equal(expression.type,'AssignmentExpression');assert.equal(expression.left.property.name,'__appData')
 return{body,match,source,start:expression.right.start,end:expression.right.end,value:JSON.parse(source.slice(expression.right.start,expression.right.end))}
}
function changeBoot(packet,edit){const b=originalBoot(packet);edit(b.value);const next=b.source.slice(0,b.start)+JSON.stringify(b.value)+b.source.slice(b.end);return changed(packet,b.body.replace(b.source,next))}
function changeLD(packet,edit){const body=text(packet),match=/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(body);assert.ok(match);const model=JSON.parse(match[1]);edit(model);return changed(packet,body.replace(match[0],'<script type="application/ld+json">'+JSON.stringify(model)+'</script>'))}
function changeApi(packet,edit){const model=JSON.parse(text(packet));edit(model);return changed(packet,JSON.stringify(model))}
function header(packet,name,value){
 const headers={...packet.headers},headerEntries=packet.headerEntries.filter(([key])=>key!==name).map(pair=>[...pair])
 if(value===null)delete headers[name];else{headers[name]=value;headerEntries.push([name,value])}
 return{...packet,headers,headerEntries,controlledEvidence:'Controlled original-header change, not a publisher observation.'}
}
const replay=rows=>reconcileJasperServerProgramme({corporate:readJasperCorporate(rows[0]),board:readJasperBoard(rows[1]),api:readJasperApi(rows[2]),roles:rows.slice(3).map(p=>readJasperOwn(p))})
const hold=(edit,reason)=>{const rows=packets();edit(rows);assert.throws(()=>replay(rows),e=>e.code==='JASPER_PROGRAMME_HOLD'&&e.failureKind==='coverage_gap'&&(!reason||reason.test(e.reason)),reason?.source)}

test('genuine ten openings preserve all seven native records and every original criterion without claiming a current zero',()=>{
 assert.equal(sha(fixtureBytes),'82af37b04e3aa043abccf0b56c5a9106dd2b167fc5eea22c5ced3a702a24bae9')
 assert.equal(fixture.responses.length,10);assert.equal(fixture.closingPackets,0);assert.equal(fixture.currentnessQualified,false)
 const rows=packets(),result=replay(rows),api=JSON.parse(text(rows[2]))
 assert.deepEqual(result.nativeRecords.map(r=>r.id),IDs)
 assert.deepEqual(result.nativePayload,api);assert.equal(JSON.stringify(result.nativePayload),text(rows[2]))
 assert.notDeepEqual(result.originalBoard.jobPostings.map(r=>r.id),IDs,'The actual independent B order must remain distinct')
 assert.equal(result.originalBoard.teams.length,7)
 for(const [i,record]of result.nativeRecords.entries()){
  assert.equal(record.originalAPI.descriptionHtml,api.jobs[i].descriptionHtml)
  assert.equal(record.originalPosting.descriptionHtml,api.jobs[i].descriptionHtml)
  assert.equal(record.originalLD.description,api.jobs[i].descriptionHtml)
  assert.equal(record.originalAPI.descriptionPlain,api.jobs[i].descriptionPlain)
  assert.equal(record.primaryWorkCountry,'USA');assert.equal(record.displayLocation,'United States')
  assert.equal(record.originalPosting.shouldAskForTextingConsent,true)
  assert.equal(record.originalPosting.candidateTextingPrivacyPolicyUrl,'https://legal.jasper.ai/#candidate-notice')
  assert.match(record.originalPosting.applicationLimitCalloutHtml,/2 times in 60 days/)
  assert.match(record.originalPosting.applicationLimitCalloutHtml,/within 30 days/)
  assert.equal(record.originalPosting.compensationTierSummary,null);assert.deepEqual(record.originalPosting.compensationTiers,[])
 }
 assert.match(result.nativeRecords[0].originalAPI.descriptionHtml,/\$250,000 OTE/)
 for(const flag of ['currentnessQualified','programmeZeroQualified','sourceScopeComplete','companyGlobalScopeQualified','sourceBodiesQualified','rendererConsumptionQualified','fullRenderedCriteriaQualified','browserExecutionQualified','applicationVisited','screeningCriteriaAcquired','privacyPolicyVisited','legalSemanticsQualified','applicantEligibilityQualified','legalEmployerQualified','lifecycleCleanupAllowed'])assert.equal(result[flag],false,flag)
 assert.equal(result.observation.recordKind,'vacancy-rows');assert.equal(result.observation.observedRecordCount,7);assert.equal(result.observation.observedVacancyCount,7)
 assert.equal(result.reportedTotal,null);assert.equal(networkAttempts,0)
})

test('original header views and complete source bytes are retained without mutable aliases',()=>{
 const rows=packets(),api=readJasperApi(rows[2]),saved=api.originalResponse.bodyBase64
 rows[2].body.fill(0);rows[2].headers['content-type']='unsupported'
 assert.equal(api.originalResponse.bodyBase64,saved);assert.equal(api.originalResponse.headers['content-type'],'application/json; charset=utf-8')
 assert.ok(Object.isFrozen(api.nativePayload));assert.throws(()=>{api.nativePayload.jobs[0].title='changed'},TypeError)
})

test('dynamic one-record programme preserves the whole original team forest rather than pinning seven roles',()=>{
 const r=packets();r[2]=changeApi(r[2],a=>{a.jobs=a.jobs.slice(0,1)});r[1]=changeBoot(r[1],b=>{b.jobBoard.jobPostings=b.jobBoard.jobPostings.filter(p=>p.id===IDs[0])})
 const result=replay(r.slice(0,4));assert.equal(result.nativeRecords.length,1);assert.equal(result.originalBoard.teams.length,7)
})

test('dynamic ten-record expansion qualifies only the reconciled original-class source data, never a fresh interval',()=>{
 const r=packets(),a=JSON.parse(text(r[2])),b=originalBoot(r[1]).value
 for(let n=1;n<=3;n++){
  const id='00000000-0000-4000-8000-'+String(n).padStart(12,'0'),job=structuredClone(a.jobs[0]);job.id=id;job.jobUrl=B+'/'+id;job.applyUrl=job.jobUrl+'/application';a.jobs.push(job)
  const brief=structuredClone(b.jobBoard.jobPostings.find(p=>p.id===IDs[0]));brief.id=id;b.jobBoard.jobPostings.push(brief)
  const expanded=changed(r[3],text(r[3]).replaceAll(IDs[0],id));expanded.id=id;expanded.requestedURL=job.jobUrl;expanded.finalURL=job.jobUrl;r.push(expanded)
 }
 r[2]=changed(r[2],JSON.stringify(a));r[1]=changeBoot(r[1],v=>{v.jobBoard=b.jobBoard})
 const result=replay(r);assert.equal(result.nativeRecords.length,10);assert.equal(result.currentnessQualified,false)
})

for(const [name,edit,reason]of [
 ['numeric apiVersion',r=>{r[2]=changeApi(r[2],a=>{a.apiVersion=1})},/api/],
 ['extra envelope field',r=>{r[2]=changeApi(r[2],a=>{a.extra=true})},/api/],
 ['unlisted role',r=>{r[2]=changeApi(r[2],a=>{a.jobs[0].isListed=false})},/api/],
 ['duplicate API identity',r=>{r[2]=changeApi(r[2],a=>{a.jobs.push(a.jobs[0])})},/membership/],
 ['empty inventory',r=>{r[2]=changeApi(r[2],a=>{a.jobs=[]})},/membership/],
 ['missing board member',r=>{r[1]=changeBoot(r[1],b=>{b.jobBoard.jobPostings.pop()})},/membership/],
 ['stealth subset',r=>{r[1]=changeBoot(r[1],b=>{b.jobBoard.stealthAccess=true})},/membership/],
 ['duplicate team',r=>{r[1]=changeBoot(r[1],b=>{b.jobBoard.teams.push(b.jobBoard.teams[0])})},/team/],
 ['orphan team',r=>{r[1]=changeBoot(r[1],b=>{b.jobBoard.teams[0].parentTeamId='00000000-0000-4000-8000-000000000099'})},/team/],
 ['cyclic team',r=>{r[1]=changeBoot(r[1],b=>{b.jobBoard.teams[0].parentTeamId=b.jobBoard.teams[0].id})},/team/],
 ['changed department',r=>{r[2]=changeApi(r[2],a=>{a.jobs[0].department='Other'})},/team/],
 ['changed own team path',r=>{r[3]=changeBoot(r[3],b=>{b.posting.teamNames.reverse()})},/team/],
 ['wrong source account',r=>{r[3].requestedURL=r[3].finalURL=r[3].requestedURL.replace('Jasper%20AI','jasper')},/route/],
 ['query role alias',r=>{r[2]=changeApi(r[2],a=>{a.jobs[0].jobUrl+='?country=USA'})},/identity/],
 ['foreign apply URL',r=>{r[2]=changeApi(r[2],a=>{a.jobs[0].applyUrl='https://other.example/apply'})},/identity/],
 ['changed schema employer',r=>{r[3]=changeLD(r[3],s=>{s.hiringOrganization.name='Other'})},/identity/],
 ['unknown full field',r=>{r[3]=changeBoot(r[3],b=>{b.posting.newApplicantCriteria=true})},/own/],
 ['dropped full callout',r=>{r[3]=changeBoot(r[3],b=>{delete b.posting.applicationLimitCalloutHtml})},/own/],
 ['changed application count',r=>{r[3]=changeBoot(r[3],b=>{b.posting.applicationLimitCalloutHtml=b.posting.applicationLimitCalloutHtml.replace('2 times','20 times')})},/supplement/],
 ['dropped SMS condition',r=>{r[3]=changeBoot(r[3],b=>{b.posting.shouldAskForTextingConsent=false})},/supplement/],
 ['changed privacy pointer',r=>{r[3]=changeBoot(r[3],b=>{b.posting.candidateTextingPrivacyPolicyUrl='https://other.example/privacy'})},/supplement/],
 ['new pay tier',r=>{r[3]=changeBoot(r[3],b=>{b.posting.compensationTiers=[{amount:1}]})},/supplement/],
 ['new deadline',r=>{r[3]=changeBoot(r[3],b=>{b.posting.applicationDeadline='2026-12-01'})},/supplement/],
 ['API plain-only numeric contradiction',r=>{r[2]=changeApi(r[2],a=>{a.jobs[0].descriptionPlain=a.jobs[0].descriptionPlain.replace('4+ years','40+ years')})},/criteria/],
 ['HTML word split',r=>{r[3]=changeBoot(r[3],b=>{b.posting.descriptionHtml=b.posting.descriptionHtml.replace('4+ years','4 + years')})},/criteria/],
 ['head-only criteria change',r=>{r[3]=changed(r[3],text(r[3]).replace('content="Jasper is the marketing agents platform','content="Other is the marketing agents platform'))},/native-head|criteria/],
 ['typed India',r=>{r[2]=changeApi(r[2],a=>{a.jobs[0].address.postalAddress.addressCountry='India'})},/country/],
 ['country-name alias',r=>{r[2]=changeApi(r[2],a=>{a.jobs[0].address.postalAddress.addressCountry='United States'})},/country/],
 ['object country contradiction',r=>{r[3]=changeLD(r[3],s=>{s.jobLocation.address.addressCountry={name:'USA',identifier:'IN'}})},/country/],
 ['new applicant scope',r=>{r[3]=changeLD(r[3],s=>{s.applicantLocationRequirements.name='India'})},/country/],
 ['new address component',r=>{r[3]=changeLD(r[3],s=>{s.jobLocation.address.streetAddress='Bangalore, India'})},/country/],
 ['new secondary location',r=>{r[2]=changeApi(r[2],a=>{a.jobs[0].secondaryLocations=[{location:'India'}]})},/country/],
 ['worldwide display inference',r=>{r[3]=changeBoot(r[3],b=>{b.posting.locationName='Worldwide'})},/country/],
 ['invalid calendar',r=>{r[2]=changeApi(r[2],a=>{a.jobs[0].publishedAt='2026-02-30T20:46:37.523+00:00'})},/date/],
 ['invented LD deadline',r=>{r[3]=changeLD(r[3],s=>{s.validThrough='2026-12-01'})},/schema/],
 ['numeric plain word separation',r=>{r[2]=changeApi(r[2],a=>{a.jobs[0].descriptionPlain=a.jobs[0].descriptionPlain.replace('4+ years','4 + years')})},/criteria/]
])test('holds '+name,()=>hold(edit,reason))

for(const [name,replacement]of [
 ['literal India','enterprises in India'],['unbounded any-country work','Applicants may work from any country'],
 ['unbounded global work','Applicants may work globally'],['unbounded any-location work','Remote work is available from any location'],
 ['raw format control','enterprises in In\u200bdia'],['once-decoded format control','enterprises in In&#8203;dia']
])test('aligned full primary/head data still holds '+name,()=>hold(r=>{
 r[2]=changeApi(r[2],a=>{a.jobs[0].descriptionHtml=a.jobs[0].descriptionHtml.replace('enterprises worldwide',replacement);a.jobs[0].descriptionPlain=a.jobs[0].descriptionPlain.replace('enterprises worldwide',replacement)})
 r[3]=changed(r[3],text(r[3]).replaceAll('enterprises worldwide',replacement))
},/geography|authored/))

for(const [name,edit]of [
 ['font-zero authored text',h=>h.replace('Prudential','<span style="font-size:0">India</span>')],
 ['hidden authored text',h=>h.replace('Prudential','<span hidden>India</span>')],
 ['comment split',h=>h.replace('Prudential','Ind<!--split-->ia')],
 ['SVG authored carrier',h=>h.replace('Prudential','<svg><text>India</text></svg>')],
 ['MathML authored carrier',h=>h.replace('Prudential','<math><mtext>India</mtext></math>')],
 ['new link semantics',h=>h.replace('http://legal.jasper.ai/#ccpa','https://other.example/terms')]
])test('holds unsupported '+name,()=>hold(r=>{r[3]=changeBoot(r[3],b=>{b.posting.descriptionHtml=edit(b.posting.descriptionHtml)})},/criteria|authored/))

for(const [name,needle,replacement]of [
 ['nomodule boot','<script nonce=','<script nomodule nonce='],['empty-src boot','<script nonce=','<script src="" nonce='],
 ['inert boot ancestor','<body>','<body inert>'],['hidden mount','<div id="root">','<div id="root" hidden>'],
 ['duplicate mount','<div id="root">','<div id="root"></div><div id="root">'],
 ['foreign namespace','<body>','<body><svg>'],['new own iframe','</body>','<iframe src="https://other.example/careers"></iframe></body>'],
 ['new SVG recruiting anchor','</body>','<svg><a href="https://other.example/jobs">India openings</a></svg></body>'],
 ['unqualified LD src','<script type="application/ld+json">','<script src="" type="application/ld+json">']
])test('holds '+name,()=>hold(r=>{assert.ok(text(r[3]).includes(needle));r[3]=changed(r[3],text(r[3]).replace(needle,replacement))},/native|carrier/))

for(const [name,edit]of [
 ['duplicate JSON API keys',r=>{r[2]=changed(r[2],text(r[2]).replace('"apiVersion":"1"','"apiVersion":"1","apiVersion":"1"'))}],
 ['duplicate own JSON keys',r=>{r[3]=changed(r[3],text(r[3]).replace('"environment":"production"','"environment":"production","environment":"production"'))}],
 ['duplicate classic assignment',r=>{r[3]=changed(r[3],text(r[3]).replace('</body>','<script>window.__appData={};</script></body>'))}],
 ['new corporate hiring link',r=>{r[0]=changed(r[0],text(r[0]).replace('</body>','<a href="https://new-provider.example/team">India engineering openings</a></body>'))}],
 ['hidden corporate hiring label',r=>{r[0]=changed(r[0],text(r[0]).replace('</body>','<a href="https://new-provider.example/team" hidden>India engineering openings</a></body>'))}],
 ['corporate background srcdoc',r=>{r[0]=changed(r[0],text(r[0]).replace('title="Background"','title="Background" srcdoc="India job"'))}]
])test('holds '+name,()=>hold(edit))

for(const index of [0,1,2,3])for(const [name,edit,reason]of [
 ['HTTP denial',p=>({...p,status:403}),/response/],['missing final URL',p=>{delete p.finalURL;return p},/response|route/],
 ['incomplete body',p=>({...p,bodyComplete:false}),/response/],['nonUTF8 declaration',p=>header(p,'content-type',(index===2?'application/json':'text/html')+'; charset=utf-16le'),/encoding/],
 ['mismatched original header views',p=>({...p,headerEntries:p.headerEntries.slice(1)}),/header/],
 ['challenge header',p=>header(p,'cf-chl-out','challenge'),/security/],['navigation header',p=>header(p,'refresh','0;url=https://other.example/'),/security/],
 ['attachment response',p=>header(p,'content-disposition','attachment'),/security/],['unknown document policy',p=>header(p,'document-policy','force-load-at-top'),/security/]
])test('channel '+index+' holds '+name,()=>hold(r=>{r[index]=edit(r[index])},reason))

test('strict UTF8 bytes, rather than a supplied text property, control original publication parsing',()=>hold(r=>{r[2]=changed(r[2],Buffer.from([0xff,0xfe]));r[2].text=text(packets()[2])},/encoding/))
test('same original body with an inerting native policy is not an initial qualification',()=>hold(r=>{r[1]=header(r[1],'content-security-policy',"script-src 'none'; sandbox")},/security/))
test('C policy cannot borrow a native frame-ancestors or script nonce profile',()=>hold(r=>{r[0]=header(r[0],'content-security-policy',"default-src 'none'")},/security/))
test('original native head, script and enforced CSP nonce must agree',()=>hold(r=>{r[3]=changed(r[3],text(r[3]).replace('id="csp-nonce" content="','id="csp-nonce" content="wrong'))},/native|security/))
test('untrusted caller-created parsed models and authority booleans cannot bypass original readers',()=>{
 assert.throws(()=>reconcileJasperServerProgramme({corporate:{qualified:true},board:{qualified:true},api:{nativePayload:JSON.parse(text(packets()[2]))},roles:[]}),e=>e.code==='JASPER_PROGRAMME_HOLD')
})
test('metadata accessors and proxies are rejected without executing publisher-owned behavior',()=>{
 let calls=0;const r=packets(),metadata={...r[2]};Object.defineProperty(metadata,'headers',{get(){calls++;return r[2].headers},enumerable:true})
 assert.throws(()=>readJasperApi(metadata),e=>e.code==='JASPER_PROGRAMME_HOLD');assert.equal(calls,0)
 const proxy=new Proxy(r[2],{ownKeys(){calls++;throw Error('No trap expected')}})
 assert.throws(()=>readJasperApi(proxy),e=>e.code==='JASPER_PROGRAMME_HOLD');assert.equal(calls,0)
})

test('an unreviewed native comment cannot hide a shadow identity carrier',()=>hold(r=>{
 r[3]=changed(r[3],text(r[3]).replace('</body>','<!--<div id="root">India job</div>--></body>'))
},/native-carrier/))
test('missing original response clock is not fabricated by a pure reader',()=>hold(r=>{delete r[2].responseAt},/response/))
test('contradictory original response chronology cannot qualify',()=>hold(r=>{r[2].responseAt='2026-11-11T00:00:00.000Z'},/response/))
test('supported inline nodes join authored word text without stripping case or word boundaries',()=>{
 const r=packets();r[2]=changeApi(r[2],a=>{a.jobs[0].descriptionHtml=a.jobs[0].descriptionHtml.replace('Prudential','Prud<strong>ential</strong>')})
 r[3]=changeBoot(r[3],b=>{b.posting.descriptionHtml=b.posting.descriptionHtml.replace('Prudential','Prud<strong>ential</strong>')})
 r[3]=changeLD(r[3],s=>{s.description=s.description.replace('Prudential','Prud<strong>ential</strong>')})
 const result=replay(r);assert.equal(result.nativeRecords.length,7);assert.equal(result.currentnessQualified,false)
})
for(const [label,replacement]of [['inline split','Ind<strong>ia</strong>'],['entity split','Ind&#105;a']])test('aligned '+label+' India still holds at authored country inspection',()=>hold(r=>{
 r[2]=changeApi(r[2],a=>{a.jobs[0].descriptionHtml=a.jobs[0].descriptionHtml.replace('Prudential',replacement);a.jobs[0].descriptionPlain=a.jobs[0].descriptionPlain.replace('Prudential','India')})
 r[3]=changed(r[3],text(r[3]).replaceAll('Prudential','India'))
 r[3]=changeBoot(r[3],b=>{b.posting.descriptionHtml=b.posting.descriptionHtml.replace('India',replacement)})
 r[3]=changeLD(r[3],s=>{s.description=s.description.replace('India',replacement)})
},/geography/))
test('plain-only case contradiction is retained and rejected',()=>hold(r=>{r[2]=changeApi(r[2],a=>{a.jobs[0].descriptionPlain=a.jobs[0].descriptionPlain.replace('Jasper','jasper')})},/criteria/))
test('array country is not an alias for the literal typed USA class',()=>hold(r=>{r[2]=changeApi(r[2],a=>{a.jobs[0].address.postalAddress.addressCountry=['USA','India']})},/country/))
test('all own publications and original API order are required',()=>hold(r=>{[r[3],r[4]]=[r[4],r[3]]},/membership/))
test('native duplicate mount attribute cannot be lost in DOM first-value parsing',()=>hold(r=>{r[3]=changed(r[3],text(r[3]).replace('id="root"','id="root" id="root"'))},/native-carrier/))
test('metadata toJSON is never called to manufacture original bytes',()=>{
 let calls=0;const r=packets()[2];r.toJSON=()=>{calls++;return{}}
 assert.throws(()=>readJasperApi(r),e=>e.code==='JASPER_PROGRAMME_HOLD');assert.equal(calls,0)
})
test('intrinsic entity copy ignores a typed array valueOf and iterator without truncating bytes',()=>{
 let calls=0;const r=packets()[2],expected=sha(r.body)
 Object.defineProperty(r.body,'valueOf',{value:()=>{calls++;return 4}})
 Object.defineProperty(r.body,Symbol.iterator,{value:function*(){calls++;yield 0}})
 const result=readJasperApi(r)
 assert.equal(result.originalResponse.bodySHA256,expected);assert.equal(calls,0)
})
test('an extra native server data carrier cannot disappear because it has no visible text',()=>hold(r=>{
 r[3]=changed(r[3],text(r[3]).replace('</body>','<div data-recruitment="India job"></div></body>'))
},/native-carrier/))
for(const [key,value]of [['method','POST'],['redirect','follow'],['credentials','include'],['cache','force-cache'],['source','other']])
 test('original request provenance holds changed '+key,()=>hold(r=>{r[2][key]=value},/response/))
test('original request headers cannot silently add authentication',()=>hold(r=>{r[2].requestHeaders={...r[2].requestHeaders,Authorization:'controlled-not-a-credential'}},/response/))
test('caller-created publication factory cannot bless altered parsed criteria without rereading original bodies',()=>{
 const original=replay(packets()),c=structuredClone(original.originalCorporate),b=structuredClone(original.originalBoardPublication),a=structuredClone(original.originalAPIPublication),o=structuredClone(original.originalOwnPublications)
 const from='enterprises worldwide',to='Applicants may work globally'
 a.nativePayload.jobs[0].descriptionHtml=a.nativePayload.jobs[0].descriptionHtml.replace(from,to)
 a.nativePayload.jobs[0].descriptionPlain=a.nativePayload.jobs[0].descriptionPlain.replace(from,to)
 o[0].originalAppData.posting.descriptionHtml=o[0].originalAppData.posting.descriptionHtml.replace(from,to)
 o[0].originalLD.description=o[0].originalLD.description.replace(from,to)
 o[0].primaryProjection.APIPlain=a.nativePayload.jobs[0].descriptionPlain
 // The historical exposed factory is exercised if present; after correction,
 // these remain ordinary untrusted caller records and must still be held.
 const forge=representation.publication??((_kind,value)=>value)
 const input={corporate:forge('C',c),board:forge('B',b),api:forge('A',a),roles:o.map(v=>forge('O',v))}
 assert.throws(()=>reconcileJasperServerProgramme(input),e=>e.code==='JASPER_PROGRAMME_HOLD'&&e.reason==='provenance')
})
test('reconciliation own-data input accessors never execute',()=>{
 const r=packets(),valid={corporate:readJasperCorporate(r[0]),board:readJasperBoard(r[1]),api:readJasperApi(r[2]),roles:r.slice(3).map(readJasperOwn)}
 let calls=0;const input={...valid};Object.defineProperty(input,'corporate',{get(){calls++;return valid.corporate},enumerable:true})
 assert.throws(()=>reconcileJasperServerProgramme(input),e=>e.code==='JASPER_PROGRAMME_HOLD'&&e.reason==='provenance');assert.equal(calls,0)
})
test('reconciliation own-data input proxy traps never execute',()=>{
 let calls=0;const input=new Proxy({},{get(){calls++;throw Error('No proxy call')}})
 assert.throws(()=>reconcileJasperServerProgramme(input),e=>e.code==='JASPER_PROGRAMME_HOLD'&&e.reason==='provenance');assert.equal(calls,0)
})
test('reconciliation role array accessors never execute',()=>{
 const r=packets(),roles=r.slice(3).map(readJasperOwn),first=roles[0];let calls=0
 Object.defineProperty(roles,'0',{get(){calls++;return first},enumerable:true})
 assert.throws(()=>reconcileJasperServerProgramme({corporate:readJasperCorporate(r[0]),board:readJasperBoard(r[1]),api:readJasperApi(r[2]),roles}),
  e=>e.code==='JASPER_PROGRAMME_HOLD'&&e.reason==='provenance');assert.equal(calls,0)
})
test('reconciliation role proxy traps never execute',()=>{
 const r=packets();let calls=0;const roles=new Proxy(r.slice(3).map(readJasperOwn),{get(){calls++;throw Error('No proxy call')}})
 assert.throws(()=>reconcileJasperServerProgramme({corporate:readJasperCorporate(r[0]),board:readJasperBoard(r[1]),api:readJasperApi(r[2]),roles}),
  e=>e.code==='JASPER_PROGRAMME_HOLD'&&e.reason==='provenance');assert.equal(calls,0)
})
test('mutating input bytes or legitimate reader models cannot change the privately owned original criteria',()=>{
 const r=packets(),input={corporate:readJasperCorporate(r[0]),board:readJasperBoard(r[1]),api:readJasperApi(r[2]),roles:r.slice(3).map(readJasperOwn)}
 const originalHTML=input.roles[0].originalAppData.posting.descriptionHtml
 r[3].body.fill(0);r[2].headers['content-type']='unsupported controlled mutation'
 assert.throws(()=>{input.roles[0].originalAppData.posting.descriptionHtml='Applicants may work globally'},TypeError)
 assert.throws(()=>{input.api.nativePayload.jobs[0].descriptionHtml='Applicants may work globally'},TypeError)
 const result=reconcileJasperServerProgramme(input)
 assert.equal(result.nativeRecords[0].originalPosting.descriptionHtml,originalHTML)
 assert.equal(result.nativeRecords[0].originalAPI.descriptionHtml,originalHTML)
 assert.equal(result.nativeRecords.length,7);assert.equal(result.currentnessQualified,false)
})

// These are altered original openings, never new publisher observations.
for(const [label,replacement]of [
 ['around-world work permission','around the world'],['UK work permission','in the UK'],
 ['novel work jurisdiction','in an employer-designated jurisdiction']
])test('correction5 holds coherent '+label+' outside the complete reviewed content family',()=>hold(r=>{
 for(const index of [2,3]){
  assert.ok(text(r[index]).includes('within the continental US'))
  r[index]=changed(r[index],text(r[index]).replaceAll('within the continental US',replacement))
 }
},/criteria-family/))

function changedFirstTitle(rows,title){
 const previous=JSON.parse(text(rows[2])).jobs[0].title
 rows[2]=changeApi(rows[2],a=>{a.jobs[0].title=title})
 rows[1]=changeBoot(rows[1],b=>{b.jobBoard.jobPostings.find(j=>j.id===IDs[0]).title=title})
 rows[3]=changeBoot(rows[3],b=>{b.posting.title=title})
 rows[3]=changeLD(rows[3],s=>{s.title=title})
 let source=text(rows[3])
 source=source.replace('<title>'+previous+' @ Jasper</title>','<title>'+title+' @ Jasper</title>')
 source=source.replace(/<meta\b[^>]*\b(?:name|property)="(?:title|og:title|twitter:title)"[^>]*>/g,
  tag=>tag.replace('content="'+previous+' @ Jasper"','content="'+title+' @ Jasper"').replace('content="'+previous+'"','content="'+title+'"'))
 rows[3]=changed(rows[3],source)
}
for(const title of ['Enterprise Account Manager UK','Senior Director, Product Marketing'])
 test('correction5 binds the original complete criteria to the exact title '+title,()=>hold(r=>changedFirstTitle(r,title),/criteria-family/))

test('correction5 holds a coherently changed full department/team path',()=>hold(r=>{
 const b=originalBoot(r[1]).value,brief=b.jobBoard.jobPostings.find(j=>j.id===IDs[0]),teams=new Map(b.jobBoard.teams.map(t=>[t.id,t]))
 let root=teams.get(brief.teamId);while(root.parentTeamId!==null)root=teams.get(root.parentTeamId)
 const rootId=root.id,internal=root.name+' UK',external=(root.externalName??root.name)+' UK'
 r[1]=changeBoot(r[1],n=>{n.jobBoard.jobPostings=n.jobBoard.jobPostings.filter(j=>j.id===IDs[0]);const t=n.jobBoard.teams.find(t=>t.id===rootId);t.name=internal;t.externalName=external})
 r[2]=changeApi(r[2],a=>{a.jobs=a.jobs.slice(0,1);a.jobs[0].department=external})
 r[3]=changeBoot(r[3],n=>{n.posting.departmentName=internal;n.posting.departmentExternalName=external;n.posting.teamNames[0]=external})
 r.splice(4)
},/team-family/))

for(const field of ['name','externalName'])test('correction5 checks unused complete-forest team '+field,()=>hold(r=>{
 r[2]=changeApi(r[2],a=>{a.jobs=a.jobs.slice(0,1)})
 r[1]=changeBoot(r[1],b=>{
  b.jobBoard.jobPostings=b.jobBoard.jobPostings.filter(j=>j.id===IDs[0])
  const unused=b.jobBoard.teams.find(t=>t.name==='Finance');assert.ok(unused)
  unused[field]='Finance UK'
 })
 r.splice(4)
},/team-family/))

test('correction5 equivalent once-decoded authored entities preserve the complete exact projection',()=>{
 const r=packets()
 r[2]=changeApi(r[2],a=>{a.jobs[0].descriptionHtml=a.jobs[0].descriptionHtml.replace('Prudential','Prud&#101;ntial')})
 r[3]=changeBoot(r[3],b=>{b.posting.descriptionHtml=b.posting.descriptionHtml.replace('Prudential','Prud&#101;ntial')})
 r[3]=changeLD(r[3],s=>{s.description=s.description.replace('Prudential','Prud&#101;ntial')})
 const result=replay(r);assert.equal(result.nativeRecords.length,7)
 assert.equal(result.nativeRecords[0].originalAPIPlain,JSON.parse(text(packets()[2])).jobs[0].descriptionPlain)
 assert.ok(result.nativeRecords[0].originalAPIHTML.includes('Prud&#101;ntial'))
})

test('correction5 preserves independent complete board order and dynamic team UUIDs',()=>{
 const r=packets()
 r[1]=changeBoot(r[1],b=>{
  const replacements=new Map(b.jobBoard.teams.map((t,i)=>[t.id,'10000000-0000-4000-8000-'+String(i+1).padStart(12,'0')]))
  b.jobBoard.teams.forEach(t=>{t.id=replacements.get(t.id);if(t.parentTeamId!==null)t.parentTeamId=replacements.get(t.parentTeamId)})
  b.jobBoard.jobPostings.forEach(j=>{j.teamId=replacements.get(j.teamId)})
  b.jobBoard.jobPostings.reverse()
 })
 const result=replay(r);assert.equal(result.nativeRecords.length,7)
 assert.deepEqual(result.originalAPIOrder,IDs)
 assert.deepEqual(result.originalBoardOrder,originalBoot(packets()[1]).value.jobBoard.jobPostings.map(j=>j.id).reverse())
 assert.ok(result.originalBoard.teams.every(t=>t.id.startsWith('10000000-')))
})

for(const index of [0,1,2,3])for(const [key,value]of [
 ['decodedPrefixOnly',true],['streamDone',false],['error',{name:'Error',message:'Controlled interrupted original read'}],
 ['consumedBodyBytes',1],['discardedOverflowBytes',1]
])test('correction5 channel '+index+' holds contradictory complete-response '+key,()=>hold(r=>{r[index][key]=value},/response/))

for(const [key,value]of [['decodedPrefixOnly','false'],['streamDone',1],['error',false]])
 test('correction5 holds an unknown completion representation for '+key,()=>hold(r=>{r[2][key]=value},/response/))

test('correction5 exact benign optional completion facts retain all original entities and metadata',()=>{
 const r=packets();for(const row of r){row.decodedPrefixOnly=false;row.streamDone=true;row.error=null}
 const result=replay(r),all=[result.originalCorporate,result.originalBoardPublication,result.originalAPIPublication,...result.originalOwnPublications]
 for(const [i,publication]of all.entries()){
  assert.equal(publication.originalResponse.bodySHA256,sha(r[i].body))
  assert.equal(publication.originalResponse.decodedPrefixOnly,false);assert.equal(publication.originalResponse.streamDone,true)
  assert.equal(publication.originalResponse.error,null)
  assert.equal(publication.originalResponse.consumedBodyBytes,r[i].body.length)
  assert.equal(publication.originalResponse.discardedOverflowBytes,0)
 }
 assert.equal(result.currentnessQualified,false);assert.equal(result.programmeZeroQualified,false)
})

test('correction5 completion accessors cannot execute while establishing original evidence',()=>{
 let calls=0;const row=packets()[2]
 Object.defineProperty(row,'streamDone',{enumerable:true,get(){calls++;return true}})
 assert.throws(()=>readJasperApi(row),e=>e.code==='JASPER_PROGRAMME_HOLD');assert.equal(calls,0)
})
