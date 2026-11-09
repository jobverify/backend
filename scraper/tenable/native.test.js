import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {transport} from './native.fixture.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
test('current Tenable registered producer certifies vacancy scope through intact native records and explicit non-vacancy prospects',async t=>{const fetchImpl=transport();t.mock.method(globalThis,'fetch',fetchImpl);let audit;const jobs=await run({fetchImpl,onAudit:value=>audit=value});assert.equal(jobs.length,0);const e=readInventoryEvidence(jobs);assert.equal(e?.listingComplete,true);assert.equal(e.indiaFacetCount,0);assert.equal(audit.nativeRecordCount,36);assert.equal(audit.vacancyCount,33);assert.deepEqual(audit.prospectIds,['4019356008','4019516008','4805413008']);assert.equal(audit.details.length,36);assert.equal(audit.officeCountryProofs.length,33);assert.equal(audit.rawCountryValuesPreserved,true)})
import {createHash} from 'node:crypto'
import config from './currentConfig.json' with {type:'json'}
import {fixture} from './native.fixture.js'

async function check(t,change,recording=fixture){const fetchImpl=transport(change,recording);t.mock.method(globalThis,'fetch',fetchImpl);let audit;const jobs=await run({fetchImpl,onAudit:value=>audit=value});return {jobs,audit,evidence:readInventoryEvidence(jobs)}}
function editJson(row,fn){if(!row.contentType?.includes('json'))return;const data=JSON.parse(row.body);fn(data);row.body=JSON.stringify(data)}
function visit(value,fn){if(!value||typeof value!=='object')return;for(const child of Object.values(value))if(child&&typeof child==='object')visit(child,fn);fn(value)}
const target=5455233008
function editRole(row,fn){editJson(row,data=>visit(data,value=>{if(value.id===target&&value.company_name==='Tenable, Inc.')fn(value);if(value._raw?.id===target){value.title=value._raw.title;value.url=value._raw.absolute_url;value.content=value._raw.content;if(value.location&&Object.hasOwn(value.location,'value'))value.location.value=[value._raw.location.name]}}))}

test('receipts identify exact raw response bytes',async t=>{const {audit}=await check(t);const receipt=audit.receipts[0],raw=Buffer.from(fixture.responses['GET '+receipt.url].bodyBase64,'base64');assert.equal(receipt.sha256,createHash('sha256').update(raw).digest('hex'))})

test('an unreviewed native job ID returns incomplete inventory without throwing', async t => {
  const unseenId = '9999999999'
  const detailUrl = `https://boards-api.greenhouse.io/v1/boards/tenableinc/jobs/${target}?content=true`
  const unseenDetailUrl = detailUrl.replace(String(target), unseenId)
  const recording = {
    ...fixture,
    responses: {
      ...fixture.responses,
      ['GET ' + unseenDetailUrl]: {
        ...fixture.responses['GET ' + detailUrl],
        url: unseenDetailUrl,
        finalUrl: unseenDetailUrl,
      },
    },
  }
  const { evidence, audit } = await check(t, row => {
    if (row.contentType?.includes('json')) row.body = row.body.replaceAll(String(target), unseenId)
  }, recording)

  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.ok(audit.reasons.includes('unreviewed-native-role-schema-or-criteria:' + unseenId))
  assert.ok(audit.details.some(detail => detail.id === unseenId))
  assert.ok(audit.closingDetails.some(detail => detail.id === unseenId))
})

