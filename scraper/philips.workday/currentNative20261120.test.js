import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {currentNavigation,readCurrentSitemap,readCurrentListing,readCurrentRole,runCurrentNative} from './currentNative20261120.js'

const f=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-research-20261120.json.gz',import.meta.url)))),at=f.observedAt,p=n=>f.responses.find(p=>p.researchName===n),text=n=>Buffer.from(p(n).bodyBase64,'base64').toString(),home=text('philips-native-home'),index=text('philips-native-search'),role=text('philips-native-role'),maps=()=>readCurrentSitemap(text('philips-native-sitemap'),'urlset').links,row=()=>readCurrentListing(index,maps(),at).rows[0]
function edit(html,operation,kind='job'){
 const d=document(html),s=d.nodes(n=>n.tag==='script'&&!n.attrs.src&&(kind==='schema'?n.attrs.type==='application/ld+json':n.raw?.includes('phApp.ddo'))).find(n=>kind!=='schema'||JSON.parse(n.raw)['@type']==='JobPosting')
 if(kind==='schema'){const m=JSON.parse(s.raw);operation(m);return html.slice(0,s.openEnd)+JSON.stringify(m)+html.slice(s.closeStart)}
 const root=parse(s.raw,{ecmaVersion:'latest'}),queue=[root];let target
 while(queue.length){const n=queue.pop();if(!n||typeof n!=='object')continue;if(n.type==='AssignmentExpression'&&n.left.object?.name==='phApp'&&n.left.property?.name==='ddo')target=n.right;for(const v of Object.values(n))if(Array.isArray(v))queue.push(...v);else if(v&&typeof v==='object')queue.push(v)}
 assert.ok(target);const m=readLiteralModel(s.raw.slice(target.start,target.end)).value;operation(kind==='listing'?m.eagerLoadRefineSearch.data.jobs[0]:m.jobDetail.data.job);return html.slice(0,s.openEnd)+s.raw.slice(0,target.start)+JSON.stringify(m)+s.raw.slice(target.end)+html.slice(s.closeStart)
}

