import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parseEverstageListing,runNativeEverstage,EMBED,CAREERS} from './nativeRun.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261116.json.gz',import.meta.url))))
const decode=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8')
const listing=()=>gunzipSync(fs.readFileSync(new URL('./fixtures/current-listing-20261116.html.gz',import.meta.url))).toString('utf8')
const changed=(html,mutate)=>html.replace(/(<script[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,(_,a,b,c)=>{const n=JSON.parse(b);mutate(n);return a+JSON.stringify(n)+c})
const items=n=>n.props.pageProps.dehydratedState.queries.find(q=>q.queryKey?.[2]==='job-posts').state.data.items

test('current original packets retain exact body hashes',()=>{
 for(const p of fixture().packets){const raw=Buffer.from(p.bodyBase64,'base64');assert.equal(raw.length,p.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),p.sha256)}
})
test('current listing preserves seven location rows and the five India identities including the authored title space',()=>{
 const value=parseEverstageListing(listing(),200)
 assert.equal(value.items.length,7);assert.equal(value.groups.length,5)
 assert.ok(value.groups.every(g=>g.india===true))
 assert.equal(value.groups[0].identity.name,'BDR/ Senior BDR (Outbound, US Market) ')
 assert.equal(value.groups[0].locations.length,2)
})
for(const [label,mutate] of [
 ['unreviewed doubled trailing space',n=>{for(const row of items(n).filter(r=>r.id==='1145846f-d627-4e0b-b386-401ea5e0fa7c'))row.name+=' '}],
 ['leading space',n=>{for(const row of items(n).filter(r=>r.id==='1145846f-d627-4e0b-b386-401ea5e0fa7c'))row.name=' '+row.name}],
 ['tab whitespace',n=>{for(const row of items(n).filter(r=>r.id==='1145846f-d627-4e0b-b386-401ea5e0fa7c'))row.name=row.name.trim()+'\t'}],
 ['different role raw title',n=>{for(const row of items(n).filter(r=>r.id==='81087ce5-8949-4a11-8db7-795cf78b84f4'))row.name+=' '}],
 ['duplicate identity conflict',n=>{items(n)[1].name='Other BDR'}],
 ['country conflict',n=>{items(n)[0].locations[0].countryCode='US'}],
 ['tenant conflict',n=>{n.props.pageProps.apiData.jobBoard.slug='other'}],
])test('current listing rejects '+label,()=>assert.throws(()=>parseEverstageListing(changed(listing(),mutate),200)))
test('current reviewed whitespace never permits a changed rendered title',()=>assert.throws(()=>parseEverstageListing(listing().replaceAll('>BDR/ Senior BDR (Outbound, US Market) <','>Other BDR<'),200),/rendered title/))

async function attempt(change=()=>{}){
 const packets=fixture().packets.map(p=>({...p,body:decode(p)}));change(packets)
 const calls=[],counts=new Map()
 const jobs=await runNativeEverstage({now:'2026-11-16T20:00:00.000Z',fetchImpl:async(url,options)=>{
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.ok(options.signal)
  const matches=packets.filter(p=>p.requestedURL===url),i=counts.get(url)??0,p=matches[Math.min(i,matches.length-1)]
  assert.ok(p,'Unexpected request '+url);counts.set(url,i+1);calls.push(url)
  return{status:p.status,url:p.url,text:async()=>p.body}
 }})
 return{jobs,calls}
}
test('current full native role/app workflow keeps five typed India jobs and all company-scope holds',async()=>{
 const {jobs,calls}=await attempt();assert.equal(calls.length,17);assert.equal(jobs.length,5)
 assert.equal(calls.filter(u=>u===EMBED).length,2);assert.equal(calls.filter(u=>u===CAREERS).length,2)
 const bdr=jobs.find(j=>j.jobId==='1145846f-d627-4e0b-b386-401ea5e0fa7c')
 assert.equal(bdr.title,'BDR/ Senior BDR (Outbound, US Market)')
 assert.equal(bdr.nativeJobPost.name,bdr.title+' ');assert.equal(bdr.nativeListingRecords[0].name,bdr.title+' ')
 for(const j of jobs){assert.equal(j.country,'India');assert.equal(j.nativeEmployer,'Everstage Inc.');assert.equal(j.sourceDetailComplete,true);assert.ok(j.jobDescription.length>1000);assert.equal(j.applicationSubmitted,false);assert.equal(j.sourceScopeComplete,false);assert.equal(j.sourceListingComplete,false);assert.equal(j.sourceIndiaJobCount,null);assert.equal(j.sourceGlobalJobCount,null);assert.equal(j.postedAt,null);assert.equal(j.nativePublicationDate,null)}
 const proof=readInventoryEvidence(jobs);assert.equal(proof.status,'coverage-gap');assert.equal(proof.listingComplete,false);assert.equal(proof.reportedTotal,null)
})
for(const [label,mutate,expected] of [
 ['changed application raw title',p=>{p.body=changed(p.body,n=>{n.props.pageProps.apiData.jobPost.name=n.props.pageProps.apiData.jobPost.name.trim()})},/title.*identity/],
 ['new app dependency',p=>{p.body=p.body.replaceAll('_app-adc50512ab52b557.js','_app-0000000000000000.js')},/client declaration context/],
 ['incomplete role criteria',p=>{p.body=changed(p.body,n=>{n.props.pageProps.apiData.jobPost.description.role='<p>Apply now</p>'})},/substantive core role/],
])test('current native workflow rejects '+label,()=>assert.rejects(attempt(packets=>{
 const packet=packets.find(p=>p.requestedURL.endsWith('1145846f-d627-4e0b-b386-401ea5e0fa7c/apply'));mutate(packet)
}),expected))