for(const [name,change]of [
 ['unknown mandatory role field',(row)=>editRole(row,r=>r.mandatoryLicense='A professional license is mandatory')],
 
 
 ['country alternatives',(row)=>editRole(row,r=>{const m=r.metadata?.find(m=>m.name==='Country (For Website Only)');if(m)m.value=['Korea, Republic of','India']})],
 ['broad global role label',(row)=>editRole(row,r=>{if(r.location)r.location.name='Worldwide'})],
 ['contradictory explicit country role label',(row)=>editRole(row,r=>{if(r.location)r.location.name='India - Remote'})],
 ['hidden native criteria',(row)=>editRole(row,r=>{if(typeof r.content==='string')r.content+='<div hidden>A mandatory professional license is required.</div>'})],
 ['unknown current office field',(row,url)=>{if(url===config.officeUrl)editJson(row,d=>d.offices[0].mandatoryLicense='Required')}],
 ['unreviewed empty office branch',(row,url)=>{if(url===config.officeUrl)editJson(row,d=>d.offices.push({...d.offices.find(o=>o.id===0),id:9999999999,name:'Unreviewed branch'}))}],
 ['new corporate hiring channel',(row,url)=>{if(url===config.officialUrl)row.body=row.body.replace('</body>','<a href="https://jobs.ashbyhq.com/other">Additional vacancies</a></body>')}],
 ['corporate inline CSS criteria',(row,url)=>{if(url===config.officialUrl)row.body=row.body.replace('</style>','body::after{content:"Additional vacancies https://jobs.ashbyhq.com/other"}</style>')}],
 ['nonrenderer declared script drift',(row,url)=>{if(url===config.declaredPrograms[0].url)row.body+='\n/* changed program */'}],
 ['closed advertised native status not absence',(row,url)=>{if(url.includes('/jobs/4019523008?')){row.status=200;row.body='{"status":404,"error":"Job not found"}'}}],
 ])test(name+' keeps scope partial',async t=>{const {evidence,audit}=await check(t,change);assert.equal(evidence.listingComplete,false);assert.equal(evidence.indiaFacetCount,null);assert.equal(audit.lifecycleCleanupAllowed,false);assert.ok(audit.reasons.length)})

for(const [name,change,error]of [
 ['unknown nested location shape',(row)=>editRole(row,r=>{if(r.location)r.location.name={mandatoryLicense:'Required'}}),/malformed native locations/],
 ['country value schema',(row)=>editRole(row,r=>{const m=r.metadata?.find(m=>m.name==='Country (For Website Only)');if(m)m.value={mandatoryLicense:'Required'}}),/malformed native locations/],
 ['office cycle',(row,url)=>{if(url===config.officeUrl)editJson(row,d=>{const o=d.offices.find(o=>o.id===4001862008);o.parent_id=o.id;o.child_ids.push(o.id)})},/cycle/],
 ['office parent nonreciprocal',(row,url)=>{if(url===config.officeUrl)editJson(row,d=>{const o=d.offices.find(o=>o.id===4001862008);o.child_ids=o.child_ids.filter(id=>id!==4001863008)})},/nonreciprocal/],
 ['conflicting office definitions',(row,url)=>{if(url===config.officeUrl)editJson(row,d=>d.offices.push(d.offices.find(o=>o.id===4001862008)))},/duplicate office/],
 ['firstparty raw conflict',(row,url)=>{if(url===config.firstPartyApiUrl)editJson(row,d=>d.jobs[0]._raw.title+=' changed')},/raw identity/],
 ['closing criteria drift',(row,url,n)=>{if(url===config.apiUrl&&n===2)editJson(row,d=>d.jobs[0].content+=' Required license')},/changed during closing/],
 ['closing detail criteria drift',(row,url,n)=>{if(url.includes('/jobs/'+target+'?')&&n===2)editJson(row,d=>d.content+=' Required license')},/detail identity, criteria or metadata drift/],
 ['wrong native terminal payload',(row,url)=>{if(url.includes('/jobs/4019523008?'))row.body='{"status":404,"error":"Different error","mandatoryLicense":"Required"}'},null],
 ['wrong advertised terminal redirect',(row,url)=>{if(url==='https://job-boards.greenhouse.io/tenableinc/jobs/4019523008')row.redirectLocation='https://other.example/'},/terminal state changed/],
 ['renderer unfiltered endpoint changed',(row,url)=>{if(url===config.rendererUrl)row.body=row.body.replace('/evaluations/api/v1/jobs','/evaluations/api/v1/jobs?country=IN')},/renderer/],
 ['renderer country pair changed',(row,url)=>{if(url===config.rendererUrl)row.body=row.body.replaceAll('Korea, Republic of','Another country')},/country-name\/code pair/],
 ['inactive renderer',(row,url)=>{if(url===config.searchUrl)row.body=row.body.replace('src="'+config.rendererUrl+'"','type="text/plain" src="'+config.rendererUrl+'"')},/production custom element and script/],
 ])test(name+' cannot produce complete inventory',async t=>{if(error)await assert.rejects(()=>check(t,change),error);else{const {evidence}=await check(t,change);assert.equal(evidence.listingComplete,false)}})