test('Philips own India publisher declares current GET search and self-published XML supplies literal same-job URLs',()=>{
 const n=currentNavigation(home);assert.equal(n.url,p('philips-native-search').url);assert.equal(n.programmesExecuted,false);const q=readCurrentListing(index,maps(),at);assert.equal(q.rows.length,10);assert.equal(q.rows[0].url,p('philips-native-role').url);assert.equal(q.observedReportedTotal,78);assert.equal(q.companyTotalClaimed,false)
})
test('Philips active current own-brand native professional channel and JobPosting retain actual India and same-ID application',()=>{
 const j=readCurrentRole(role,row(),at);assert.equal(j.requisitionId,'584565');assert.equal(j.country,'India');assert.equal(j.nativeEmployerDisplayName,'Philips');assert.equal(j.sourceLegalEmployer,null);assert.equal(j.sourceDetailComplete,false);assert.equal(j.backendApplicationActivationVerified,false);assert.equal(j.lifecycleCleanupAllowed,false);assert.equal(j.sourceNativeRecord.active,true);assert.equal(j.sourceNativeRecord.siteType,'professional');assert.equal(j.sourceNativeUnqualifiedFields.test,'LOCATION-3-1879');assert.equal(j.sourceNativeUnqualifiedFields.typeValue,"['Part time']");assert.equal(j.sourceEmploymentTypeAmbiguous,true);assert.equal(j.postingDate,'2026-08-07');assert.ok(j.sourceNativePublicationDates.some(d=>d.raw==='2026-08-19'));assert.equal(j.sourceNativePublicationDateAmbiguous,true);assert.match(j.applyUrl,/_584565\/apply\?source=Philips_Career_Site$/)
})
for(const[field,value]of[['companyName','Other Employer'],['companyValue','Other Employer'],['country','Canada'],['jobStatus','Draft'],['Job Status','Draft'],['published',false],['active',false],['displayCareerSite',false],['siteType','internal'],['isTest',true],['test',true],['jobConfidentialStatus','1'],['postedDate',0],['validThrough','2020-01-01'],['description','<p>This position has been filled.</p>'],['description','<p>Expires: 2020-01-01</p>'],['applyUrl','https://other.invalid/apply/584565'],['payType','https://philips.wd3.myworkdayjobs.com/jobs-and-careers/job/Other/Other_999999']])test('Philips current native contradiction holds '+field,()=>{
 assert.throws(()=>readCurrentRole(edit(role,m=>m[field]=value),row(),at),/native|publication|employer|country|status|date|expiry|expired|calendar|closed|filled|application|test|confidential|identity/i)
})
for(const[field,value]of[['@context','https://other.invalid/vocabulary'],['hiringOrganization',{'@type':'Organization',name:'Other Employer'}],['mainEntityOfPage','https://other.invalid/job/584565'],['published',false],['datePosted',0],['description','<p>Job Status: Draft</p>'],['applyUrl','https://other.invalid/apply/584565']])test('Philips public JobPosting cannot borrow an independently valid native companion '+field,()=>{
 assert.throws(()=>readCurrentRole(edit(role,m=>m[field]=value,'schema'),row(),at),/native|schema|context|publisher|identity|publication|employer|date|application|status/i)
})
test('Philips whole-country constraints retain separate legitimate foreign alternatives and reject a conflicting own typed place',()=>{
 assert.throws(()=>readCurrentRole(edit(role,m=>m.jobLocation.address.addressRegion='Canada','schema'),row(),at),/country|workplace/i);assert.throws(()=>readCurrentRole(edit(role,m=>m.jobLocation.name='Toronto Canada','schema'),row(),at),/country|workplace/i)
 const j=readCurrentRole(edit(role,m=>m.jobLocation=[m.jobLocation,{'@type':'Place',name:'Toronto Canada',address:{'@type':'PostalAddress',addressCountry:'Canada',addressLocality:'Toronto',addressRegion:'Ontario'}}],'schema'),row(),at);assert.equal(j.country,'India');assert.equal(j.sourceNativeGeography.originalPlaces.length,2)
})
test('Philips compatible schema vocabulary retains current same-role identity and earliest authored expiry',()=>{
 const j=readCurrentRole(edit(edit(role,m=>{m['@type']='https://schema.org/JobPosting';m['@context']='https://schema.org/';m.mainEntityOfPage={'@id':row().url}},'schema'),m=>m.description+='<p>Expires: 2026-12-01</p>'),row(),at);assert.equal(j.closingDate,'2026-12-01')
})
for(const[field,value]of[['baseUrl','https://other.invalid/'],['country','Canada'],['locale','en_CA'],['refNum','OTHER']])test('Philips current qualified publisher scalar cannot be disconnected by later '+field,()=>{
 const changed=index.replace('</head>','<script>phApp.'+field+'='+JSON.stringify(value)+'</script></head>');assert.throws(()=>readCurrentListing(changed,maps(),at),/native|publisher|context|mutation/i)
})
test('Philips native model alias escape cannot publish an earlier unrelated original',()=>{assert.throws(()=>readCurrentListing(index.replace('</head>','<script>const escaped=phApp;escaped.ddo={}</script></head>'),maps(),at),/native|alias|mutation/i)})
test('Philips native row negative availability and foreign country remain scoped constraints before role enrichment',()=>{
 for(const[field,value]of[['country','Canada'],['active',false],['Job Status','Draft']])assert.throws(()=>readCurrentRole(role,readCurrentListing(edit(index,m=>m[field]=value,'listing'),maps(),at).rows[0],at),/native|country|publication|status/i)
})
test('Philips public job URLs are literal current XML identities, not derived title slugs',()=>{const r=readCurrentListing(index,maps().filter(u=>u!==p('philips-native-role').url),at).rows[0];assert.equal(r.url,null);assert.throws(()=>readCurrentRole(role,r,at),/literal|sitemap|URL/i)})
test('Philips no-cap and opaque cancellation issue no public requests or company-zero assertion',async()=>{
 const c=new AbortController(),reason={opaque:'caller'};c.abort(reason);await assert.rejects(runCurrentNative({signal:c.signal}),e=>e===reason);let reads=0;const jobs=await runCurrentNative({maxJobs:0,fetchImpl:async()=>{reads++;throw Error('unread')}});assert.equal(reads,0);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
})
for(const field of['workLocation','locationName','jobReqPrimaryLocation','mapQueryLocation'])test('Philips authored primary workplace alias cannot contradict typed India '+field,()=>{assert.throws(()=>readCurrentRole(edit(role,m=>m[field]='Toronto Canada'),row(),at),/country|workplace/i)})
for(const kind of['job','schema'])test('Philips explicit snake-case same-role application alias must bind own current application '+kind,()=>{assert.throws(()=>readCurrentRole(edit(role,m=>m.application_url='https://other.invalid/apply/584565',kind),row(),at),/application|identity|native/i)})
test('Philips unsuperseded native row deletion cannot borrow an active role model',()=>{const r=row();r.record.jobDeletedOnDate='2026-11-01';assert.throws(()=>readCurrentRole(role,r,at),/delet|reopen|publication|native/i)})
test('Philips original row deletion and later reopening do not replace original posted dates',()=>{const r=row();r.record.jobDeletedOnDate='2026-11-01';r.record.jobReopenedOnDate='2026-11-02';const j=readCurrentRole(role,r,at);assert.equal(j.postingDate,'2026-08-07');assert.equal(j.sourceNativeListingPublicationEvents.deleted[0].calendar,'2026-11-01');assert.equal(j.sourceNativeListingPublicationEvents.reopened[0].calendar,'2026-11-02')})
test('Philips actual native text workplace carrier cannot contradict typed India',()=>{assert.throws(()=>readCurrentRole(edit(role,m=>m.text='Toronto Canada'),row(),at),/country|workplace/i)})
