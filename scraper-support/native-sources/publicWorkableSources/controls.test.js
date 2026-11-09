import assert from 'node:assert/strict'
import test from 'node:test'
import {fixture,replay,editJSON,editHTML} from './fixtureReplay.js'
import {createPublicWorkableSource} from './nativeCareers.js'
const profile=s=>fixture.profiles.find(p=>p.source===s)
const run=async(s,mutate,options={},p=profile(s))=>{const r=replay(mutate);const jobs=await createPublicWorkableSource(p).run({...r.options,...options});return {...r,jobs,audit:r.audits[0]}}
test('CSS-hidden company links cannot establish employer binding',async()=>{
 const r=await run('huggingface',(u,p)=>u==='https://huggingface.co/'?editHTML(p,h=>'<style>a{display:none}</style>'+h):p)
 assert.equal(r.audit.employerBindingQualified,false);assert.equal(r.jobs.length,0)
})
test('HTTP200 ok:false envelope cannot certify an empty collection',async()=>{
 const r=await run('huggingface',(u,p)=>u.includes('/widget/accounts/huggingface?')?editJSON(p,v=>Object.assign(v,{ok:false,jobs:[]})):p)
 assert.equal(r.audit.selectedCollectionComplete,false)
})
test('own markdown extra qualification is a pair contradiction',async()=>{
 const code=fixture.oracle.seeq.records[0].id
 const r=await run('seeq',(u,p)=>u.endsWith('/'+code+'.md')?editHTML(p,h=>h.replace('## Requirements','## Requirements\n\nMandatory undisclosed security qualification.')):p)
 assert.equal(r.audit.observations.find(x=>x.id===code).ownPairQualified,false)
})
test('null listing peer retains six valid original pairs',async()=>{
 const r=await run('huggingface',(u,p)=>u.includes('/widget/accounts/huggingface?')?editJSON(p,v=>v.jobs.unshift(null)):p)
 assert.equal(r.audit.observations.length,6);assert.equal(r.audit.selectedCollectionComplete,false)
 assert.equal(r.audit.observations.filter(v=>v.ownPairQualified).length,6);assert.equal(r.jobs.length,3)
})
test('five consistent location views remain one known multi-country post',async()=>{
 const r=await run('seeq'),row=r.audit.observations.find(v=>v.id==='F4EA21F6D3')
 assert.equal(row.listingVariants.length,5);assert.equal(row.ownPairQualified,true)
 assert.equal(row.geography.countries.length,5);assert.equal(row.geography.unresolved,false);assert.equal(row.geography.country,null)
})
test('duplicate-view unknown-field disagreement holds only that post',async()=>{
 const r=await run('seeq',(u,p)=>u.includes('/widget/accounts/seeq?')?editJSON(p,v=>v.jobs.filter(x=>x.shortcode==='F4EA21F6D3')[1].unknownCriteria='New condition'):p)
 assert.equal(r.audit.observations.find(x=>x.id==='F4EA21F6D3').ownPairQualified,false)
 assert.ok(r.audit.observations.filter(x=>x.ownPairQualified).length>=20)
})
for(const [label,change]of [
 ['account UID',n=>n.accountUid='foreign'],['internal vacancy',n=>n.isInternal=true],['draft state',n=>n.state='draft'],
 ['requirements',n=>n.requirements='<p>Different mandatory criteria.</p>'],['publication',n=>n.published='2026-01-01T00:00:00.000Z'],['employment',n=>n.type='contract']
])test('own '+label+' contradiction holds affected pair and preserves peers',async()=>{
 const code=fixture.oracle.huggingface.records[0].id
 const r=await run('huggingface',(u,p)=>u.endsWith('/jobs/'+code)?editJSON(p,change):p)
 assert.equal(r.audit.observations.find(x=>x.id===code).ownPairQualified,false)
 assert.equal(r.audit.observations.filter(x=>x.ownPairQualified).length,5)
})
test('hidden native locations remain unresolved despite underlying foreign country',async()=>{
 for(const s of ['huggingface','seeq']){const r=await run(s);for(const row of r.audit.observations.filter(x=>x.geography.unresolved)){
  assert.equal(row.geography.country,null);assert.deepEqual(row.geography.countries,[]);assert.equal(row.candidateEligible,r.audit.employerBindingQualified)
 }assert.equal(r.jobs.length,r.audit.employerBindingQualified?fixture.oracle[s].hiddenPostings:0)}
})
test('maxJobs zero still audits every own pair twice',async()=>{
 const r=await run('huggingface',undefined,{maxJobs:0});assert.equal(r.jobs.length,0);assert.equal(r.audit.candidateCount,3)
 assert.equal(r.audit.observations.length,6);assert.ok(r.audit.observations.every(o=>o.history.length===2))
})
test('Global control preserves foreign records, code, publication and numeric zero pay',async()=>{
 const code=fixture.oracle.huggingface.records[0].id,p={...profile('huggingface'),countryFilter:'Global'}
 const r=await run('huggingface',(u,page)=>u.endsWith('/jobs/'+code)?editJSON(page,n=>Object.assign(n,{salary_from:0,salary_to:0,salary_currency_iso_code:'USD',salary_frequency:'year'})):page,{},p)
 assert.equal(r.jobs.length,6);const job=r.jobs.find(j=>j.jobId===code)
 assert.equal(job.salaryRange.minimum,0);assert.equal(job.salaryRange.maximum,0);assert.equal(job.requisitionId,null)
 assert.equal(job.postingDate,fixture.oracle.huggingface.records[0].originalNative.published)
 assert.equal(job.employerJobCode,fixture.oracle.huggingface.records[0].originalNative.code)
})
test('one failed opening collection preserves closing independent positives',async()=>{
 const r=await run('huggingface',(u,p,n)=>u.includes('/widget/accounts/huggingface?')&&n===1?{...p,status:503}:p)
 assert.equal(r.audit.selectedCollectionComplete,false);assert.equal(r.jobs.length,3);assert.equal(r.audit.observations.length,6)
})
test('unpublished route cannot authorize an alias or application GET',async()=>{
 const code=fixture.oracle.huggingface.records[0].id
 const r=await run('huggingface',(u,p)=>u.includes('/widget/accounts/huggingface?')?editJSON(p,v=>v.jobs.find(x=>x.shortcode===code).url='https://unknown.example/role'):p)
 assert.equal(r.audit.observations.find(x=>x.id===code).ownPairQualified,false)
 assert.ok(!r.requests.some(u=>u.includes('unknown.example')||/\/apply\/?$/.test(new URL(u).pathname)))
})
test('async callbacks are awaited and detached',async()=>{
 const r=replay();let completed=false,records=false
 const jobs=await createPublicWorkableSource(profile('huggingface')).run({...r.options,onAudit:async a=>{await Promise.resolve();for(const o of a.observations)o.originalNative.title='Modified callback copy';completed=true},
  onRecords:async rows=>{await Promise.resolve();for(const o of rows)o.originalNative.title='Second modified copy';records=true}})
 assert.equal(completed,true);assert.equal(records,true);assert.ok(jobs.every(j=>!j.title.includes('Modified')))
})
test('abort drains active own requests and emits no partial callback',async()=>{
 const r=replay(),controller=new AbortController();let active=0
 const fetchPage=async(u,init)=>{active++;try{if(u.includes('/api/v2/')){controller.abort(Error('boundary abort'));await new Promise(resolve=>setTimeout(resolve,10))}return await r.options.fetchPage(u,init)}finally{active--}}
 await assert.rejects(createPublicWorkableSource(profile('huggingface')).run({...r.options,fetchPage,signal:controller.signal}),/boundary abort/)
 assert.equal(active,0);assert.equal(r.audits.length,0)
})
test('Travis future published records work when current company handoff returns',async()=>{
 const p=profile('travisci'),original=fixture.oracle.huggingface.records[0],id=original.id,base='https://apply.workable.com/',own=base+'travisci/j/'+id
 const location={country:'India',countryCode:'IN',city:'Bengaluru',region:'Karnataka',hidden:false}
 const n={...structuredClone(original.originalNative),accountUid:p.accountUid,location:{...location},locations:[location]}
 const row={...structuredClone(original.listingVariants[0]),country:'India',city:'Bengaluru',state:'Karnataka',locations:[location]}
 const response=(url,status,raw,headers={})=>({url,status,headers,bodyBase64:Buffer.from(raw).toString('base64')})
 const extras=new Map([[base+'api/v2/accounts/travisci/jobs/'+id,response(base+'api/v2/accounts/travisci/jobs/'+id,200,JSON.stringify(n))],
  [base+'j/'+id,response(base+'j/'+id,301,'Moved',{location:own})],
  [own,response(own,200,'<title>'+n.title+' - Travis CI</title><link rel="canonical" href="'+own+'"><script>window.careers = {"features":{},"dimensions":{},"config":{}};</script>')]])
 for(const restored of [false,true]){
  const r=replay((u,page)=>u.includes('/widget/accounts/travisci?')?editJSON(page,v=>v.jobs=[row]):restored&&u===p.primaryURLs[0]?editHTML(page,h=>h+'<a href="'+base+'travisci/">Careers</a>'):page,extras)
  const jobs=await createPublicWorkableSource(p).run(r.options);assert.equal(r.audits[0].observations.length,1)
  assert.equal(r.audits[0].observations[0].ownPairQualified,true);assert.equal(jobs.length,restored?1:0)
  if(restored){assert.equal(jobs[0].country,'India');assert.equal(jobs[0].requisitionId,null)}
 }
})

