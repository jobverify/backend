import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {currentNavigation,readCurrentRobots,readCurrentSitemap,readCurrentListing,readCurrentRole,runCurrentNative} from './currentNative20261120.js'

const f=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-research-20261120.json.gz',import.meta.url)))),at=f.observedAt,p=n=>f.responses.find(p=>p.researchName===n),body=n=>Buffer.from(p(n).bodyBase64,'base64').toString(),home=body('thales-native-home'),listingHTML=body('thales-native-india-jobs'),role=body('thales-native-role')
const maps=()=>Array.from({length:8},(_,i)=>readCurrentSitemap(body('thales-native-map'+(i+1)),'urlset')).flatMap(m=>m.links),listing=()=>readCurrentListing(listingHTML,maps(),at),row=()=>listing().rows[0]
function edit(html,operation,kind='job'){
 const d=document(html),s=d.nodes(n=>n.tag==='script'&&!n.attrs.src&&(kind==='schema'?n.attrs.type==='application/ld+json':n.raw?.includes('phApp.ddo'))).find(n=>kind!=='schema'||JSON.parse(n.raw)['@type']==='JobPosting')
 if(kind==='schema'){const m=JSON.parse(s.raw);operation(m);return html.slice(0,s.openEnd)+JSON.stringify(m)+html.slice(s.closeStart)}
 const root=parse(s.raw,{ecmaVersion:'latest'}),queue=[root];let target
 while(queue.length){const n=queue.pop();if(!n||typeof n!=='object')continue;if(n.type==='AssignmentExpression'&&n.left.object?.name==='phApp'&&n.left.property?.name==='ddo')target=n.right;for(const v of Object.values(n))if(Array.isArray(v))queue.push(...v);else if(v&&typeof v==='object')queue.push(v)}
 assert.ok(target);const m=readLiteralModel(s.raw.slice(target.start,target.end)).value;operation(kind==='listing'?m.eagerLoadRefineSearch.data.jobs[0]:m.jobDetail.data.job);return html.slice(0,s.openEnd)+s.raw.slice(0,target.start)+JSON.stringify(m)+s.raw.slice(target.end)+html.slice(s.closeStart)
}

