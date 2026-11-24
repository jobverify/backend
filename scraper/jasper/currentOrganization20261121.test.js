import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readJasperBoard} from './currentProgrammeData.js'
import {readCurrentJasperProgramme} from './currentProgramme.js'

globalThis.fetch=()=>assert.fail('Organization controls forbid publisher HTTP')
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const historyBytes=fs.readFileSync(new URL('../../test/fixtures/jasper-server-programme-originals-20261111.json.gz',import.meta.url))
const history=JSON.parse(gunzipSync(historyBytes))
const actual=JSON.parse(fs.readFileSync(new URL('./test-data/current-organization-20261121.json',import.meta.url)))
const packets=()=>history.responses.map(row=>({...structuredClone(row.originalReceipt),body:Buffer.from(row.bodyBase64,'base64')}))
function originalBoot(page){
 const html=page.body.toString(),match=/<script nonce="[^"]+">([\s\S]*?window\.__appData[\s\S]*?)<\/script>/.exec(html)
 assert.ok(match)
 const source=match[1],expression=parse(source,{ecmaVersion:'latest'}).body[0].expression
 return{html,source,expression,model:JSON.parse(source.slice(expression.right.start,expression.right.end))}
}
function boot(page,edit){
 const {html,source,expression,model}=originalBoot(page);edit(model)
 const body=Buffer.from(html.replace(source,source.slice(0,expression.right.start)+JSON.stringify(model)+source.slice(expression.right.end)))
 return{...page,body,bodyBytes:body.length,bodySHA256:sha(body),consumedBodyBytes:body.length,
  controlledEvidence:'Historical original packet with altered public organization projection. Not a current complete response or closing.'}
}
const currentBoard=edit=>boot(packets()[1],model=>{model.organization=structuredClone(actual.organization);edit?.(model.organization)})

test('actual public organization projection is separate from incomplete privacy-qualified current HTML',()=>{
 assert.equal(sha(historyBytes),'82af37b04e3aa043abccf0b56c5a9106dd2b167fc5eea22c5ced3a702a24bae9')
 assert.equal(actual.bodyOriginalUnmodified,false)
 assert.notEqual(actual.originalBoardBodySHA256,actual.persistedBoardBodySHA256)
 assert.equal(sha(JSON.stringify(actual.organization)),actual.organizationJSONSHA256)
 assert.match(actual.qualification,/not retained or reconstructed/)
 const old=readJasperBoard(packets()[1]).originalAppData.organization
 assert.equal(sha(JSON.stringify(old)),'5788ed424102807586a96ac1034c1c4a7251ef7092cbb314a87273da9a7a284e')
 const {activeFeatureFlags:oldFlags,...oldOther}=old,{activeFeatureFlags:newFlags,...newOther}=actual.organization
 assert.deepEqual(newOther,oldOther)
 assert.deepEqual(newFlags.filter(flag=>!oldFlags.includes(flag)),['AiInterviewer'])
 assert.deepEqual(oldFlags.filter(flag=>!newFlags.includes(flag)),['CoreMultipleBrandsFeedFiltering','CoreMultipleBrandsLinkedInJobWrappingStreamingFix'])
})

test('reviewed actual feature variant admits original-class facts without rewriting retained organization',()=>{
 const input=currentBoard(),model=readJasperBoard(input)
 assert.deepEqual(model.originalAppData.organization,actual.organization)
 assert.equal(model.originalResponse.bodySHA256,sha(input.body))
 assert.equal(model.originalResponse.bodyBase64,input.body.toString('base64'))
 assert.equal(model.lifecycleCleanupAllowed,false)
 assert.equal(model.browserExecutionQualified,false)
 assert.equal(model.applicantEligibilityQualified,false)
})