test('body-only transport and inventory caps reject before HTTP',async()=>{for(const options of [{fetchPage:()=>{}},{fetchText:()=>{}},{fetchJson:()=>{}},{maxJobs:1},{maxPages:1}])await assert.rejects(()=>run({...options,fetchImpl:()=>{assert.fail('unexpected HTTP')}}),/unsupported/)})
test('new unlabeled worksite does not inherit an office country proof',async t=>{const {evidence}=await check(t,(row)=>editRole(row,r=>{if(r.location)r.location.name='Unreviewed worksite'}));assert.equal(evidence.listingComplete,false)})
test('new explicit description country alternative cannot certify zero India',async t=>{const {evidence}=await check(t,row=>editRole(row,r=>{if(typeof r.content==='string')r.content+='<p>Additional work location: India</p>'}));assert.equal(evidence.listingComplete,false)})
test('firstparty publisher country projection cannot contradict native country',async t=>{const {evidence}=await check(t,(row,url)=>{if(url===config.firstPartyApiUrl)editJson(row,d=>d.jobs.find(r=>r.id===target).country.value=['India'])});assert.equal(evidence.listingComplete,false)})
test('firstparty filter field contract remains reviewed',async t=>{const {evidence}=await check(t,(row,url)=>{if(url===config.firstPartyApiUrl)editJson(row,d=>d.filterFields.push('additionalMandatoryCountry'))});assert.equal(evidence.listingComplete,false)})
test('inert document MIME cannot establish active publisher ownership',async t=>{await assert.rejects(()=>check(t,(row,url)=>{if(url===config.searchUrl)row.contentType='text/plain'}),/content type/)})
test('nonJSON native MIME cannot establish native inventory',async t=>{await assert.rejects(()=>check(t,(row,url)=>{if(url===config.apiUrl)row.contentType='text/html'}),/content type/)})
test('advertised closed role must still be unavailable at closing',async t=>{const {evidence}=await check(t,(row,url,n)=>{if(url.includes('/jobs/4019523008?')&&n===2)row.status=200});assert.equal(evidence.listingComplete,false)})
import {createTenableScraper} from './script.js'
test('factory uses the same strict native transport contract',async()=>{await assert.rejects(()=>createTenableScraper().run({fetchText:async()=>'<html/>',fetchJson:async()=>({jobs:[]})}),/body-only transport is unsupported/);await assert.rejects(()=>createTenableScraper({maxJobs:1}).run({fetchImpl:()=>assert.fail('unexpected HTTP')}),/caps are unsupported/)})
for(const [name,modify]of [['invalid native employment ID',r=>r.internal_job_id=0],['impossible native publication date',r=>r.first_published='2026-09-31T00:00:00Z']])test(name+' cannot complete inventory',async t=>{await assert.rejects(()=>check(t,row=>editRole(row,modify)),/native employment identity|native date/)})
const beaconUrl='https://static.cloudflareinsights.com/beacon.min.js/vce701823e78c4301a35b7e07294d87301792088814092'
for(const[name,change]of[
 ['beacon program',(row,url)=>{if(url===beaconUrl)row.body+='\nwindow.additionalHiringChannel="https://jobs.ashbyhq.com/other";'}],
 ['beacon MIME',(row,url)=>{if(url===beaconUrl)row.contentType='text/plain'}],
 ['beacon integrity',(row,url)=>{if(url===config.officialUrl)row.body=row.body.replace('integrity="sha512-UKNk','integrity="sha512-INVALID-UKNk')}],
 ['beacon attributes',(row,url)=>{if(url===config.searchUrl)row.body=row.body.replace('data-cf-beacon=', 'data-unreviewed-hiring="https://jobs.ashbyhq.com/other" data-cf-beacon=')}],
 ['beacon config',(row,url)=>{if(url===config.searchUrl)row.body=row.body.replace('&quot;spa&quot;:2','&quot;spa&quot;:1').replace('"spa":2','"spa":1')}],
 ['second additional program',(row,url)=>{if(url===config.searchUrl)row.body=row.body.replace('</body>','<script src="https://unknown.example/hiring.js"></script></body>')}],
 ])test(name+' drift remains partial',async t=>{const {evidence,audit}=await check(t,change);assert.equal(evidence.listingComplete,false);assert.equal(evidence.indiaFacetCount,null);assert.equal(audit.lifecycleCleanupAllowed,false)})
