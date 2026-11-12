import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readFrontCorporate,readFrontFeed,readFrontApi,reconcileFrontServerProgramme} from '../scraper/front/currentProgrammeData.js'
import {readFrontNativeHtml} from '../scraper/front/currentProgrammeRenderer.js'

globalThis.fetch=()=>{throw Error('Front server-data pure tests forbid HTTP')}
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/front-current-programme-openings-20261111.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const rows=()=>structuredClone(fixture.responses.filter(value=>value.kind!=='native-board'))
const row=(values,kind)=>values.find(value=>value.kind===kind)
const text=value=>Buffer.from(value.bodyBase64,'base64').toString('utf8')
const setText=(value,html)=>{value.bodyBase64=Buffer.from(html).toString('base64');value.bodyBytes=Buffer.byteLength(html);value.bodySHA256=sha(Buffer.from(html))}
const input=value=>({text:text(value),url:value.finalURL,headers:value.headers,headerEntries:value.headerEntries})
const parsed=values=>({corporate:readFrontCorporate(input(row(values,'corporate'))),feed:readFrontFeed(input(row(values,'corporate-feed'))),
  api:readFrontApi(input(row(values,'native-api'))),roles:values.filter(value=>value.kind.startsWith('own-')).map(value=>readFrontNativeHtml(input(value)))})
const reconcile=values=>reconcileFrontServerProgramme(parsed(values))
const hold=(action,reason)=>assert.throws(action,error=>error.code==='FRONT_PROGRAMME_HOLD'&&new RegExp(reason).test(error.reason))
function jsonBody(value,change){const model=JSON.parse(text(value));change(model);setText(value,JSON.stringify(model))}
function jsonScript(value,kind,change){
  const html=text(value),scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  const script=scripts.find(match=>kind==='boot'?match[1].includes('window.__appData'):kind==='next'?match[0].includes('id="__NEXT_DATA__"'):match[0].includes('type="application/ld+json"'))
  assert.ok(script,'Control found the genuine original carrier')
  let start=0,end=script[1].length
  if(kind==='boot'){const assignment=parse(script[1],{ecmaVersion:'latest'}).body[0].expression;start=assignment.right.start;end=assignment.right.end}
  const model=JSON.parse(script[1].slice(start,end));change(model)
  setText(value,html.replace(script[1],script[1].slice(0,start)+JSON.stringify(model)+script[1].slice(end)))
}
const encode=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
function metadata(value,name,replacement){
  let changed=0
  setText(value,text(value).replace(/<meta\b[^>]*>/gi,tag=>{
    if(!tag.includes('name="'+name+'"')&&!tag.includes('property="'+name+'"'))return tag
    changed++;return tag.replace(/content="[\s\S]*?"/,'content="'+encode(replacement)+'"')
  }))
  assert.equal(changed,1)
}
function appendCriterion(values,html,plain){
  const own=row(values,'own-91e4b4ad'),id='91e4b4ad-9ce3-4bc7-896e-f36ff234eca1'
  jsonBody(row(values,'native-api'),model=>{const job=model.jobs.find(value=>value.id===id);job.descriptionHtml+=html;job.descriptionPlain+='\n\n'+plain})
  jsonScript(own,'boot',model=>{model.posting.descriptionHtml+=html});jsonScript(own,'ld',model=>{model.description+=html})
  const description=JSON.parse(text(row(values,'native-api'))).jobs.find(value=>value.id===id).descriptionPlain
  for(const name of ['description','og:description','twitter:description'])metadata(own,name,description)
}
function remove(values,id){
  const corporate=row(values,'corporate'),url='https://jobs.ashbyhq.com/frontcareers/'+id
  jsonScript(corporate,'next',model=>{for(const group of model.props.pageProps.jobs)group.jobs=group.jobs.filter(value=>value.key!==id)})
  const html=text(corporate),at=html.indexOf('href="'+url+'"'),start=html.lastIndexOf('<li',at),end=html.indexOf('</li>',at)+5
  assert.ok(at>=0&&start>=0&&end>at);setText(corporate,html.slice(0,start)+html.slice(end))
  jsonBody(row(values,'corporate-feed'),model=>{for(const group of model)group.jobs=group.jobs.filter(value=>value.key!==id)})
  jsonBody(row(values,'native-api'),model=>{model.jobs=model.jobs.filter(value=>value.id!==id)})
  values.splice(values.findIndex(value=>value.kind==='own-'+id.slice(0,8)),1)
}