test('Thales current own publisher and robots-declared eight sitemaps bind the literal India landing and native role URLs',()=>{
 assert.equal(currentNavigation(home).programmesExecuted,false)
 assert.equal(readCurrentRobots(body('thales-native-robots')),p('thales-native-sitemap').url)
 assert.equal(readCurrentSitemap(body('thales-native-sitemap'),'sitemapindex').links.length,8)
 const rows=listing();assert.equal(rows.rows.length,10);assert.equal(rows.rows[0].url,p('thales-native-role').url);assert.equal(rows.observedReportedTotal,63);assert.equal(rows.companyTotalClaimed,false)
})
test('Thales explicit own Open role keeps native July and public October dates without inventing first publication or legal entity',()=>{
 const j=readCurrentRole(role,row(),at);assert.equal(j.country,'India');assert.equal(j.requisitionId,'R0323785');assert.equal(j.nativeEmployerDisplayName,'Thales');assert.equal(j.sourceNativeLegalEmployerLabel,'Thales India Private Limited');assert.equal(j.sourceLegalEmployer,null);assert.equal(j.postingDate,'2026-07-21');assert.equal(j.sourceNativePublicationDateAmbiguous,true);assert.ok(j.sourceNativePublicationDates.some(v=>v.raw==='2026-10-22'));assert.equal(j.sourceDetailComplete,false);assert.equal(j.backendApplicationActivationVerified,false);assert.equal(j.lifecycleCleanupAllowed,false);assert.match(j.applyUrl,/_R0323785-1\/apply$/)
})
for(const [field,value]of[['companyName','Other Employer'],['country','Canada'],['jobStatus','Draft'],['Job Status','Draft'],['postingStatus','Closed'],['published',false],['active',false],['displayCareerSite',false],['displayCarerrSite',false],['isTest',true],['postedDate','2027-02-30'],['validThrough','2020-01-01'],['description','<p>This position has been filled.</p>'],['description','<p>Expires: 2020-01-01</p>'],['applyUrl','https://other.invalid/apply/R0323785']])test('Thales actual current native contradiction holds '+field,()=>{
 assert.throws(()=>readCurrentRole(edit(role,m=>m[field]=value),row(),at),/native|publication|employer|country|date|expiry|expired|calendar|closed|filled|application|test|status/i)
})
for(const [field,value]of[['@context','https://other.invalid/vocabulary'],['hiringOrganization',{'@type':'Organization',name:'Other Employer'}],['mainEntityOfPage','https://other.invalid/job/R0323785'],['published',false],['datePosted',0],['description','<p>Job Status: Draft</p>'],['applyUrl','https://other.invalid/apply/R0323785']])test('Thales public scoped JobPosting cannot borrow a valid companion model '+field,()=>{
 assert.throws(()=>readCurrentRole(edit(role,m=>m[field]=value,'schema'),row(),at),/native|schema|context|publisher|identity|publication|employer|date|application|status/i)
})
test('Thales one whole typed workplace cannot hide a foreign country while independent foreign alternatives remain valid',()=>{
 assert.throws(()=>readCurrentRole(edit(role,m=>m.jobLocation.address.addressRegion='Canada','schema'),row(),at),/country|workplace/i)
 const j=readCurrentRole(edit(role,m=>m.jobLocation=[m.jobLocation,{'@type':'Place',name:'Toronto Canada',address:{'@type':'PostalAddress',addressCountry:'Canada',addressLocality:'Toronto',addressRegion:'Ontario'}}],'schema'),row(),at);assert.equal(j.country,'India');assert.equal(j.sourceNativeGeography.originalPlaces.length,2)
})
test('Thales compatible schema vocabulary retains actual same-R identity and future Expires deadline',()=>{
 const html=edit(edit(role,m=>{m['@type']='https://schema.org/JobPosting';m['@context']='https://schema.org/';m.mainEntityOfPage={'@id':row().url}},'schema'),m=>m.description+='<p>Expires: 2026-12-01</p>'),j=readCurrentRole(html,row(),at);assert.equal(j.closingDate,'2026-12-01');assert.ok(j.sourceNativeExpiryDates.length)
})
for(const suffix of ['<script>phApp.baseUrl="https://other.invalid/"</script>','<script>if(false){phApp.baseUrl="https://careers.thalesgroup.com/global/en/"}</script>','<script>const escaped=phApp;escaped.refNum="OTHER"</script>'])test('Thales repeated own literal scalar writes never authorize a changed or disconnected publisher context '+suffix.slice(0,35),()=>{
 assert.throws(()=>readCurrentListing(listingHTML.replace('</head>',suffix+'</head>'),maps(),at),/native|publisher|context|alias|mutation/i)
})
for(const [field,value]of[['country','Canada'],['locale','en_CA']])test('Thales later publisher field cannot replace the qualified current original '+field,()=>{
 const changed=listingHTML.replace('</head>','<script>phApp.'+field+'='+JSON.stringify(value)+'</script></head>');assert.throws(()=>readCurrentListing(changed,maps(),at),/native|publisher|context|mutation/i)
})
test('Thales custom page labels remain unqualified renderer metadata rather than a new vacancy scope',()=>{
 const q=readCurrentListing(listingHTML,maps(),at);assert.ok(q.originalUnqualifiedPageLabels.some(v=>v.value==='India - Benefits campaign'));assert.equal(q.rows.length,10);assert.equal(q.companyTotalClaimed,false)
})
test('Thales closing row country and known negative publication remain role-specific constraints',()=>{
 for(const [field,value]of[['country','Canada'],['published',false],['Job Status','Draft']])assert.throws(()=>readCurrentRole(role,readCurrentListing(edit(listingHTML,m=>m[field]=value,'listing'),maps(),at).rows[0],at),/native|country|publication|status/i)
})
test('Thales caller cancellation and zero cap issue no public requests and no company-zero assertion',async()=>{
 const c=new AbortController(),reason={opaque:'caller'};c.abort(reason);await assert.rejects(runCurrentNative({signal:c.signal}),e=>e===reason);let requests=0;const jobs=await runCurrentNative({maxJobs:0,fetchImpl:async()=>{requests++;throw Error('unread')}});assert.equal(requests,0);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
})

for(const field of['workLocation','locationName','jobReqPrimaryLocation','mapQueryLocation'])test('Thales authored primary workplace alias cannot contradict typed India '+field,()=>{assert.throws(()=>readCurrentRole(edit(role,m=>m[field]='Toronto Canada'),row(),at),/country|workplace/i)})
for(const kind of['job','schema'])test('Thales explicit snake-case same-role application alias must bind own current application '+kind,()=>{assert.throws(()=>readCurrentRole(edit(role,m=>m.application_url='https://other.invalid/apply/R0323785',kind),row(),at),/application|identity|native/i)})
test('Thales unsuperseded native row deletion cannot borrow an active role model',()=>{const r=row();r.record.jobDeletedOnDate='2026-11-01';assert.throws(()=>readCurrentRole(role,r,at),/delet|reopen|publication|native/i)})
test('Thales original native row deletion and later reopening are retained separately from original posting date',()=>{const r=row();r.record.jobDeletedOnDate='2026-11-01';r.record.jobReopenedOnDate='2026-11-02';const j=readCurrentRole(role,r,at);assert.equal(j.postingDate,'2026-07-21');assert.equal(j.sourceNativeListingPublicationEvents.deleted[0].calendar,'2026-11-01');assert.equal(j.sourceNativeListingPublicationEvents.reopened[0].calendar,'2026-11-02')})

export {edit}
