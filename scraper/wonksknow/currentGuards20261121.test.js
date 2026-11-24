import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {createWonksknowScraper} from './script.js';
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js';
import {replay,firstRoleURL,changeSelected,BOARD,HOME} from './fixtures/currentReplay20261121.js';
let previousFetch;before(()=>{previousFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('Live native requests are fenced in genuine replay tests');};});after(()=>{globalThis.fetch=previousFetch;});
const selectedChange=change=>(record,text)=>record.requestedUrl===firstRoleURL?changeSelected(text,record.url,fragment=>change(fragment,record)):text;
const insert=content=>fragment=>fragment.replace(/(<div\b[^>]*>)/i,'$1'+content);
const roleID=new URL(firstRoleURL).searchParams.get('job_id');
const apply='https://vinterview.ai/user/wonksknowindia/job_application_organization_page?job_id='+roleID;
const asSchema=model=>'<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'WebPage',url:firstRoleURL,...model})+'</script>';
for(const [label,html] of [
 ['hidden country contradiction','<section hidden><label>Country</label><span>United States</span></section>'],
 ['semantic employer contradiction','<article><p>Employer</p><p>Other Employer</p></article>'],
 ['semantic publication contradiction','<section><div>Posting status</div><div>withdrawn</div></section>'],
 ['semantic application contradiction','<section><label>Application URL</label><span>https://other.example/apply</span></section>'],
 ['root adjacent unknown country','<label>Country</label><span>unknown</span>'],
 ['typed role unpublished',asSchema({isPublished:false})],
 ['typed role foreign country',asSchema({country:'United States'})],
 ['typed role unknown country',asSchema({country:null})],
 ['typed role foreign issuer',asSchema({hiringOrganization:{'@type':'Organization',name:'Other Employer'}})],
 ['plural typed applications wrong role',asSchema({applicationUrls:[apply,apply.replace(roleID,'other-role')]})],
 ['plural typed applications malformed first',asSchema({applicationUrls:['not a usable application',apply]})],
 ['typed unknown applicant region',asSchema({applicantLocationRequirements:{'@type':'Country',name:'Worldwide'}})],
 ['typed secondary foreign workplace',asSchema({workLocations:[{country:'India'},{country:'United States'}]})],
 ['typed nested expired publication',asSchema({publication:{validThrough:'2000-01-01'}})],
 ['typed future publication',asSchema({datePosted:'2099-01-01'})],
 ['malformed structured criteria','<script type="application/ld+json">{"@type":"JobPosting",</script>'],
])test(label+' holds only its own selected role',async()=>{const out=await replay(createWonksknowScraper,{mutate:selectedChange(insert(html))});assert.equal(out.error,null);assert.equal(out.jobs.length,13);assert(!out.jobs.some(job=>job.sourceUrl===firstRoleURL));});
for(const [label,attributes] of [
 ['explicit closed flag','data-closed="true"'],['explicit unpublished flag','data-is-published="false"'],['foreign publisher','data-publisher="Other Employer"'],['unknown job country','data-job-country="unknown"'],['foreign work location country','data-work-location-country="US"'],['unknown status','data-posting-status="unknown"'],['unknown application alias','data-application-urls="unknown"'],
])test(label+' on a selected owner preserves unrelated positives',async()=>{const out=await replay(createWonksknowScraper,{mutate:selectedChange(fragment=>fragment.replace('<div ','<div '+attributes+' '))});assert.equal(out.error,null);assert.equal(out.jobs.length,13);});
for(const [label,change] of [
 ['hidden selected title',fragment=>fragment.replace('class="heading job-title"','hidden class="heading job-title"')],
 ['disabled selected application',fragment=>fragment.replace('class="btn apply-link','aria-disabled="true" class="btn apply-link')],
 ['selected title conflicts with own listing',fragment=>fragment.replace('PYTHON TRAINER AND DEVELOPER','Other Role')],
 ['first selected issuer conflicts',fragment=>fragment.replace('Wonksknow Technologies India Private Ltd','Other Employer')],
])test(label+' holds the affected publication',async()=>{const out=await replay(createWonksknowScraper,{mutate:selectedChange(change)});assert.equal(out.error,null);assert.equal(out.jobs.length,13);});
test('coherent typed India and duplicate same-role applications remain valid without manufacturing native dates',async()=>{const out=await replay(createWonksknowScraper,{mutate:selectedChange(insert(asSchema({country:'India',hiringOrganization:{'@type':'Organization',name:'Wonksknow'},applicationUrls:[apply,apply]})))});assert.equal(out.error,null);assert.equal(out.jobs.length,14);});
test('unrelated OTHER ROLES country prose cannot veto the selected vacancy',async()=>{const out=await replay(createWonksknowScraper,{mutate:(record,text)=>{if(record.requestedUrl!==firstRoleURL)return text;const marker='OTHER ROLES',at=text.indexOf(marker);assert(at>0);return text.slice(0,at)+text.slice(at).replace(/(<div\b[^>]*class="job-opening marginb-m4"[^>]*>)/,'$1<section>Country: United States</section>');}});assert.equal(out.error,null);assert.equal(out.jobs.length,14);});
test('missing optional requirements retain a qualified partial instead of borrowing another vacancy',async()=>{const out=await replay(createWonksknowScraper,{mutate:selectedChange(fragment=>{const at=fragment.indexOf('JOB REQUIREMENT');assert(at>0);return fragment.slice(0,fragment.lastIndexOf('<p',at))+'</div>';})});assert.equal(out.error,null);assert.equal(out.jobs.length,14);assert.equal(out.jobs.find(job=>job.sourceUrl===firstRoleURL).minimumQualification,null);});
test('earliest genuinely authored date across the two observations is retained',async()=>{const out=await replay(createWonksknowScraper,{mutate:selectedChange((fragment,record)=>insert(asSchema({datePosted:record.phase==='opening'?'2020-01-01':'2026-11-20'}))(fragment))});assert.equal(out.error,null);assert.equal(out.jobs.find(job=>job.sourceUrl===firstRoleURL).postingDate,'2020-01-01T00:00:00.000Z');});
for(const [label,change] of [
 ['absent India declaration',text=>text.replaceAll('India Careers','India Information')],
 ['foreign India account',text=>text.replaceAll(BOARD,'https://vinterview.ai/other/overview')],
 ['hidden actual India declaration',text=>text.replace('href="'+BOARD+'"','hidden href="'+BOARD+'"')],
 ['foreign own publisher title',text=>text.replace(/<title>[\s\S]*?<\/title>/i,'<title>Careers at Other Employer</title>')],
])test(label+' holds before any native role publication',async()=>{const out=await replay(createWonksknowScraper,{mutate:(record,text)=>record.requestedUrl===HOME?change(text):text});assert.notEqual(out.error,null);assert.equal(out.jobs,null);});
test('all role contradictions return an unverified coverage gap rather than a zero or inventory claim',async()=>{const out=await replay(createWonksknowScraper,{mutate:(record,text)=>record.resource==='actual-declared-public-role'?changeSelected(text,record.url,insert('<p>Country: United States</p>')):text});assert.equal(out.error,null);assert.equal(out.jobs.length,0);const inventory=readInventoryEvidence(out.jobs);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);});
for(const status of [202,401,402,403,406,407,429,451])test('restricted HTTP '+status+' stops on the first native response with no retry',async()=>{const out=await replay(createWonksknowScraper,{mutate:(record,text)=>record.index===0?{text,status}:text});assert.notEqual(out.error,null);assert.equal(out.readCount,1);});
test('wrong original Response URL is refused before publisher parsing',async()=>{const out=await replay(createWonksknowScraper,{mutate:(record,text)=>record.index===0?{text,url:'https://other.example/'}:text});assert.notEqual(out.error,null);assert.equal(out.readCount,1);});
test('wrong HTML MIME is refused without fallback transport',async()=>{const out=await replay(createWonksknowScraper,{mutate:(record,text)=>record.index===0?{text,headers:{'content-type':'application/json'}}:text});assert.notEqual(out.error,null);assert.equal(out.readCount,1);});
test('explicit caller zero makes no acquisition and cannot certify an empty inventory',async()=>{const out=await replay(createWonksknowScraper,{options:{maxJobs:0}});assert.equal(out.error,null);assert.equal(out.readCount,0);assert.equal(out.jobs.length,0);assert.equal(readInventoryEvidence(out.jobs).listingComplete,false);});