test('seven genuine historical server entities reconcile every full original without a board',()=>{
  const values=rows(),models=parsed(values),result=reconcileFrontServerProgramme(models)
  assert.equal(values.length,7);assert.equal(result.nativeRecords.length,4)
  assert.deepEqual(result.nativePayload,JSON.parse(text(row(values,'native-api'))));assert.equal(result.nativePayload.apiVersion,'1')
  assert.deepEqual(result.nativeRecords.map(value=>value.id),result.nativePayload.jobs.map(value=>value.id))
  assert.deepEqual(result.nativeRecords.map(value=>value.country),['Chile','United States','United States','United States'])
  assert.deepEqual(result.nativeRecords.map(value=>value.nativeWorkplaceType),['Hybrid',null,'Hybrid',null])
  for(const record of result.nativeRecords){
    const own=models.roles.find(value=>value.routeFacts.id===record.id)
    assert.deepEqual(record.originalPublicRecord,result.nativePayload.jobs.find(value=>value.id===record.id))
    assert.deepEqual(record.originalNativeModel,own.originalAppData);assert.deepEqual(record.originalNativeOrganization,own.originalAppData.organization)
    assert.equal(record.originalNativePosting.descriptionHtml,record.originalPublicRecord.descriptionHtml);assert.equal(record.originalSchema.description,record.originalPublicRecord.descriptionHtml)
    assert.equal(record.originalNativeJSON,own.rawAppData);assert.equal(record.originalJobPostingJSON,own.rawLD);assert.equal(record.originalOwnHTML,own.originalHTML)
    assert.deepEqual(record.nativeDeclaration,own.declaration);assert.deepEqual(record.originalHeaders,own.originalHeaders);assert.deepEqual(record.originalHeaderEntries,own.originalHeaderEntries)
    assert.equal(record.countryQualificationScope,'finite-server-published-work-country');assert.equal(record.applicantEligibilityQualified,false)
  }
  const facts=result.qualificationFacts
  assert.equal(facts.acquiredServerFieldsReconciled,true)
  for(const key of ['currentTransactionQualified','sourceBodiesQualified','rendererConsumptionQualified','boardAcquired','fullRenderedCriteriaQualified',
    'sourceScopeComplete','companyGlobalScopeQualified','applicantEligibilityQualified','legalEmployerQualified','lifecycleCleanupAllowed'])assert.equal(facts[key],false,key)
  assert.equal(facts.companyGlobalTotal,null);assert.equal(facts.companyIndiaTotal,null);assert.equal(facts.cleanupAfterSerialization.replaceExisting,false)
  const nullMode=result.nativeRecords.filter(value=>value.nativeWorkplaceType===null)
  for(const value of nullMode){assert.equal(value.originalNativePosting.locationAddress,null);assert.equal(value.sourceRemoteStatusUnresolved,true);assert.equal(Object.hasOwn(value.originalSchema,'jobLocationType'),false);assert.equal(Object.hasOwn(value.originalSchema,'applicantLocationRequirements'),false)}
  const salary=result.nativeRecords.find(value=>value.id.startsWith('625c97e4'))
  assert.equal(salary.originalSchema.baseSalary.value.minValue,160000);assert.equal(salary.originalNativePosting.compensationTiers[0].title,'Zone 1')
  assert.equal(Buffer.byteLength(salary.originalNativePosting.compensationPhilosophyHtml),764)
  assert.equal(salary.originalNativePosting.legalEntityNameForTextingConsent,'Front Inc.')
})

test('direct own path binding preserves all original root and leaf names without a forest',()=>{
  const result=reconcile(rows())
  for(const record of result.nativeRecords){const posting=record.originalNativePosting;assert.equal(posting.teamNames[0],record.originalPublicRecord.department);assert.equal(posting.teamNames.at(-1),record.originalPublicRecord.team)}
  assert.equal(result.qualificationFacts.boardAcquired,false)
})
for(const count of [1,3])test('a consistent removal retains '+count+' real complete server records',()=>{
  const values=rows(),ids=['22e1f989-12d6-4c59-86a7-77335831e313','625c97e4-2f4f-4109-82c2-4c5fa6ac837b','cbcfb59d-506f-426d-8446-c13cfba928ac']
  for(const id of ids.slice(0,4-count))remove(values,id)
  const result=reconcile(values);assert.equal(result.nativeRecords.length,count);assert.deepEqual(result.nativePayload,JSON.parse(text(row(values,'native-api'))))
})
test('a different original API order is preserved independently of corporate order',()=>{
  const values=rows();jsonBody(row(values,'native-api'),model=>{model.jobs.reverse()})
  const result=reconcile(values);assert.deepEqual(result.nativeRecords.map(value=>value.id),JSON.parse(text(row(values,'native-api'))).jobs.map(value=>value.id))
})

