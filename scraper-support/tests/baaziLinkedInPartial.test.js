import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import {run} from '../../scraper/baazigames/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const root=new URL('./fixtures/baazi-linkedin/',import.meta.url),docs=Object.fromEntries(await Promise.all(['home','profile','jobs',...Array.from({length:7},(_,i)=>'detail-'+(i+1))].map(async key=>[key,await fs.readFile(new URL(key+'.html',root),'utf8')])));
const urls={home:'https://www.baazigames.com/',profile:'https://www.linkedin.com/company/baazi-games',jobs:'https://www.linkedin.com/jobs/baazi-games-jobs-worldwide?f_C=14573181&trk=top-card_top-card-primary-button-top-card-primary-cta',...Object.fromEntries([{"name":"baazi-native-detail-1","url":"https://in.linkedin.com/jobs/view/senior-technical-program-manager-at-baazi-games-4468573962"},{"name":"baazi-native-detail-2","url":"https://in.linkedin.com/jobs/view/unity-developer-at-baazi-games-4471268461"},{"name":"baazi-native-detail-3","url":"https://in.linkedin.com/jobs/view/lead-backend-engineer-at-baazi-games-4475192359"},{"name":"baazi-native-detail-4","url":"https://in.linkedin.com/jobs/view/software-engineer-in-test-at-baazi-games-4471728189"},{"name":"baazi-native-detail-5","url":"https://in.linkedin.com/jobs/view/ai-ml-engineer-at-baazi-games-4471725569"},{"name":"baazi-native-detail-6","url":"https://in.linkedin.com/jobs/view/technical-artist-at-baazi-games-4474055257"},{"name":"baazi-native-detail-7","url":"https://in.linkedin.com/jobs/view/game-ui-designer-at-baazi-games-4471264889"}].map((spec,i)=>['detail-'+(i+1),spec.url]))};
const exercise=async({changes={},override,signal}={})=>run({signal,now:()=> '2026-10-09T01:00:00Z',fetchPage:async(url,options={})=>{const key=Object.keys(urls).find(k=>urls[k]===url);assert.ok(key,'Published employer authority only '+url);const result={status:200,url,html:changes[key]??docs[key]};return(await override?.(key,result,options))??result}});
test('Baazi recovers seven current explicitly India employer-linked roles from eight observed native cards as a partial inventory',async()=>{const jobs=await exercise();assert.equal(jobs.length,7);assert.equal(jobs[0].title,'Senior Technical Program Manager');assert.ok(jobs.every(j=>j.country==='India'&&j.company==='Baazi Games'&&j.sourceListingComplete===false&&j.jobDescription.length>=300));assert.equal(new Set(jobs.map(j=>j.jobId)).size,7);const e=readInventoryEvidence(jobs);assert.equal(e.status,'coverage-gap');assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.match(e.reason,/primary.*unavailable/i)});

