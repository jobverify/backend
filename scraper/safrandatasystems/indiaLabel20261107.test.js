import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {run,buildIndiaSearchUrl,extractJobCards} from './script.js'
const fixture=new URL('./test-data/india-label-current-20261107/',import.meta.url)
const manifest=JSON.parse(readFileSync(new URL('manifest.json',fixture)))
const rows=manifest.records.map(row=>{const bytes=gunzipSync(readFileSync(new URL(row.file,fixture)));assert.equal(bytes.length,row.bodyBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.bodySHA256);return{...row,body:bytes.toString('utf8')}})
const fifth=rows[4].body
function changeTitle(body,change){const title=body.match(/<title[^>]*>[\s\S]*?<\/title>/i)[0],next=change(title);assert.notEqual(title,next);return body.replace(title,next)}
function partial(change=x=>x){const calls=[],boundary=Object.freeze({unobservedPage:6,noInventoryClaim:true});return{calls,boundary,fetchText:async url=>{calls.push(url);const row=rows[calls.length-1];if(!row){assert.equal(url,buildIndiaSearchUrl(6));throw boundary}assert.equal(url,row.url);return row.sequence===5?change(row.body):row.body}}}
test('genuine5 current India listing responses accept both witnessed labels and reach only unobserved page6',async()=>{
 const context=partial();await assert.rejects(run({fetchText:context.fetchText}),error=>error===context.boundary)
 assert.deepEqual(context.calls,Array.from({length:6},(_,i)=>buildIndiaSearchUrl(i+1)))
 assert.equal(manifest.nativeGroupReportedTotal,203);assert.equal(manifest.observedPages,5);assert.equal(manifest.SDSDetailReads,0)
})
for(const[label,change,pattern]of[
 ['unknown CountryX label',html=>changeTitle(html,s=>s.replace('/ Country :','/ CountryX :')),/identity, count or page/],
 ['unreviewed Continent label',html=>changeTitle(html,s=>s.replace('/ Country :','/ Continent :')),/identity, count or page/],
 ['additional label authority',html=>changeTitle(html,s=>s.replace('/ Country :','/ Country : India / Country :')),/identity, count or page/],
 ['foreign title country',html=>changeTitle(html,s=>s.replace('Asie-->Inde','Asie-->Chine')),/identity, count or page/],
 ['India-prefix country name',html=>changeTitle(html,s=>s.replace('Asie-->Inde','Asie-->Indiana')),/identity, count or page/],
 ['changed title count',html=>changeTitle(html,s=>s.replace('203 offres','204 offres')),/identity, count or page/],
 ['different requested page',html=>changeTitle(html,s=>s.replace('page 5','page 4')),/identity, count or page/],
 ['wrong native RSS facet',html=>html.replace('Rss_Country=81','Rss_Country=84'),/identity, count or page/],
 ['mismatched native card reference',html=>{const card=extractJobCards(html)[0],block=html.match(/<li class="ts-offer-list-item offerlist-item [\s\S]*?<ul class="ts-offer-list-item__description [\s\S]*?<\/ul>/i)[0],anchor=block.match(/<a[^>]*class="[^"]*\bts-offer-list-item__title-link\b[^"]*"[^>]*>[\s\S]*?<\/a>/i)[0],changed=html.replace(anchor,anchor.replace('_'+card.jobId+'.aspx','_999999.aspx'));assert.equal(extractJobCards(changed)[0].jobId,'999999');return changed},/unverified job identity/],
])test('finite label repair still rejects synthetic '+label,async()=>{
 const mutated=change(fifth);assert.notEqual(mutated,fifth);const context=partial(change)
 await assert.rejects(run({fetchText:context.fetchText}),pattern);assert.equal(context.calls.length,5)
})
// Historical full native proof is retained unchanged; these mutations assert
// employer/workplace guards, not a current203-role inventory or new aliases.
const history=JSON.parse(readFileSync(new URL('../../scraper-support/tests/fixtures/safrandatasystems-india/native-group-india.json',import.meta.url),'utf8'))
const target=Object.entries(history.details).find(([url])=>url.endsWith('_'+history.verifiedSdsIndiaIds[0]+'.aspx'))
assert.ok(target)
const owner=target[1].match(/Safran Data Systems India(?: - Hoodi| - West Shenoy Nagar)? \(Captronic\)/)[0]
const changeOwner=(html,value)=>{const meta=html.match(/<meta[^>]+name="Description"[^>]*>/i)[0],changed=meta.replace(owner,value);assert.notEqual(changed,meta);return html.replace(meta,changed)}
const historicalFetcher=change=>async url=>{const parsed=new URL(url);if(parsed.pathname.endsWith('liste-offres.aspx'))return history.pages[Number(parsed.searchParams.get('page')||1)-1];assert.ok(history.details[url]);return url===target[0]?change(history.details[url]):history.details[url]}
test('Country label support cannot alias an unreviewed Data Systems employer',async()=>{
 await assert.rejects(run({fetchText:historicalFetcher(html=>changeOwner(html,'Safran Data Systems India Unreviewed Division'))}),/employer alias is unverified/)
})
test('Country label support cannot project a group employer as Data Systems',async()=>{
 const jobs=await run({fetchText:historicalFetcher(html=>changeOwner(html,'Safran Group'))})
 assert.deepEqual(jobs.map(job=>job.jobId).sort(),history.verifiedSdsIndiaIds.filter(id=>id!==history.verifiedSdsIndiaIds[0]).sort())
 assert.ok(jobs.every(job=>job.employerLegalName.startsWith('Safran Data Systems India')))
})
test('Country label support cannot replace an own role explicit India workplace with France',async()=>{
 await assert.rejects(run({fetchText:historicalFetcher(html=>{const changed=html.replace('Asia, India','Europe, France').replace('Asie, Inde','Europe, France');assert.notEqual(changed,html);return changed})}),/detail identity or workplace country conflicts/)
})

test('actual215 registered response replay retains six exact Data Systems roles and partial company scope',async()=>{
 const {replayActualRegisteredSafran}=await import('./test-data/india-label-current-20261107/replay-registered.mjs')
 const proof=await replayActualRegisteredSafran();assert.equal(proof.requests,215);assert.equal(proof.entireOutputDeepEqualExceptNamedClocks,true);assert.equal(proof.ignoredRuntimeFields.length,7);assert.deepEqual(proof.ignoredRoleOrBusinessFields,[])
})