for(const[name,change]of[
 ['beacon removed',(row,url)=>{if(url===config.officialUrl)row.body=row.body.replace(/<script\b[^>]*src=["']https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js\/vce701823e78c4301a35b7e07294d87301792088814092["'][^>]*>[\s\S]*?<\/script>/,'')}],
 ['beacon URL changed',(row,url)=>{if(url===config.searchUrl)row.body=row.body.replace(beaconUrl,beaconUrl+'changed')}],
 ['beacon closing program',(row,url,n)=>{if(url===beaconUrl&&n===2)row.body+='\nwindow.hiringChanged=true;'}],
 ])test(name+' cannot silently enter a reviewed cohort',async t=>{const{evidence}=await check(t,change);assert.equal(evidence.listingComplete,false);assert.equal(evidence.indiaFacetCount,null)})
test('all current vacancy country proofs use canonical publisher country codes',async t=>{const {audit}=await check(t);const expected={'United States of America':'US',Thailand:'TH',Canada:'CA',Japan:'JP',Australia:'AU',Singapore:'SG','United Kingdom':'GB',Israel:'IL','Korea, Republic of':'KR',France:'FR'};for(const proof of audit.officeCountryProofs){assert.deepEqual(proof.countries,proof.rawCountryLabels.map(label=>expected[label]),'Canonical native country '+proof.rawCountryLabels);for(const office of proof.offices)assert.equal(office.country,expected[proof.rawCountryLabels[0]])}assert.equal(audit.officeCountryProofs.some(proof=>proof.rawCountryLabels.includes('France')),true)})
for(const[name,markup]of[
 ['hidden executable script','<script hidden src="https://unknown.example/hiring.js"></script>'],
 ['hidden-ancestor executable script','<section aria-hidden="true"><script src="https://unknown.example/hiring.js"></script></section>'],
 ['hidden client JSON data script','<script hidden type="application/json" id="additional-hiring-config">{"jobs":"https://jobs.ashbyhq.com/other"}</script>'],
 ])test(name+' is part of the entire publisher executable/data surface',async t=>{const {evidence}=await check(t,(row,url)=>{if(url===config.searchUrl)row.body=row.body.replace('</body>',markup+'</body>')});assert.equal(evidence.listingComplete,false)})
for(const[name,markup]of[
 ['hidden iframe delegation','<iframe hidden src="https://jobs.ashbyhq.com/other"></iframe>'],
 ['hidden object delegation','<object hidden data="https://jobs.ashbyhq.com/other"></object>'],
 ['hidden embed delegation','<embed hidden src="https://jobs.ashbyhq.com/other">'],
 ['hidden form configuration','<form hidden action="https://jobs.ashbyhq.com/other"><input name="mandatoryLicense" value="Required"></form>'],
 ['hidden raw noscript content','<noscript hidden><iframe src="https://jobs.ashbyhq.com/other"></iframe></noscript>'],
 ])test(name+' belongs to entire raw publisher DOM scope',async t=>{const {evidence}=await check(t,(row,url)=>{if(url===config.searchUrl)row.body=row.body.replace('</body>',markup+'</body>')});assert.equal(evidence.listingComplete,false)})
const encodeEmail=(email,key=37)=>Buffer.from([key,...Buffer.from(email,'utf8').map(byte=>byte^key)]).toString('hex')
for(const[name,modify]of[
 ['changed decoded email',html=>html.replace(/(\/cdn-cgi\/l\/email-protection#)[0-9a-f]+/,(_,prefix)=>prefix+encodeEmail('SLCGX@tenable.com'))],
 ['malformed encoded email',html=>html.replace(/(data-cfemail=["'])[0-9a-f]+/,(_,prefix)=>prefix+'zz')],
 ['extra encoded email field',html=>html.replace('</body>','<span hidden data-cfemail="'+encodeEmail('SLCGP@tenable.com')+'">contact</span></body>')],
 ['encoded email path changed',html=>html.replace(/(<span class="__cf_email__")/,' <b></b>$1')],
 ['encoded email additional attribute',html=>html.replace('class="__cf_email__"','class="__cf_email__" data-hiring="changed"')],
 ])test(name+' is never a generic email exemption',async t=>{const{evidence}=await check(t,(row,url)=>{if(url===config.officialUrl)row.body=modify(row.body)});assert.equal(evidence.listingComplete,false);assert.equal(evidence.indiaFacetCount,null)})
test('exact two independently encoded email fields preserve raw bytes and stable entire DOM proof',async t=>{const{audit,evidence}=await check(t);assert.equal(evidence.listingComplete,true);for(const phase of[audit.openingEmployer,audit.closingEmployer])for(const surface of phase.wholeDomSurfaces){assert.equal(surface.normalizations.length,2);assert.deepEqual(surface.reasons,[]);for(const proof of surface.normalizations){assert.equal(proof.decodedEmail,'SLCGP@tenable.com');assert.match(proof.rawEncodedAttribute,/^[a-z0-9/#.-]+$/i);assert.notEqual(proof.rawEncodedAttribute,proof.signatureValue)}}for(let i=0;i<2;i++)assert.equal(audit.openingEmployer.wholeDomSurfaces[i].sha256,audit.closingEmployer.wholeDomSurfaces[i].sha256)})
test('hidden event handler belongs to full raw DOM proof',async t=>{const{evidence}=await check(t,(row,url)=>{if(url===config.searchUrl)row.body=row.body.replace('</body>','<img hidden src="missing-image" onerror="window.additionalJobs=1"></body>')});assert.equal(evidence.listingComplete,false)})
const decoderUrl=config.emailProjectionPolicy.decoder.url
for(const[name,change]of[
 ['decoder program',(row,url)=>{if(url===decoderUrl)row.body+='\nwindow.changedDecoder=true;'}],
 ['decoder MIME',(row,url)=>{if(url===decoderUrl)row.contentType='text/plain'}],
 ['decoder activation type',(row,url)=>{if(url===config.officialUrl)row.body=row.body.replace('src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"','type="text/plain" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"')}],
 ['email ancestor context',(row,url)=>{if(url===config.officialUrl)row.body=row.body.replace('id="slcgp-form-wrapper"','id="changed-slcgp-form-wrapper"')}],
 ['hidden raw text',(row,url)=>{if(url===config.officialUrl)row.body=row.body.replace('[email&#160;protected]','A mandatory professional license is required')}],
 ['same-address unknown prefix',(row,url)=>{if(url===config.officialUrl)row.body=row.body.replace('/cdn-cgi/l/email-protection#','https://www.tenable.com/cdn-cgi/l/email-protection#')}],
 ['invalid UTF8 email',(row,url)=>{if(url===config.officialUrl){const bytes=Buffer.from('SLCGP@tenable.com');bytes[0]=255;const hex=Buffer.from([37,...bytes.map(b=>b^37)]).toString('hex');row.body=row.body.replace(/(\/cdn-cgi\/l\/email-protection#)[0-9a-f]+/,(_,prefix)=>prefix+hex)}}],
 ])test(name+' cannot qualify an email identity projection',async t=>{const{evidence}=await check(t,change);assert.equal(evidence.listingComplete,false);assert.equal(evidence.indiaFacetCount,null)})
test('decoder HTTP failure cannot imply empty inventory',async t=>{await assert.rejects(()=>check(t,(row,url)=>{if(url===decoderUrl)row.status=500}),/HTTP status/)})
import{priorPublisherFixture}from'./native.fixture.js'
import{captureTenablePublisherDom,readTenableRawPublisherDom}from'./publisherDomSurface.js'
import{activePublisherAttributesHash,projectTenableSvgReferences,qualifyTenableInvalidGraphicResponse,svgGeometryHash}from'./publisherSvgReferences.js'
const atPath=(tree,path)=>path.reduce((node,index)=>node.children[index],tree)
const svgUrl=config.officialUrl
const svgHtml=Buffer.from(fixture.responses['GET '+svgUrl].bodyBase64,'base64').toString()
const svgAssets=[...config.declaredPrograms.map(row=>({...row,kind:'script'})),...config.declaredStylesheets.map(row=>({...row,kind:'stylesheet'}))].map(row=>({...row,sha256:row.programSha256,body:Buffer.from(fixture.responses['GET '+row.url].bodyBase64,'base64').toString()}))
const svgResourceRows=Object.values(fixture.responses).filter(row=>/^https:\/\/www\.tenable\.com\/[1-9]\d*$/.test(row.url)).map(row=>({...row,body:Buffer.from(row.bodyBase64,'base64').toString()}))
function svgSurface(html=svgHtml){return captureTenablePublisherDom(html,svgUrl,config.emailProjectionPolicy,{...config.emailProjectionPolicy.decoder,verified:true,cohortVerified:true})}
function svgProject(surface=svgSurface(),assets=svgAssets,resources=svgResourceRows){return projectTenableSvgReferences(surface,svgUrl,config.svgReferencePolicy,{verified:true,assets},resources)}
function coherentSvgRename(html,url){const tree=readTenableRawPublisherDom(html);for(const[symbol,index]of config.svgReferencePolicy.pages[url].symbols.map((row,index)=>[row,index])){if(symbol.kind==='invalid-external-graphic')continue;const before=atPath(tree,symbol.definitionPath).attributes.id,after=String(1370000001+index);html=html.replaceAll('id="'+before+'"','id="'+after+'"');if(symbol.kind==='closed-local-reference')html=html.replaceAll('url(#'+before+')','url(#'+after+')')}return html}
test('known closed SVG pairs and zero-consumer definition accept coherent alpha-renaming',async t=>{const{evidence}=await check(t,(row,url)=>{if(url===config.officialUrl||url===config.searchUrl)row.body=coherentSvgRename(row.body,url)});assert.equal(evidence.listingComplete,true)})
test('both actual SVG generations are identical in all other publisher meaning',async t=>{const earlier=await check(t,undefined,priorPublisherFixture),later=await check(t);for(const result of[earlier,later]){assert.equal(result.evidence.listingComplete,true);assert.equal(result.audit.receipts.length,132);assert.equal(result.audit.openingEmployer.wholeDomSurfaces[0].svgReferenceProofs.filter(p=>p.kind==='closed-local-reference').length,14);assert.equal(result.audit.openingEmployer.wholeDomSurfaces[0].invalidGraphicResourceProofs[0].qualified,true)}for(let i=0;i<2;i++)assert.equal(earlier.audit.openingEmployer.wholeDomSurfaces[i].sha256,later.audit.openingEmployer.wholeDomSurfaces[i].sha256)})
const firstSvg=config.svgReferencePolicy.pages[svgUrl].symbols[0],secondSvg=config.svgReferencePolicy.pages[svgUrl].symbols[1],externalSvg=config.svgReferencePolicy.pages[svgUrl].symbols.find(p=>p.kind==='invalid-external-graphic')
for(const[name,mutate]of[
 ['unpaired reference',s=>atPath(s.rawTree,firstSvg.referencePath).attributes['clip-path']='url(#999999999)'],
 ['cross SVG reference',s=>atPath(s.rawTree,firstSvg.referencePath).attributes['clip-path']='url(#'+atPath(s.rawTree,secondSvg.definitionPath).attributes.id+')'],
 ['duplicate ID',s=>atPath(s.rawTree,secondSvg.definitionPath).attributes.id=atPath(s.rawTree,firstSvg.definitionPath).attributes.id],
 ['malformed numeric ID',s=>atPath(s.rawTree,firstSvg.definitionPath).attributes.id='not-numeric'],
 ['geometry drift',s=>{const n=atPath(s.signatureTree,firstSvg.svgPath);n.attributes.width='33'}],
 ['external href consumer',s=>{const id=atPath(s.rawTree,firstSvg.definitionPath).attributes.id;s.rawTree.attributes.href='#'+id}],
 ['percent encoded consumer',s=>{const id=atPath(s.rawTree,firstSvg.definitionPath).attributes.id;s.rawTree.attributes.href='#'+[...id].map(c=>'%'+c.charCodeAt(0).toString(16)).join('')}],
 ['ARIA consumer',s=>{s.rawTree.attributes['aria-labelledby']=atPath(s.rawTree,firstSvg.definitionPath).attributes.id}],
 ['script consumer',s=>{s.rawTree.raw='document.getElementById("'+atPath(s.rawTree,firstSvg.definitionPath).attributes.id+'")'}],
 ['unknown clip definition',s=>s.rawTree.children.push({tag:'clippath',attributes:{id:'987654321'},inert:false,raw:null,children:[]})],
 ['missing clip definition',s=>{const path=firstSvg.definitionPath,parent=atPath(s.rawTree,path.slice(0,-1));parent.children.splice(path.at(-1),1)}],
 ['document base',s=>s.rawTree.children.push({tag:'base',attributes:{href:'https://other.example/'},inert:false,raw:null,children:[]})],
 ['graphic handler',s=>atPath(s.rawTree,externalSvg.svgPath).attributes.onload='window.newJobs=1'],
 ])test(name+' cannot qualify SVG reference projection',()=>{const surface=svgSurface();mutate(surface);const result=svgProject(surface);assert.ok(result.svgReferenceReasons.length)})
for(const[kind,body]of[['stylesheet','@import url("https://other.example/style.css");'],['stylesheet','[id^="1"]{display:none}'],['stylesheet','g{clip-path:url(#PLACEHOLDER)}'],['script','document.getElementById("PLACEHOLDER")']])test(kind+' consumer/import/value selector remains unresolved',()=>{const surface=svgSurface(),id=atPath(surface.rawTree,firstSvg.definitionPath).attributes.id,assets=[...svgAssets,{url:'https://test.invalid/consumer',kind,body:body.replace('PLACEHOLDER',id)}];assert.ok(svgProject(surface,assets).svgReferenceReasons.length)})
for(const[name,change]of[
 ['200 SVG',r=>{r.status=200;r.contentType='image/svg+xml';r.body='<svg xmlns="http://www.w3.org/2000/svg"/>'}],
 ['403',r=>r.status=403],['redirect',r=>{r.status=302;r.redirectLocation='https://www.tenable.com/other'}],
 ['changed final URL',r=>r.finalUrl='https://www.tenable.com/other'],['wrong MIME',r=>r.contentType='image/svg+xml'],
 ['challenge header',r=>r.cfMitigated='challenge'],['challenge body',r=>r.body='<html><title>Just a moment</title><body>Verify you are human</body></html>'],
 ['unknown HTML error',r=>r.body='<html><title>Error</title><body>Unknown</body></html>'],
 ])test(name+' is not an unavailable graphic proof',()=>{const rows=svgResourceRows.map(r=>({...r}));for(const row of rows)change(row);assert.ok(svgProject(svgSurface(),svgAssets,rows).svgReferenceReasons.length)})
test('missing actual current graphic URI proof remains partial',()=>{assert.ok(svgProject(svgSurface(),svgAssets,[]).svgReferenceReasons.length)})
test('closing graphic becomes available and revokes source completeness',async t=>{const{evidence}=await check(t,(row,url,n)=>{if(/^https:\/\/www\.tenable\.com\/[1-9]\d*$/.test(url)&&n===2){row.status=200;row.contentType='image/svg+xml';row.body='<svg xmlns="http://www.w3.org/2000/svg"/>'}});assert.equal(evidence.listingComplete,false);assert.equal(evidence.indiaFacetCount,null)})
test('actual mitigation header revokes a graphic proof in registered producer',async t=>{const{evidence}=await check(t,(row,url)=>{if(/^https:\/\/www\.tenable\.com\/[1-9]\d*$/.test(url))row.headers={...row.headers,'cf-mitigated':'challenge'}});assert.equal(evidence.listingComplete,false)})
test('active attribute projection preserves the raw helper contract and original symbols',()=>{const surface=svgSurface(),result=svgProject(surface);assert.deepEqual(result.svgReferenceReasons,[]);assert.notEqual(activePublisherAttributesHash(surface.rawTree),activePublisherAttributesHash(result.signatureTree));for(const proof of result.svgReferenceProofs)assert.equal(atPath(surface.rawTree,proof.definitionPath).attributes.id,proof.originalId)})
