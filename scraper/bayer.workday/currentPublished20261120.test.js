import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readCurrentListing,qualifyCurrentRow,readCurrentRole} from './currentPublished20261120.js'

const f=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-research-20261120.json.gz',import.meta.url)))),p=name=>f.responses.find(p=>p.researchName===name),body=name=>Buffer.from(p(name).bodyBase64,'base64').toString(),listing=body('bayer-native-page2-current'),url=p('bayer-native-page2-current').url,role=body('bayer-native-category-lead-current'),at=f.observedAt
function editModel(html,operation){const d=document(html),n=d.nodes(n=>n.tag==='script'&&n.raw?.includes('window.__PRELOAD_STATE__ ='))[0],a=parse(n.raw,{ecmaVersion:'latest'}).body[0].expression,m=JSON.parse(n.raw.slice(a.right.start,a.right.end));operation(m);return html.slice(0,n.openEnd)+n.raw.slice(0,a.right.start)+JSON.stringify(m)+n.raw.slice(a.right.end)+html.slice(n.closeStart)}
function editSchema(html,operation){const d=document(html),n=d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&JSON.parse(n.raw)['@type']==='JobPosting')[0],m=JSON.parse(n.raw);operation(m);return html.slice(0,n.openEnd)+JSON.stringify(m)+html.slice(n.closeStart)}
function editTag(html,predicate,attribute,value){const d=document(html),n=d.nodes(predicate)[0];assert.ok(n,'Actual active native carrier exists');return html.slice(0,n.start)+html.slice(n.start,n.openEnd).replace(/^<[^\s>]+/,m=>m+' '+attribute+'="'+value+'"')+html.slice(n.openEnd)}
const row=()=>readCurrentListing(listing,url).rows.find(r=>r.record.requisitionID==='JR10000530')

