import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(import.meta.dirname+'/fixtures/runtime-native-20261021.json.gz')))
const C='https://www.everstage.com/careers',E='https://ats.rippling.com/embed/everstage/jobs?s=https%3A%2F%2Fwww.everstage.com%2Fcareers'
const id='b27b64c9-467c-4fbc-8581-55d76888ae0d',R='https://ats.rippling.com/en-US/everstage/jobs/'+id,A=R+'/apply'
const next=(pages,url,fn)=>{pages[url]=pages[url].replace(/(<script[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,(_,a,b,c)=>{const n=JSON.parse(b);fn(n,n.props.pageProps.apiData);return a+JSON.stringify(n)+c})}
const attempt=(change=()=>{},extra={})=>{const pages=fixture();change(pages);const seen={};return run({now:'2026-10-21T19:38:20.000Z',fetchImpl:async(url,o)=>{assert.equal(o.method,'GET');assert.ok(Object.hasOwn(pages,url),'Unadvertised URL: '+url);seen[url]=(seen[url]||0)+1;const body=typeof pages[url]==='function'?pages[url](seen[url]):pages[url];return{status:200,url,text:async()=>body}},...extra})}
test('typed Remote India roles keep unknown city and state without blocking the board', async () => {
 const jobs = await attempt(p => {
  next(p, E, n => { n.props.pageProps.dehydratedState.queries[0].state.data.items[0].locations = [
   { name: 'Remote, India', country: 'India', countryCode: 'IN', state: null, stateCode: null, city: null, workplaceType: 'REMOTE' },
  ] })
  for (const url of [R, A]) next(p, url, (n, a) => { a.jobPost.workLocations = ['Remote, India']; if (a.workLocations != null) a.workLocations = ['Remote, India'] })
 })
 const job = jobs.find(j => j.jobId === id)
 assert.equal(job.country, 'India')
 assert.equal(job.city, null)
 assert.equal(job.state, null)
 assert.equal(job.location, 'Remote, India')
})
test('four unique full India roles aggregate native duplicate locations and keep unknown dates and scope',async()=>{const jobs=await attempt();assert.equal(jobs.length,4);const j=jobs.find(j=>j.jobId.startsWith('81087'));assert.deepEqual(j.locations,['Hyderabad, India','Chennai, India']);assert.equal(j.postedAt,null);assert.equal(j.nativePublicationDate,null);assert.equal(j.nativeClosingDate,null);assert.ok(j.nativeCreatedOn);assert.equal(j.sourceIndiaJobCount,null);assert.equal(j.sourceListingComplete,false);assert.equal(j.sourceScopeComplete,false);assert.equal(j.applyUrl,j.sourceUrl+'/apply');assert.ok(j.sourceDescription.includes('Engage with Customers'));assert.ok(j.nativeDescriptionHtml.role);assert.equal(readInventoryEvidence(jobs).listingComplete,false)})
const rejects=(name,change,pattern=/Everstage native/i)=>test(name,()=>assert.rejects(attempt(change),pattern))
rejects('official stale or inert widget is rejected',p=>{p[C]=p[C].replace('id="rr-job-board"','hidden id="rr-job-board"')})
rejects('official wrong tenant is rejected',p=>{p[C]=p[C].replace('data-job-board-id="everstage"','data-job-board-id="other"')})
rejects('official custom RR_BASE_URL cannot silently change tenant origin',p=>{p[C]+='<script>window.RR_BASE_URL="https://example.com"</script>'})
rejects('native job pagination activation fails closed',p=>next(p,E,n=>{n.props.pageProps.dehydratedState.queries[0].state.data.totalPages=2}))
rejects('native envelope total mismatch fails closed',p=>next(p,E,n=>{n.props.pageProps.dehydratedState.queries[0].state.data.totalItems=6}))
rejects('native failed query does not become empty',p=>next(p,E,n=>{n.props.pageProps.dehydratedState.queries[0].state.status='error'}))
rejects('native empty board is not company zero',p=>next(p,E,n=>{n.props.pageProps.dehydratedState.queries[0].state.data.items=[]}))
rejects('native altered filters rejected',p=>next(p,E,n=>{n.props.pageProps.dehydratedState.queries[0].queryKey[4].country='IN'}))
rejects('native test board rejected',p=>next(p,E,(n,a)=>{a.jobBoard.isTest=true}))
rejects('native foreign country with India city rejected',p=>next(p,E,n=>{n.props.pageProps.dehydratedState.queries[0].state.data.items[0].locations[0].countryCode='US'}))
rejects('native India country with foreign city rejected',p=>next(p,E,n=>{n.props.pageProps.dehydratedState.queries[0].state.data.items[0].locations[0].city='London'}))
rejects('native state country contradiction rejected',p=>next(p,E,n=>{n.props.pageProps.dehydratedState.queries[0].state.data.items[0].locations[0].state='California'}))
rejects('same job identity with a different title is not merged',p=>next(p,E,n=>{n.props.pageProps.dehydratedState.queries[0].state.data.items[2].name='Another title'}))
rejects('exact duplicate location row rejected',p=>next(p,E,n=>{const a=n.props.pageProps.dehydratedState.queries[0].state.data.items;a[2]=a[1]}))
rejects('detail wrong UUID rejected',p=>next(p,R,(n,a)=>{a.jobPost.uuid='81087ce5-8949-4a11-8db7-795cf78b84f4'}))
rejects('detail wrong canonical rejected',p=>{p[R]=p[R].replace('href="https://ats.rippling.com/everstage/jobs/'+id+'"','href="https://ats.rippling.com/other/jobs/'+id+'"')})
rejects('detail wrong Open Graph title rejected',p=>{p[R]=p[R].replace('content="Business Development Representative (Outbound) | Everstage Inc."','content="Wrong | Everstage Inc."')})
rejects('detail unlisted status rejected',p=>next(p,R,(n,a)=>{a.jobPost.unlistedFromSearch=true}))
rejects('detail native board mismatch rejected',p=>next(p,R,(n,a)=>{a.jobPost.board.slug='other'}))
rejects('missing core role cannot be filled by company pitch',p=>next(p,R,(n,a)=>{a.jobPost.description.role=a.jobPost.description.company}))
rejects('instruction only role is not full JD',p=>next(p,R,(n,a)=>{a.jobPost.description.role='<p>Please click apply to view full job description.</p>'.repeat(8)}))
rejects('detail text truncation versus native role rejected',p=>{p[R]=p[R].replace('Representing Everstage and being the spokesperson for the product.</span>','Truncated.</span>')})
rejects('native closed role rejected',p=>next(p,R,(n,a)=>{a.jobPost.description.role+='<p>This job is no longer available.</p>'}))
rejects('detail geography mismatch rejected',p=>next(p,R,(n,a)=>{a.jobPost.workLocations=['Chennai, India']}))
rejects('disabled apply controls rejected',p=>{p[R]=p[R].replaceAll('data-testid="Apply now"','disabled data-testid="Apply now"')})
rejects('application wrong query UUID rejected',p=>next(p,A,n=>{n.query.jobId='81087ce5-8949-4a11-8db7-795cf78b84f4'}))
rejects('application wrong job UUID rejected',p=>next(p,A,(n,a)=>{a.jobPost.uuid='81087ce5-8949-4a11-8db7-795cf78b84f4'}))
rejects('application missing required form config rejected',p=>next(p,A,(n,a)=>{a.jobPost.activeJobApplication=null}))
rejects('application different full JD rejected',p=>next(p,A,(n,a)=>{a.jobPost.description.role+='<p>Different duties.</p>'}))
rejects('past known closing fallback rejected',p=>next(p,R,(n,a)=>{a.jobPost.validThrough='2026-10-20T00:00:00Z'}))
rejects('future unqualified publication contract rejected',p=>next(p,R,(n,a)=>{a.jobPost.datePosted='2026-10-25T00:00:00Z'}))
rejects('native schema activation requires explicit contract qualification',p=>next(p,R,(n,a)=>{a.jobPost.jsonLd={'@type':'JobPosting',validThrough:'2026-10-20T00:00:00Z'}}))
rejects('listing drift rejected',p=>{const first=p[E];p[E]=n=>n===1?first:first.replace('Business Development Representative (Outbound)','Changed title')})
test('truncation option rejected',()=>assert.rejects(attempt(()=>{},{maxJobs:1}),/truncation/i))
test('HTTP failure preserved',()=>assert.rejects(run({fetchImpl:async url=>({status:403,url,text:async()=>''})}),/403|HTTP/))
rejects('application client contract changes are not treated as a working form',p=>{const k=Object.keys(p).find(k=>/\/apply-[a-f0-9]+\.js$/.test(k));p[k]+='/* changed */'})
rejects('role client contract changes cannot invent application URLs',p=>{const k=Object.keys(p).find(k=>/\/%5BjobId%5D-[a-f0-9]+\.js$/.test(k));p[k]=p[k].replace('/apply','/bogus')})
rejects('redirect or arbitrary canonical equivalence rejected',p=>next(p,R,(n,a)=>{a.jobPost.url=R}))
rejects('application title contradiction rejected',p=>{p[A]=p[A].replace(/(<title\b[^>]*>)Apply for job post(<\/title>)/,'$1Other application$2')})
rejects('publication date alias cannot replace unknown original date',p=>next(p,R,(n,a)=>{a.jobPost.published_at='2026-10-15T00:00:00Z'}))
rejects('native listing top level country contradiction rejected',p=>next(p,E,n=>{n.props.pageProps.dehydratedState.queries[0].state.data.items[0].country='United States'}))
rejects('page department contradiction rejected',p=>next(p,R,(n,a)=>{a.department.name='Other'}))
rejects('closing conflict between native fields rejected',p=>next(p,R,(n,a)=>{a.jobPost.validThrough='2026-11-01T00:00:00Z';a.jobPost.closingDate='2026-11-02T00:00:00Z'}))
rejects('invalid closing calendar rejected',p=>next(p,R,(n,a)=>{a.jobPost.validThrough='2026-11-31T00:00:00Z'}))
test('future known native listing closing fallback is preserved independently from unknown publication',async()=>{const jobs=await attempt(p=>next(p,E,n=>{n.props.pageProps.dehydratedState.queries[0].state.data.items[0].validThrough='2026-11-01T00:00:00Z'}));const j=jobs.find(j=>j.jobId===id);assert.equal(j.closingDate,'2026-11-01T00:00:00.000Z');assert.equal(j.postedAt,null)})
test('genuinely absent company section leaves substantive core role complete',async()=>{const jobs=await attempt(p=>{for(const k of[R,A])next(p,k,(n,a)=>{a.jobPost.description.company=''});p[R]=p[R].replace(/(<div class="ATS_htmlPreview">)<div>[\s\S]*?<\/div>/,'$1')});assert.equal(jobs.length,4);assert.ok(jobs.find(j=>j.jobId===id).sourceDescription.startsWith('Responsibilities'))})
const coherentCore=(pages,role)=>{for(const k of[R,A])next(pages,k,(n,a)=>{a.jobPost.description.role=role});const d=readNativeDocument(pages[R]),data=d.nodes(n=>n.attrs.id==='__NEXT_DATA__')[0].raw,j=JSON.parse(data).props.pageProps.apiData.jobPost;pages[R]='<html><head><title>'+j.name+'</title><meta property="og:title" content="'+j.name+' | Everstage Inc."><link rel="canonical" href="'+j.url+'"></head><body><div class="ATS_htmlPreview">'+j.description.company+role+'</div><button data-testid="Apply now" data-disabled="false">Apply now</button>'+d.nodes(n=>n.tag==='script'&&n.attrs.src).map(n=>'<script src="'+n.attrs.src+'"></script>').join('')+'<script id="__NEXT_DATA__" type="application/json">'+data+'</script></body></html>'}
rejects('coherent full-surface company marketing cannot supply core role',p=>coherentCore(p,'<p>Everstage is your trusted company and your platform for customers worldwide. Your business can build relationships and improve financial operations with our innovative technology.</p>'))
rejects('coherent full-surface repeated instructions cannot supply core role',p=>coherentCore(p,'<p>Please click apply to view the full job description.</p>'.repeat(8)))