test('Seeq explicit synthetic visible handoff restores the hidden-location discovery candidate',async()=>{
 const r=await run('seeq',(u,p)=>u==='https://www.seeq.com/company/careers/'?editHTML(p,h=>h.replaceAll('[data-aos^=fade][data-aos^=fade]{opacity:0}','[data-aos^=fade][data-aos^=fade]{opacity:1}')):p)
 assert.equal(r.audit.employerBindingQualified,true);assert.equal(r.jobs.length,1);assert.equal(r.jobs[0].country,null);assert.equal(r.jobs[0].countryScopeUnresolved,true)
})

test('a closing explicit withdrawal holds an earlier valid hidden-location posting',async()=>{
 const id=fixture.oracle.huggingface.records.find(r=>r.hiddenLocation).id
 const r=await run('huggingface',(u,p,n)=>u.endsWith('/jobs/'+id)&&n===2?editJSON(p,v=>v.state='draft'):p)
 assert.equal(r.audit.observations.find(o=>o.id===id).candidateEligible,false);assert.equal(r.jobs.length,2)
})
test('removal from a complete closing feed holds the removed earlier posting',async()=>{
 const id=fixture.oracle.huggingface.records.find(r=>r.hiddenLocation).id
 const r=await run('huggingface',(u,p,n)=>u.includes('/widget/accounts/huggingface?')&&n===2?editJSON(p,v=>v.jobs=v.jobs.filter(j=>j.shortcode!==id)):p)
 assert.equal(r.audit.observations.length,6);assert.equal(r.audit.observations.find(o=>o.id===id).candidateEligible,false);assert.equal(r.jobs.length,2)
})