for(const [channel,edit]of [
  ['corporate parsed jobs',models=>{models.corporate.originalJobs[0].jobs[0].title='Other'}],
  ['feed parsed groups',models=>{models.feed.originalGroups[0].jobs[0].title='Other'}],
  ['API parsed order',models=>{models.api.originalPayload.jobs.reverse()}],
  ['own parsed country',models=>{models.roles[0].originalLD.jobLocation.address.addressCountry='India'}],
  ['own parsed authority',models=>{models.roles[0].sourceBodiesQualified=true}],
])test('original raw revalidation rejects a contradictory '+channel,()=>{
  const models=parsed(rows());edit(models);hold(()=>reconcileFrontServerProgramme(models),'provenance')
})
test('server reconciliation accepts no board, source input or caller skip authority',()=>{
  for(const key of ['board','sourceInput','skipBoard'])hold(()=>reconcileFrontServerProgramme({...parsed(rows()),[key]:true}),'provenance')
})
test('own records must cover all current rows in the published corporate order',()=>{
  const models=parsed(rows());models.roles.pop();hold(()=>reconcileFrontServerProgramme(models),'membership')
  const reordered=parsed(rows());reordered.roles.reverse();hold(()=>reconcileFrontServerProgramme(reordered),'membership')
})
test('complete C/F group and row ordering cannot disagree',()=>{
  const values=rows();jsonBody(row(values,'corporate-feed'),model=>{model[0].jobs.reverse()});hold(()=>reconcile(values),'corporate-feed')
})
for(const value of [1,'2',null])test('uncoerced original apiVersion '+JSON.stringify(value)+' holds',()=>{
  const values=rows();jsonBody(row(values,'native-api'),model=>{model.apiVersion=value});hold(()=>reconcile(values),'api-version')
})
for(const count of [0,7])test('inventory '+count+' cannot be truncated into a finite server programme',()=>{
  const values=rows();jsonBody(row(values,'native-api'),model=>{model.jobs=Array.from({length:count},()=>structuredClone(model.jobs[0]))});hold(()=>reconcile(values),'membership')
})
test('unlisted or new API criteria records are never silently dropped',()=>{
  const values=rows();jsonBody(row(values,'native-api'),model=>{model.jobs[0].isListed=false});hold(()=>reconcile(values),'api-shape')
  const other=rows();jsonBody(row(other,'native-api'),model=>{model.jobs[0].qualifications='Additional requirement'});hold(()=>reconcile(other),'api-shape')
})
test('own account organization and LD identifier remain bound to the original native role',()=>{
  const values=rows();jsonScript(row(values,'own-91e4b4ad'),'boot',model=>{model.organization.name='Other employer'});hold(()=>reconcile(values),'native-organization')
  const other=rows();jsonScript(row(other,'own-91e4b4ad'),'ld',model=>{model.identifier.value='foreign-role'});hold(()=>reconcile(other),'identity')
})
test('an unknown or conflicting original own team projection holds',()=>{
  const values=rows();jsonScript(row(values,'own-91e4b4ad'),'boot',model=>{model.posting.teamNames[0]='Other root'});hold(()=>reconcile(values),'department')
  const other=rows();jsonScript(row(other,'own-91e4b4ad'),'boot',model=>{model.posting.departmentExternalName='Other display'});hold(()=>reconcile(other),'department')
})
test('every actual intermediate path name receives the same geography guard',()=>{
  const values=rows();jsonScript(row(values,'own-625c97e4'),'boot',model=>{assert.equal(model.posting.teamNames.length,2);model.posting.teamNames.splice(1,0,'India engineering')});hold(()=>reconcile(values),'geography')
})
for(const country of ['India','Unknown Republic',{name:'United States',identifier:'IN'}])test('published typed country '+JSON.stringify(country)+' stays held',()=>{
  const values=rows();jsonBody(row(values,'native-api'),model=>{model.jobs[0].address.postalAddress.addressCountry=country});hold(()=>reconcile(values),'country')
})
test('additional India or changed native-null address cannot disappear behind a foreign primary',()=>{
  const values=rows();jsonBody(row(values,'native-api'),model=>{model.jobs[0].secondaryLocations=['Bengaluru, India']});hold(()=>reconcile(values),'country')
  const other=rows();jsonScript(row(other,'own-91e4b4ad'),'boot',model=>{model.posting.locationAddress={addressCountry:'Chile'}});hold(()=>reconcile(other),'country')
})
test('published applicant-country contradiction and new null-mode applicant fields hold',()=>{
  const values=rows();jsonScript(row(values,'own-91e4b4ad'),'ld',model=>{model.applicantLocationRequirements.name='India'});hold(()=>reconcile(values),'country')
  const other=rows();jsonScript(row(other,'own-22e1f989'),'ld',model=>{model.applicantLocationRequirements={'@type':'Country',name:'United States'}});hold(()=>reconcile(other),'schema-shape')
})
for(const [html,plain]of [
  ['<p>Work country: India.</p>','Work country: India.'],
  ['<p>Work location: Bangalore.</p>','Work location: Bangalore.'],
  ['<p>Work country: Ind&#105;a.</p>','Work country: India.'],
  ['<p>Work country: Ind<span>ia</span>.</p>','Work country: India.'],
  ['<p>Work country: I<span style="display:none">X</span>ndia.</p>','Work country: IXndia.'],
  ['<p>Work country: In\u200bdia.</p>','Work country: In\u200bdia.'],
  ['<p>Work country: In&ZeroWidthSpace;dia.</p>','Work country: In\u200bdia.'],
])test('complete aligned primary geography remains held: '+plain,()=>{
  const values=rows();appendCriterion(values,html,plain);hold(()=>reconcile(values),'authored|geography')
})
for(const plain of ['Applicants may work from any country.','Applicants may work globally.','Remote work is available from any location.'])
test('global work permission remains held in full server criteria: '+plain,()=>{
  const values=rows();appendCriterion(values,'<p>'+plain+'</p>',plain);hold(()=>reconcile(values),'geography')
})
test('one criterion digit or an extra own schema requirement cannot be discarded',()=>{
  const values=rows();jsonBody(row(values,'native-api'),model=>{assert.ok(model.jobs[0].descriptionPlain.includes('1+ years'));model.jobs[0].descriptionPlain=model.jobs[0].descriptionPlain.replace('1+ years','20+ years')});hold(()=>reconcile(values),'criteria')
  const other=rows();jsonScript(row(other,'own-91e4b4ad'),'ld',model=>{model.qualifications='Additional qualification'});hold(()=>reconcile(other),'schema-shape')
})
test('original salary endpoints, tier summaries and commission remain independently reconciled',()=>{
  const values=rows();jsonScript(row(values,'own-625c97e4'),'ld',model=>{model.baseSalary.value.maxValue++});hold(()=>reconcile(values),'salary')
  const other=rows();jsonScript(row(other,'own-625c97e4'),'boot',model=>{assert.ok(model.posting.compensationTierSummary.includes('Offers Commission'));model.posting.compensationTierSummary=model.posting.compensationTierSummary.replace(' • Offers Commission','')});hold(()=>reconcile(other),'salary')
})
test('philosophy country, unknown markup and privacy/deadline changes remain material',()=>{
  const values=rows();jsonScript(row(values,'own-625c97e4'),'boot',model=>{model.posting.compensationPhilosophyHtml+='<p>Applicants must be based in Ind<u>ia</u>.</p>'});hold(()=>reconcile(values),'geography')
  const unknown=rows();jsonScript(row(unknown,'own-625c97e4'),'boot',model=>{model.posting.compensationPhilosophyHtml=model.posting.compensationPhilosophyHtml.replace('class="postings-link"','class="unknown"')});hold(()=>reconcile(unknown),'authored')
  for(const [key,value]of [['candidateTextingPrivacyPolicyUrl','https://foreign.example/privacy'],['applicationDeadline','2026-12-31']]){
    const other=rows();jsonScript(row(other,'own-625c97e4'),'boot',model=>{model.posting[key]=value});hold(()=>reconcile(other),'supplements')
  }
})
test('null mode and raw dates cannot acquire a new projection',()=>{
  const values=rows();jsonBody(row(values,'native-api'),model=>{model.jobs.find(value=>value.id.startsWith('22e1f989')).isRemote=true});hold(()=>reconcile(values),'mode')
  const other=rows();jsonBody(row(other,'native-api'),model=>{model.jobs[0].publishedAt='2026-02-30T12:00:00Z'});hold(()=>reconcile(other),'date')
})
for(const hidden of ['', ' hidden'])test('an additional '+(hidden?'hidden':'visible')+' corporate hiring-label channel holds',()=>{
  const values=rows(),corporate=row(values,'corporate');setText(corporate,text(corporate).replace('</body>','<a'+hidden+' href="https://new-provider.example/team">India engineering open<span>ings</span></a></body>'));hold(()=>reconcile(values),'corporate-programme')
})