const mutateSchema=(html,change)=>html.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,(all,open,body,close)=>{
 const v=JSON.parse(body);if(v['@type']==='JobPosting')change(v);return open+JSON.stringify(v)+close
});
const changed=(key,from,to)=>({changes:{[key]:docs[key].replaceAll(from,to)}});
for(const [label,key,from,to,pattern] of [
 ['foreign employer domain wrapper','profile','https://www.linkedin.com/redir/redirect','https://other.example/redir/redirect',/domain binding/],
 ['different employer target domain','profile','http%3A%2F%2Fbaazigames%2Ecom','http%3A%2F%2Fother%2Eexample',/domain binding/],
 ['wrong native company ID','profile','f_C=14573181','f_C=99999999',/handoff/],
 ['foreign card employer','jobs','https://in.linkedin.com/company/baazi-games?trk=public_jobs_jserp-result_job-search-card-subtitle','https://in.linkedin.com/company/other?trk=public_jobs_jserp-result_job-search-card-subtitle',/foreign employer/],
 ['count mismatch','jobs','(8 Open Roles)','(9 Open Roles)',/count/],
 ['missing terminal inventory marker','jobs','viewed all jobs for this search','not viewed all roles',/terminal inventory/],
 ['duplicate native ID','jobs','urn:li:jobPosting:4471268461','urn:li:jobPosting:4468573962',/duplicate/],
 ['unpublished detail host','jobs','https://in.linkedin.com/jobs/view/senior-technical-program-manager','https://other.example/jobs/view/senior-technical-program-manager',/foreign employer/],
 ['detail canonical drift','detail-1','rel="canonical" href="https://in.linkedin.com/jobs/view/senior-technical-program-manager-at-baazi-games-4468573962"','rel="canonical" href="https://in.linkedin.com/jobs/view/other-4468573962"',/identity/],
 ['native Apply removal','detail-1','id="topbar-apply"','id="removed-apply"',/open native application/],
 ['closed native job','detail-1','Senior Technical Program Manager','No longer accepting applications',/identity|open native/],
]){
 test('Baazi rejects '+label,async()=>{assert.ok(docs[key].includes(from),label+' mutation must match');await assert.rejects(exercise(changed(key,from,to)),pattern)})
}
test('Baazi refuses an inert or commented current employer handoff',async()=>{
 const from=docs.profile.match(/<a\b[^>]*data-tracking-control-name="top-card_top-card-primary-button-top-card-primary-cta"[^>]*>[\s\S]*?<\/a>/)?.[0];
 assert.ok(from);await assert.rejects(exercise(changed('profile',from,'<!--'+from+'-->')),/handoff/);
});
for(const country of ['US','ZZ','United States']){
 test('Baazi rejects conflicting structured workplace '+country,async()=>{await assert.rejects(exercise({changes:{'detail-1':mutateSchema(docs['detail-1'],j=>j.jobLocation.address.addressCountry=country)}}),/India workplace/)})
}
for(const region of ['United States','US','Karnataka']){
 test('Baazi rejects inconsistent structured region '+region,async()=>{await assert.rejects(exercise({changes:{'detail-1':mutateSchema(docs['detail-1'],j=>j.jobLocation.address.addressRegion=region)}}),/India workplace/)})
}
for(const region of ['United States','US']){
 test('Baazi rejects foreign visible India region '+region,async()=>{await assert.rejects(exercise({changes:{jobs:docs.jobs.replaceAll('Delhi, India','Delhi, '+region+', India'),'detail-1':docs['detail-1'].replaceAll('Delhi, India','Delhi, '+region+', India')}}),/India workplace/)})
}
test('Baazi rejects expired native schema despite visible Apply',async()=>{await assert.rejects(exercise({changes:{'detail-1':mutateSchema(docs['detail-1'],j=>j.validThrough='2026-10-08T00:00:00Z')}}),/open native application/)});
test('Baazi rejects missing or conflicting schema JD',async()=>{await assert.rejects(exercise({changes:{'detail-1':mutateSchema(docs['detail-1'],j=>j.description='Missing native description')}}),/description/)});
test('Baazi preserves primary outage when current public feed is unavailable',async()=>{await assert.rejects(exercise({override:(k,p)=>k==='profile'?{...p,status:429}:undefined}),e=>e.status===429&&e.failureKind==='incomplete_listing'&&/unavailable/.test(e.primaryInventoryUnavailable))});
test('Baazi rejects off-authority native final redirects',async()=>{await assert.rejects(exercise({override:(k,p)=>k==='profile'?{...p,url:'https://other.example/'}:undefined}),/final authority/)});
test('Baazi refuses primary sentinel copied to a foreign final authority',async()=>{await assert.rejects(exercise({override:(k,p)=>k==='home'?{...p,url:'https://other.example/'}:undefined}),/primary homepage redirected/)});
test('Baazi rejects a changed final current listing snapshot',async()=>{let count=0;await assert.rejects(exercise({override:(k,p)=>k==='jobs'&&++count===2?{...p,html:p.html.replace('2026-09-22','2026-09-23')}:undefined}),/listing changed/)});
test('Baazi propagates caller cancellation before any authority request',async()=>{const c=new AbortController();c.abort(new Error('caller cancelled'));await assert.rejects(exercise({signal:c.signal}),/caller cancelled/)});
test('Baazi forwards caller signal to current native authority reads',async()=>{const c=new AbortController();let reads=0;await exercise({signal:c.signal,override:(k,p,o)=>{assert.equal(o.signal,c.signal);reads++}});assert.equal(reads,12)});

test('Baazi current native default search title variant retains identical counted terminal cards',async()=>{const current=await fs.readFile(new URL('jobs-current.html',root),'utf8');assert.equal((await exercise({changes:{jobs:current}})).length,7)});
test('Baazi rejects active native decorated job ID differing from card',async()=>{await assert.rejects(exercise(changed('detail-1','<!--"4468573962"-->','<!--"9999999999"-->')),/native job ID/)});
test('Baazi rejects decorated job ID copied into an outer comment',async()=>{const block=docs['detail-1'].match(/<code\b[^>]*id="decoratedJobPostingId"[^>]*>[\s\S]*?<\/code>/)?.[0];assert.ok(block);await assert.rejects(exercise(changed('detail-1',block,'<!--'+block+'-->')),/native job ID/)});
test('Baazi rejects conflicting direct schema job country',async()=>{await assert.rejects(exercise({changes:{'detail-1':mutateSchema(docs['detail-1'],j=>j.country='US')}}),/India workplace/)});
test('Baazi rejects conflicting direct schema jobLocation country',async()=>{await assert.rejects(exercise({changes:{'detail-1':mutateSchema(docs['detail-1'],j=>j.jobLocation.country='US')}}),/India workplace/)});
for(const label of ['Location:','Work Location:','Job Location:']){
 test('Baazi rejects explicit foreign JD workplace '+label,async()=>{await assert.rejects(exercise({changes:{'detail-1':mutateSchema(docs['detail-1'],j=>j.description='<p><strong>'+label+'</strong> New York, United States</p>'+j.description).replace(/(<div\b[^>]*class=["'][^"']*\bshow-more-less-html__markup\b[^"']*["'][^>]*>)/i,'$1<p><strong>'+label+'</strong> New York, United States</p>')}}),/JD workplace/)})
}