test('Bayer genuine research retains8 original bodies including unavailable corporate403 without an acquisition claim',()=>{assert.equal(f.responses.length,8);for(const p of f.responses){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(b.length,p.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),p.sha256)}assert.equal(p('bayer-corporate-current').status,403)})
test('Bayer current visible nativeSSR and literal model bind10 current records, four typed India alternatives and native Next URL',()=>{const m=readCurrentListing(listing,url);assert.equal(m.rows.length,10);assert.equal(m.rows.filter(r=>r.record.locations.some(p=>p.country==='India')).length,4);assert.equal(m.nextURL,'https://jobs.bayer.com/page/3');assert.equal(m.observedReportedTotal,206);assert.equal(m.companyTotalClaimed,false);assert.equal(m.rendererExecuted,false)})
test('Bayer explicit native requisition/account/display brand and literal StandardApply remain distinct from legal employer and chat channel',()=>{const r=qualifyCurrentRow(row(),at);assert.equal(r.requisitionId,'JR10000530');assert.equal(r.nativeRequisitionField,'requisitionID');assert.equal(r.nativeEmployerDisplayName,'Bayer');assert.equal(r.sourceLegalEmployer,null);assert.equal(r.nativeCompanyAccount,'api.eu1.paradox.ai-BA');assert.match(r.applyUrl,/Category-Lead_JR10000530\/apply$/);assert.match(r.nativeChatApplicationURL,/job_id=JR10000530_1$/);assert.equal(r.backendApplicationActivationVerified,false)})
test('Bayer own native role typed schema/header/standard application and original microsecond date qualify explicit partial',()=>{const r=readCurrentRole(role,row(),at);assert.equal(r.country,'India');assert.equal(r.sourceDetailComplete,false);assert.equal(r.sourceLegalEmployer,null);assert.equal(r.postingDate,'2026-11-19');assert.equal(r.publications.find(v=>v.field==='JobPosting.datePosted').precision,'fraction-6-with-authored-offset');assert.match(r.jobDescription,/Position Purpose/);assert.equal(r.backendApplicationActivationVerified,false)})
for(const[label,change]of[
 ['wrong native account',m=>m.jobSearch.jobs[2].companyName='Other Company'],
 ['publishedfalse',m=>m.jobSearch.jobs[2].published=false],
 ['Draft status',m=>m.jobSearch.jobs[2].postingStatus='Draft'],
 ['internal role',m=>m.jobSearch.jobs[2].isInternal='true'],
 ['externalfalse',m=>m.jobSearch.jobs[2].customFields.find(f=>f.cfKey==='cf_is_external').value='0'],
 ['confidentialtrue',m=>m.jobSearch.jobs[2].customFields.find(f=>f.cfKey==='cf_is_confidential').value='1'],
 ['standardApplyforeign',m=>m.jobSearch.jobs[2].customFields.find(f=>f.cfKey==='cf_apply_url').value='https://other.invalid/apply/JR10000530'],
 ['primarycountryCanada',m=>m.jobSearch.jobs[2].customFields.find(f=>f.cfKey==='cf_primary_location_country').value='Canada'],
 ['wholeplaceCountryCanada',m=>m.jobSearch.jobs[2].locations[0].state='Canada'],
 ['explicit applicationaliasforeign',m=>m.jobSearch.jobs[2].application_url='https://other.invalid/apply/JR10000530'],
 ['pastdeadline',m=>m.jobSearch.jobs[2].Expires='2020-01-01'],
 ['malformedpublication',m=>m.jobSearch.jobs[2].datePosted='2026-02-30']
])test('Bayer own current published row holds a known critical native contradiction '+label,()=>{const changed=readCurrentListing(editModel(listing,change),url).rows.find(r=>r.record.requisitionID==='JR10000530');assert.throws(()=>qualifyCurrentRow(changed,at),/native|publication|Bayer/i)})
for(const[field,value]of[['data-is-published','false'],['data-is-expired','true'],['data-country','Canada'],['data-employer','Other Company']])test('Bayer current actual SSR title carrier preserves known negative '+field,()=>{const changed=editTag(listing,n=>n.tag==='a'&&n.attrs.href==='/category-lead/job/JR10000530'&&document(listing).text(n)==='Category Lead',field,value),r=readCurrentListing(changed,url).rows.find(r=>r.record.requisitionID==='JR10000530');assert.throws(()=>qualifyCurrentRow(r,at),/native|publication|Bayer/i)})
for(const[label,change]of[
 ['employer',m=>m.hiringOrganization.name='Other Company'],
 ['organizationURL',m=>m.hiringOrganization.sameAs='https://other.invalid/'],
 ['foreigncontext',m=>m['@context']='https://other.invalid/vocabulary'],
 ['foreignmainEntity',m=>m.mainEntityOfPage='https://other.invalid/job/JR10000530'],
 ['explicitapplication',m=>m.application_url='https://other.invalid/apply/JR10000530'],
 ['wholePlacename',m=>m.jobLocation[0].name='Toronto Canada'],
 ['wholeAddressRegion',m=>m.jobLocation[0].address.addressRegion='Canada'],
 ['closedcriteria',m=>m.description='This position has been filled.'],
 ['pastExpires',m=>m.Expires='2020-01-01'],
 ['malformeddate',m=>m.datePosted=1234]
])test('Bayer complete200 own-role negative cannot be treated as transient partial enrichment '+label,()=>assert.throws(()=>readCurrentRole(editSchema(role,change),row(),at),e=>e.failureKind==='parser_or_contract_error'))
test('Bayer native schema qualified full vocabulary JobPosting is equivalent without foreign context',()=>assert.equal(readCurrentRole(editSchema(role,m=>m['@type']='https://schema.org/JobPosting'),row(),at).requisitionId,'JR10000530'))
test('Bayer coherent separate Canada alternative remains valid India partial with both originals retained',()=>{const r=row(),original=structuredClone(r.record.locations[0]);r.record.locations.push({...original,country:'Canada',countryAbbr:'CA',city:'Toronto',state:'Ontario',stateAbbr:'ON',locationText:'Toronto Ontario Canada',locationParsedText:'Toronto Ontario Canada',locationName:'Toronto',cityState:'Toronto, Ontario',cityStateAbbr:'Toronto, ON',streetAddress:''});const qualified=qualifyCurrentRow(r,at);assert.equal(qualified.country,'India');assert.deepEqual(qualified.geography.countries,['India','Canada']);assert.equal(qualified.geography.originalPlaces.length,2);const details=readCurrentRole(editSchema(role,m=>m.jobLocation.push({'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'CA',addressLocality:'Toronto',addressRegion:'Ontario'}})),r,at);assert.equal(details.geography.originalPlaces.length,2)})
test('Bayer actual title/Apply/header ancestors qualify known authored availability and oldest native date',()=>{const disabled=editTag(role,n=>n.tag==='main','data-is-active','false');assert.throws(()=>readCurrentRole(disabled,row(),at),/native|publication|Bayer/i);const foreign=editTag(role,n=>n.tag==='h1','data-country','Canada');assert.throws(()=>readCurrentRole(foreign,row(),at),/native|publication|Bayer/i);const dated=editTag(role,n=>n.tag==='h1','data-date-posted','2020-01-01');assert.equal(readCurrentRole(dated,row(),at).postingDate,'2020-01-01')})
test('Bayer earliest authored dates and criteria-only revisions preserve all originals and future deadline',()=>{const changed=editSchema(role,m=>{m.description+='<p>Expires: 2026-12-01</p><p>Date Posted: 2020-01-01</p>'}),r=readCurrentRole(changed,row(),at);assert.equal(r.postingDate,'2020-01-01');assert.equal(r.closingDate,'2026-12-01');assert.ok(r.publications.some(d=>d.raw.startsWith('2026-11-19T')))})
for(const[label,change]of[
 ['inactiveassignment',h=>h.replace('window.__PRELOAD_STATE__ =','if(false)window.__PRELOAD_STATE__ =')],
 ['laterrootoverwrite',h=>h+'<script>window.__PRELOAD_STATE__={jobSearch:{jobs:[]}};</script>'],
 ['lexicalmodelalias',h=>h+'<script>const data=window.__PRELOAD_STATE__;data.jobSearch.jobs=[];</script>'],
 ['computedmodelwrite',h=>h+'<script>window["__PRELOAD_STATE__"].jobSearch.jobs=[];</script>'],
 ['windowaliaswrite',h=>h+'<script>const owner=window;owner.__PRELOAD_STATE__.jobSearch.jobs=[];</script>'],
 ['native title disconnected',h=>h.replace('>Category Lead</a>','>Other Current Title</a>')],
 ['foreign next-page URL',h=>h.replace('href="/page/3" aria-label="Next Page"','href="https://other.invalid/page/3" aria-label="Next Page"')]
])test('Bayer literal model/current visible native publication rejects disconnected original carrier '+label,()=>assert.throws(()=>readCurrentListing(change(listing),url),/native|publication|Bayer/i))

for(const[label,change]of[
 ['native current scope publishedfalse',h=>editModel(h,m=>m.jobSearch.isPublished=false)],
 ['actual current SSR owner unavailable',h=>editTag(h,n=>n.attrs['data-react-component']==='jobs-list-only','data-is-published','false')]
])test('Bayer current native publication scope guards explicit availability '+label,()=>assert.throws(()=>readCurrentListing(change(listing),url),/native|publication|Bayer/i))
for(const[label,key,value]of[['customDraft','cf_job_status','Draft'],['customExpiry','cf_valid_through','2020-01-01'],['customEmployer','cf_legal_employer','Other Company'],['customApplication','cf_application_url','https://other.invalid/apply/JR10000530']])test('Bayer recognized source-native custom metadata cannot hide a contradiction '+label,()=>{const r=row();r.record.customFields.push({cfKey:key,key,value});assert.throws(()=>qualifyCurrentRow(r,at),/native|publication|Bayer/i)})
test('Bayer genuine custom-field Boolean types retain the same affirmative public vacancy semantics',()=>{const r=row();for(const key of['cf_is_external','cf_is_external_only','cf_apply_url_present'])r.record.customFields.find(v=>v.cfKey===key).value=true;r.record.customFields.find(v=>v.cfKey==='cf_is_confidential').value=false;assert.equal(qualifyCurrentRow(r,at).requisitionId,'JR10000530')})
test('Bayer actual original inline model publication carrier must remain current',()=>{const changed=editTag(listing,n=>n.tag==='script'&&n.raw?.includes('window.__PRELOAD_STATE__ ='),'data-is-published','false');assert.throws(()=>readCurrentListing(changed,url),e=>e.failureKind==='parser_or_contract_error')})
for(const key of['workLocation','locationName','jobReqPrimaryLocation','mapQueryLocation'])test('Bayer public same-role schema primary workplace alias cannot contradict typed India '+key,()=>assert.throws(()=>readCurrentRole(editSchema(role,m=>m[key]='Toronto Canada'),row(),at),e=>e.failureKind==='parser_or_contract_error'))
test('Bayer same-role structured companion address cannot hide a foreign-only workplace',()=>assert.throws(()=>readCurrentRole(editSchema(role,m=>m.address={'@type':'PostalAddress',addressCountry:'CA',addressLocality:'Toronto'}),row(),at),e=>e.failureKind==='parser_or_contract_error'))
test('Bayer actual own JobPosting script publication carrier cannot withdraw the current model',()=>{const changed=editTag(role,n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&n.raw?.includes('"@type":"JobPosting"'),'data-is-published','false');assert.throws(()=>readCurrentRole(changed,row(),at),e=>e.failureKind==='parser_or_contract_error')})
test('Bayer actual own JobPosting carrier original earlier date qualifies and remains earliest',()=>{const changed=editTag(role,n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&n.raw?.includes('"@type":"JobPosting"'),'data-date-posted','2020-01-01');assert.equal(readCurrentRole(changed,row(),at).postingDate,'2020-01-01')})
test('Bayer unrelated footer country microdata remains outside exact owned vacancy scopes',()=>{const changed=role+'<footer><span itemprop="country">Canada</span></footer>';assert.equal(readCurrentRole(changed,row(),at).country,'India')})

test('Bayer actual native list parent publication carrier constrains its current cards',()=>assert.throws(()=>readCurrentListing(editTag(listing,n=>n.tag==='main','data-is-published','false'),url),e=>e.failureKind==='parser_or_contract_error'))

test('Bayer actual own card header parent cannot publish another employer and healthy rows remain usable',()=>{const changed=editTag(listing,n=>n.attrs['data-testid']==='jobs-list-only_jobs-list_item_header'&&document(listing).text(n).includes('Category Lead'),'data-employer','Other Company'),rows=readCurrentListing(changed,url).rows;assert.throws(()=>qualifyCurrentRow(rows.find(r=>r.record.requisitionID==='JR10000530'),at),e=>e.failureKind==='parser_or_contract_error');assert.equal(qualifyCurrentRow(rows.find(r=>r.record.requisitionID==='JR10000568'),at).country,'India')})

test('Bayer actual own card header parent date remains an original role aging carrier',()=>{const changed=editTag(listing,n=>n.attrs['data-testid']==='jobs-list-only_jobs-list_item_header'&&document(listing).text(n).includes('Category Lead'),'data-date-posted','2020-01-01');assert.equal(qualifyCurrentRow(readCurrentListing(changed,url).rows.find(r=>r.record.requisitionID==='JR10000530'),at).postingDate,'2020-01-01')})