for(const [name,edit] of [
 ['foreign organization',org=>{org.organizationId='00000000-0000-4000-8000-000000000000'}],
 ['foreign employer',org=>{org.name='Other'}],
 ['foreign website',org=>{org.publicWebsite='https://other.example'}],
 ['foreign account',org=>{org.hostedJobsPageSlug='Other'}],
 ['custom external route',org=>{org.customJobsPageUrl='https://other.example/careers'}],
 ['demo account',org=>{org.isDemoOrg=true}],
 ['unindexed publication',org=>{org.allowJobPostIndexing=false}],
 ['theme filtering context',org=>{org.theme.showJobFilters=false}],
 ['theme location address',org=>{org.theme.showLocationAddress=true}],
 ['theme application context',org=>{org.theme.showAutofillApplicationsBox=false}],
 ['theme alternate back route',org=>{org.theme.jobPostingBackUrl='https://other.example/careers'}],
 ['theme authored criteria',org=>{org.theme.jobBoardTopDescriptionHtml='<p>New applicant requirements</p>'}],
 ['theme unknown field',org=>{org.theme.additionalApplicantRequirements='Unreviewed'}],
 ['privacy routing',org=>{org.recruitingPrivacyPolicyUrl='https://other.example/privacy'}],
 ['confirmation tracking',org=>{org.appConfirmationTrackingPixelHtml='<img src="https://other.example/track">'}],
 ['timezone',org=>{org.timezone='Asia/Kolkata'}],
 ['cookie context',org=>{org.showCookieBanner=true}],
 ['unknown organization field',org=>{org.newHiringCriteria='Unreviewed'}],
 ['unknown feature',org=>{org.activeFeatureFlags.push('UnreviewedApplicantEligibility')}],
 ['missing feature',org=>{org.activeFeatureFlags=org.activeFeatureFlags.filter(flag=>flag!=='JobPostingApplicationDeadlines')}],
 ['duplicate feature',org=>{org.activeFeatureFlags.push(org.activeFeatureFlags[0])}],
 ['unreviewed partial feature transition',org=>{org.activeFeatureFlags.push('CoreMultipleBrandsFeedFiltering')}],
 ['feature order change',org=>{org.activeFeatureFlags.reverse()}],
])test('reviewed feature transition retains hold on '+name,()=>{
 assert.throws(()=>readJasperBoard(currentBoard(edit)),error=>error.code==='JASPER_PROGRAMME_HOLD'&&error.reason==='native-organization')
})

test('controlled historical transaction with current organization preserves raw models and scope holds',async()=>{
 const rows=packets().map((row,i)=>i===1||i>=3?boot(row,model=>{model.organization=structuredClone(actual.organization)}):row)
 const map=new Map(rows.map(row=>[row.requestedURL,row])),calls=[]
 const result=await readCurrentJasperProgramme({readPage:async url=>{calls.push(url);const row=map.get(url);assert.ok(row);return{...structuredClone(row),body:Buffer.from(row.body)}}})
 const audit=result.nativeCollectionEvidence
 assert.equal(calls.length,20);assert.equal(audit.nativeRecords.length,7)
 assert.equal(audit.currentTransactionQualified,true)
 assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.companyGlobalScopeQualified,false)
 assert.equal(audit.sourceBodiesQualified,false);assert.equal(audit.rendererConsumptionQualified,false)
 const raw=audit.rawPages.find(row=>row.phase==='opening-B')
 assert.deepEqual(originalBoot({body:Buffer.from(raw.bodyBase64,'base64')}).model.organization,actual.organization)
})

test('closing feature transition remains a raw whole-entity hold retaining both versions',async()=>{
 const rows=packets(),map=new Map(rows.map(row=>[row.requestedURL,row])),seen=new Map()
 let failure
 try{await readCurrentJasperProgramme({readPage:async url=>{
  const n=(seen.get(url)??0)+1;seen.set(url,n);const original=map.get(url);assert.ok(original)
  const row={...structuredClone(original),body:Buffer.from(original.body)}
  return url===rows[3].requestedURL&&n===2?boot(row,model=>{model.organization=structuredClone(actual.organization)}):row
 }})}catch(error){failure=error}
 assert.equal(failure?.code,'JASPER_PROGRAMME_HOLD')
 assert.equal(failure.reason,'closing')
 const audit=failure.nativeCollectionEvidence,opening=audit.rawPages.find(row=>row.phase==='opening-O'),closing=audit.rawPages.at(-1)
 assert.equal(closing.phase,'closing-O');assert.equal(closing.requestedURL,rows[3].requestedURL)
 assert.notEqual(opening.bodySHA256,closing.bodySHA256)
 assert.equal(audit.currentTransactionQualified,false);assert.equal(audit.lifecycleCleanupAllowed,false)
})
