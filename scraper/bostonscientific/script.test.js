import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {run,readBostonScientificDiagnostics} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
const f=JSON.parse(fs.readFileSync(new URL('./fixtures/native-20261020.json',import.meta.url))),now=()=> '2026-10-20T23:40:00Z'
function fixture(rows=f.indiaRows){return {now,fetchText:async u=>u.includes('bostonscientific.com/')?f.corporate:f.board,fetchJson:async url=>{
 const u=new URL(url)
 if(u.pathname.endsWith('/search')){const selected=u.searchParams.has('filter_country')?rows.filter(r=>f.details[r.id]):rows,start=Number(u.searchParams.get('start'));return{status:200,error:{message:'',body:''},data:{count:selected.length,positions:selected.slice(start,start+10),appliedFilters:u.searchParams.has('filter_country')?{country:['India']}:{}}}}
 return structuredClone(f.details[u.searchParams.get('position_id')])
}}}
test('validated current native pagination and full details map through shared Eightfold adapter',async()=>{const jobs=await run(fixture());assert.equal(jobs.length,4);assert.ok(jobs.every(j=>j.sourceDetailComplete&&j.sourceListingComplete));assert.equal(readInventoryEvidence(jobs).reportedTotal,4)})
test('unresolved global secondary Remote preserves verified subset with partial source health',async()=>{const unknown=structuredClone(f.foreignRows[0]);unknown.locations[0]+=', Remote';const jobs=await run(fixture([...f.indiaRows,unknown]));assert.equal(jobs.length,4);assert.ok(jobs.every(j=>j.sourceListingComplete===false));assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readBostonScientificDiagnostics(jobs).unresolvedScopes.length,1)})
test('India country facet reconciles a corroborated Haryana comma-city address without promoting unresolved global scope',async()=>{
 const rows=structuredClone(f.indiaRows),row=rows[0],base=fixture(rows),unknown=structuredClone(f.foreignRows[0])
 row.locations=['Gurgaon, India | India-Haryana, Gurgaon'];row.standardizedLocations=['Gurugram, HR, IN'];unknown.locations[0]+=', Remote'
 const transport=fixture([...rows,unknown]),jobs=await run({...base,fetchJson:async(u,o)=>{
  const p=await transport.fetchJson(u,o)
  if(u.includes('position_details')&&p.data.id===row.id){p.data.locations=row.locations;p.data.standardizedLocations=row.standardizedLocations}
  return p
 }})
 assert.equal(jobs.length,4);assert.equal(jobs.find(j=>j.jobId===row.id).location,'Gurgaon, India')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readBostonScientificDiagnostics(jobs).unresolvedScopes.length,1)
})
test('explicit zero cap cannot certify zero or completeness',async()=>{const jobs=await run({...fixture(),maxJobs:0});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false)})
test('caller abort settles hanging native transport',async()=>{const c=new AbortController(),p=run({...fixture(),signal:c.signal,fetchText:()=>new Promise(()=>{})});c.abort();await assert.rejects(p)})
test('detail identity failures propagate past optional shared detail fallback',async()=>{const base=fixture();await assert.rejects(run({...base,fetchJson:async(u,o)=>{const p=await base.fetchJson(u,o);if(u.includes('position_details'))p.data.id++;return p}}),/mismatch/)})
test('duplicate raw identities across a native page fail closed',async()=>await assert.rejects(run(fixture([...f.indiaRows,f.indiaRows[0]])),/duplicate/i))
test('final listing drift cannot claim inventory success',async()=>{const base=fixture();let first=0;await assert.rejects(run({...base,fetchJson:async(u,o)=>{const p=await base.fetchJson(u,o);if(u.includes('/search')&&!u.includes('filter_country')&&new URL(u).searchParams.get('start')==='0'&&++first===2)p.data.positions=[];return p}}),/snapshot|drift/i)})
test('catalog selects current Eightfold wrapper rather than inherited Workday sentinel',()=>{const catalog=getScraperCatalog(),providers=catalog.filter(p=>p.source==='bostonscientific');assert.equal(providers.length,1);assert.match(providers[0].modulePath,/bostonscientific[\\/]script\.js$/);assert.equal(providers[0].verifiedPublicJobCount,null);assert.equal(providers[0].verifiedIndiaJobCount,null)})

test('full500-row native boundary stays partial even with all geographies resolved and four exact India details',async()=>{
 const foreign=Array.from({length:496},(_,index)=>({...structuredClone(f.foreignRows[0]),id:800000000000000+index,displayJobId:String(700000+index),atsJobId:String(700000+index),name:'Foreign native role '+index,positionUrl:'/careers/job/'+(800000000000000+index),locations:['Arden Hills US-MN, United States | N/A'],standardizedLocations:['Arden Hills, MN, US']}))
 const base=fixture([...f.indiaRows,...foreign]),starts=[],jobs=await run({...base,fetchJson:async(u,o)=>{const url=new URL(u);if(url.pathname.endsWith('/search')&&!url.searchParams.has('filter_country'))starts.push(Number(url.searchParams.get('start')));return base.fetchJson(u,o)}})
 assert.deepEqual(starts,[...Array.from({length:51},(_,index)=>index*10),0])
 assert.equal(jobs.length,4);assert.ok(jobs.every(j=>j.sourceDetailComplete===true&&j.sourceListingComplete===false))
 const evidence=readInventoryEvidence(jobs),diagnostics=readBostonScientificDiagnostics(jobs)
 assert.equal(evidence.reportedTotal,500);assert.equal(evidence.listingComplete,false);assert.notEqual(evidence.status,'verified-empty');assert.match(evidence.reason,/search.*ceiling/)
 assert.equal(diagnostics.uniqueGlobalIdentities,500);assert.equal(diagnostics.unresolvedScopes.length,0);assert.equal(diagnostics.companyHealthComplete,false)
})

for(const hidden of ['hidden','aria-hidden="true"','style="display:none"'])test(`native template closing tags cannot expose a ${hidden} description through the full wrapper`,async()=>{
 const base=fixture(),id=f.indiaRows[0].id,jobs=await run({...base,fetchJson:async(u,o)=>{const p=await base.fetchJson(u,o);if(u.includes('position_details')&&p.data.id===id)p.data.jobDescription=`<div ${hidden}><template></div></template><p>Design and build production systems. Own delivery and testing for core services.</p></div>`;return p}}),job=jobs.find(j=>j.jobId===id)
 assert.equal(jobs.length,4);assert.equal(job.jobDescription,null);assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceListingComplete,false);assert.equal(readBostonScientificDiagnostics(jobs).companyHealthComplete,false)
 assert.equal(jobs.filter(j=>j.sourceDetailComplete).length,3)
})

test('a real visible native description following a hidden template remains intact',async()=>{
 const baseline=await run(fixture()),base=fixture(),id=f.indiaRows[0].id,jobs=await run({...base,fetchJson:async(u,o)=>{const p=await base.fetchJson(u,o);if(u.includes('position_details')&&p.data.id===id)p.data.jobDescription='<div hidden><template></div></template><p>Hidden fake description.</p></div>'+p.data.jobDescription;return p}})
 assert.equal(jobs.find(j=>j.jobId===id).jobDescription,baseline.find(j=>j.jobId===id).jobDescription);assert.ok(jobs.every(j=>j.sourceDetailComplete===true))
})