for(const fault of ['unrelated detail','null peer'])test('R1 removed posting remains held with '+fault,async()=>{
 const removed='9E2A4C02C7',other='81B46579FE'
 const r=await run('huggingface',(u,p,n)=>{
  if(n===2&&u.includes('/widget/accounts/huggingface?'))return editJSON(p,v=>{v.jobs=v.jobs.filter(j=>j.shortcode!==removed);if(fault==='null peer')v.jobs.push(null)})
  if(n===2&&u.endsWith('/jobs/'+other)&&fault==='unrelated detail')return {...p,status:503}
  return p
 })
 assert.equal(r.audit.observations.find(o=>o.id===removed).candidateEligible,false)
 assert.equal(r.audit.observations.find(o=>o.id==='DB4D7C0EC8').candidateEligible,true)
})
test('R2 malformed additional native location holds France post without creating fourth candidate',async()=>{
 const r=await run('huggingface',(u,p)=>u.endsWith('/jobs/81B46579FE')?editJSON(p,n=>n.locations.push(null)):p)
 assert.equal(r.audit.observations.find(o=>o.id==='81B46579FE').ownPairQualified,false);assert.equal(r.jobs.length,3)
})
test('R2 two null location elements cannot corroborate an own pair',async()=>{
 const id='9E2A4C02C7',r=await run('huggingface',(u,p)=>u.endsWith('/jobs/'+id)?editJSON(p,n=>n.locations=[null]):u.includes('/widget/accounts/huggingface?')?editJSON(p,v=>Object.assign(v.jobs.find(j=>j.shortcode===id),{locations:[null],country:'',city:'',state:''})):p)
 assert.deepEqual(r.audit.observations.find(o=>o.id===id).originalNative.locations,[null]);assert.equal(r.audit.observations.find(o=>o.id===id).ownPairQualified,false);assert.equal(r.jobs.length,2)
})
const badMD='\n| Broken peer | dept | US | Full-time | - | 2026-11-01 | [View](https://apply.workable.com/seeq/jobs/view/INVALID!.md) |\n'
test('R3 malformed Markdown peer preserves all24 valid own Markdown pairs',async()=>{
 const r=await run('seeq',(u,p)=>u==='https://apply.workable.com/seeq/jobs.md'?editHTML(p,h=>h+badMD):p)
 assert.equal(r.audit.observations.length,24);assert.equal(r.audit.phases[0].markdownRows.length,24)
 assert.equal(r.requests.filter(u=>/\/jobs\/view\/.+\.md$/.test(u)).length,48)
 assert.ok(r.audit.observations.every(o=>o.originalOwnMarkdown?.bodyBase64&&o.ownPairQualified))
 assert.equal(r.audit.selectedCollectionComplete,false)
})
test('R3 malformed peer cannot discard a valid Markdown-only posting',async()=>{
 const id='1B6E0A1710',r=await run('seeq',(u,p)=>u==='https://apply.workable.com/seeq/jobs.md'?editHTML(p,h=>h+badMD):u.includes('/widget/accounts/seeq?')?editJSON(p,v=>v.jobs=v.jobs.filter(j=>j.shortcode!==id)):p)
 assert.equal(r.audit.observations.length,24);assert.equal(r.audit.observations.find(o=>o.id===id).ownPairQualified,true)
})
test('R3 duplicate Markdown identity holds only that posting and retains all declarations',async()=>{
 const id='1B6E0A1710',r=await run('seeq',(u,p)=>u==='https://apply.workable.com/seeq/jobs.md'?editHTML(p,h=>h+'\n'+h.split('\n').find(l=>l.startsWith('|')&&l.includes('/'+id+'.md'))+'\n'):p)
 assert.equal(r.audit.observations.length,24);assert.equal(r.audit.observations.find(o=>o.id===id).ownPairQualified,false)
 assert.equal(r.audit.observations.filter(o=>o.ownPairQualified).length,23);assert.equal(r.audit.observations.find(o=>o.id===id).markdownDeclarations.length,2)
})

test('R4 projected location labels satisfy the ordinary stored-location consumer contract',async()=>{
 const r=await run('huggingface',undefined,{}, {...profile('huggingface'),countryFilter:'Global'})
 const {getPrimaryStoredLocation}=await import('../../../src/utils/jobLocations.js')
 const job=r.jobs.find(j=>j.jobId==='81B46579FE'),row=r.audit.observations.find(o=>o.id===job.jobId)
 assert.ok(job.locations.every(v=>typeof v==='string'));assert.equal(getPrimaryStoredLocation(job),row.geography.locations[0].location)
})

test('R4 normalization retains public experience category and employment label as source evidence',async()=>{
 const r=await run('huggingface'),{normalizeScrapedJob}=await import('../../utils/normalizeScrapedJob.js')
 for(const job of r.jobs){const raw=r.audit.observations.find(o=>o.id===job.jobId).listingVariants[0],normalized=normalizeScrapedJob(job)
  assert.equal(normalized.sourceExperienceRequired,raw.experience);assert.equal(normalized.sourceEmploymentType,raw.employment_type)
 }
})
