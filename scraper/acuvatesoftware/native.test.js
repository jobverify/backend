import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'

// External I/O is replaced before loading any backend module.
globalThis.fetch = async () => { throw new Error('OFFLINE_GLOBAL_FETCH_TRIPWIRE') }
const { getScraperCatalog, createCatalogScraper } = await import('../../scraper-support/providers/index.js')
const { readInventoryEvidence } = await import('../../scraper-support/utils/inventoryEvidence.js')
const ROOT='https://acuvate.com/', BOARD=ROOT+'careers/', CONTACT=ROOT+'contact-us/'
const now=()=> '2026-10-27T12:00:00.000Z'
const load=async name=>gunzipSync(await fs.readFile(new URL('./fixtures/'+name+'-20261027.gz',import.meta.url))).toString('utf8')
const run=async(pages,options={})=>{
 const requests=[],audits=[]
 const provider=getScraperCatalog().find(p=>p.source==='acuvatesoftware')
 const fetchPage=async url=>{
  requests.push(url);const p=typeof pages==='function'?await pages(url,requests):pages[url]
  assert.ok(p,'Unexpected URL '+url)
  return typeof p==='string'?{url,status:200,body:p}: {url,...p}
 }
 const jobs=await createCatalogScraper(provider).run({now,fetchPage,fetchText:async url=>{const p=await fetchPage(url);if(p.status!==200)throw Error('public access denied '+p.status);return p.body},onAudit:a=>audits.push(a),...options})
 return {jobs,requests,audit:audits.at(-1),evidence:readInventoryEvidence(jobs)}
}
const home='<html><head><title>Acuvate</title></head><body><a href="/careers/">Careers</a></body></html>'
const row=({id='future-1',title='Future Engineer',country='India',body='Design production systems. Required qualifications: Engineering degree. Required skills: JavaScript.',extra='',style=''}={})=>`<section class="elementor-inner-section" data-job-id="${id}" style="${style}"><h3>${title}</h3><div class="panel-location"><strong>Location:</strong> Hyderabad${country?', '+country:''}</div><div class="panel-location"><strong>Experience:</strong> 5 years</div><div class="elementor-tab-title" id="title-${id}" role="button" data-tab="1" aria-controls="content-${id}" aria-expanded="true">Click here to know more</div><div id="content-${id}" class="elementor-tab-content" data-tab="1" role="region" aria-labelledby="title-${id}"><p>${body}</p>${extra}</div><a href="#fill_the_form">Apply Now</a></section>`
const board=rows=>`<html><head><title>Culture &amp; Careers | Acuvate</title><link rel="canonical" href="${BOARD}"></head><body><h2>Open Opportunities at Acuvate</h2><section id="jobs">${rows}</section><section id="fill_the_form"><h2>Apply</h2></section></body></html>`

test('current captured five real Elementor roles survive registered extraction; missing UK locale prevents authoritative totals',async()=>{
 const careers=await load('careers'),frontend=await load('frontend')
 const frontendUrl=[...careers.matchAll(/https?:[^\s"'<>]+\.js/gi)].map(m=>m[0]).find(s=>/\/elementor\/.*\.frontend\.min\.js$/.test(s))
 const r=await run({[BOARD]:careers,[ROOT]:await load('home'),[CONTACT]:await load('contact'),[ROOT+'uk/careers/']:{status:404,body:await load('uk-careers-404')},[ROOT+'uk/']:{status:404,body:await load('uk-home-404')},[frontendUrl]:frontend,[ROOT+'wp-content/plugins/elementor/assets/js/chunks/toggle.min.js?ver=4.3.5']:await load('toggle')})
 assert.equal(r.jobs.length,5)
 assert.deepEqual(r.jobs.map(j=>j.title),['Sr D365 Developer (Power Platform)','Project Manager','Magento Developer with major focus on PWA','CUX Designer','Agentic AI Architect'])
 for(const j of r.jobs){assert.equal(j.nativeCountry,null);assert.equal(j.country,'India');assert.equal(j.sourceNativeCountryEvidence.basis,'exact-current-employer-worksite');assert.equal(j.jobId,null);assert.equal(j.requisitionId,null);assert.equal(j.legalEmployer,null);assert.equal(j.remoteStatus,null);assert.equal(j.postingDate,null);assert.equal(j.closingDate,null);assert.ok(j.sourceDescription.length>900);assert.equal(j.sourceDetailComplete,true);assert.equal(j.sourceCleanupEligible,false);assert.match(j.sourceUrl,/#elementor-tab-content-/)}
 assert.equal(r.audit.observedGlobalCount,5);assert.equal(r.audit.fullHealthyIndia,5);assert.equal(r.audit.closingReconciled,true)
 assert.match(r.jobs[0].requiredSkills.join('\n'),/Power Apps/)
 assert.match(r.jobs[1].preferredQualification,/Agile|Scrum|AI/i)
 assert.doesNotMatch(r.jobs[4].minimumQualification,/Contributions to open-source/)
 assert.equal(r.evidence.listingComplete,false);assert.equal(r.evidence.reportedTotal,null);assert.equal(r.evidence.indiaFacetCount,null)
 assert.ok(r.audit.reasons.some(x=>x.includes('404')))
 assert.equal(r.requests.length,14)
})
test('synthetic future explicit India can become complete at runtime without hardcoded current titles',async()=>{
 const r=await run({[ROOT]:home,[BOARD]:board(row())})
 assert.equal(r.jobs.length,1);assert.equal(r.jobs[0].jobId,'future-1');assert.equal(r.jobs[0].requisitionId,null)
 assert.equal(r.jobs[0].nativeCountry,'India');assert.equal(r.evidence.listingComplete,true);assert.equal(r.evidence.indiaFacetCount,1)
 assert.equal(r.audit.cleanupEligible,true);assert.equal(r.audit.eligibleCount,1)
})
test('synthetic no exact worksite leaves Hyderabad country unresolved',async()=>{
 const r=await run({[ROOT]:home,[BOARD]:board(row({country:''}))})
 assert.equal(r.jobs.length,0);assert.equal(r.audit.nativeJobs[0].country,null);assert.equal(r.evidence.listingComplete,false);assert.equal(r.evidence.indiaFacetCount,null)
})
test('synthetic hidden roles and hidden description text cannot become jobs or full criteria',async()=>{
 const r=await run({[ROOT]:home,[BOARD]:board(row({id:'hidden',style:'display:none'})+row({extra:'<div hidden>INVISIBLE CRITERIA</div><script>FAKE CRITERIA</script><template>OTHER CRITERIA</template>'}))})
 assert.equal(r.jobs.length,1);assert.doesNotMatch(r.jobs[0].sourceDescription,/INVISIBLE|FAKE|OTHER/)
})
test('synthetic closing criteria change withholds changed roles and cleanup',async()=>{
 let n=0;const r=await run(url=>url===ROOT?home:board(row({body:++n===1?'Design production systems. Engineering degree required.':'Changed production responsibilities. Engineering degree required.'})))
 assert.equal(r.jobs.length,0);assert.equal(r.audit.closingReconciled,false);assert.equal(r.evidence.listingComplete,false)
})
test('synthetic cap follows complete all-country enumeration and reconciliation',async()=>{
 const r=await run({[ROOT]:home,[BOARD]:board(row()+row({id:'future-2'})+row({id:'global-1',country:'United Kingdom'}))},{maxJobs:1})
 assert.equal(r.jobs.length,1);assert.equal(r.audit.observedGlobalCount,3);assert.equal(r.audit.indiaJobCount,2);assert.equal(r.evidence.reportedTotal,null);assert.equal(r.evidence.listingComplete,false);assert.equal(r.audit.outputCapped,true)
})
for(const status of [401,403,429])test('synthetic initial denial '+status+' stops before any other source request',async()=>{
 let calls=0;await assert.rejects(run(()=>{calls++;return {status,body:'Access denied'}}),/denied/i);assert.equal(calls,1)
})
test('synthetic expired role is ineligible while date precision and secondary sites are preserved',async()=>{
 const r=await run({[ROOT]:home,[BOARD]:board(row({extra:'<p>Secondary Location: London, United Kingdom</p><p>Posted on: 2026-10-01</p><p>Closing date: 2026-10-26</p><p>Requisition ID: FORMAL-9</p>'}))})
 assert.equal(r.jobs[0].postingDate,'2026-10-01');assert.equal(r.jobs[0].closingDate,'2026-10-26');assert.equal(r.jobs[0].requisitionId,'FORMAL-9');assert.equal(r.audit.eligibleCount,0);assert.equal(r.jobs[0].secondaryLocations[0].country,'United Kingdom')
})
test('synthetic CSS-hidden native detail is incomplete and never eligible',async()=>{
 const r=await run({[ROOT]:home,[BOARD]:board(row()).replace('</head>','<style>.elementor-tab-content { display:none }</style></head>')})
 assert.equal(r.audit.nativeJobs[0].sourceDescription,null);assert.equal(r.audit.eligibleCount,0);assert.equal(r.evidence.listingComplete,false)
})
test('synthetic explicit role withdrawal is absent from eligible output',async()=>{
 const r=await run({[ROOT]:home,[BOARD]:board(row({extra:'<p>Status: Withdrawn</p>'}))})
 assert.equal(r.audit.nativeJobs[0].sourceAvailability,'closed');assert.equal(r.jobs.length,0);assert.equal(r.audit.eligibleCount,0)
})
test('synthetic unknown extra role prevents complete totals while stable healthy India remains usable',async()=>{
 const r=await run({[ROOT]:home,[BOARD]:board(row()+row({id:'unresolved',country:''}))})
 assert.equal(r.jobs.length,1);assert.equal(r.audit.observedGlobalCount,2);assert.equal(r.audit.fullHealthyIndia,1);assert.equal(r.evidence.listingComplete,false);assert.equal(r.evidence.reportedTotal,null)
})
test('synthetic visible embedded hiring surface cannot be silently omitted from scope',async()=>{
 const r=await run({[ROOT]:home,[BOARD]:board(row()).replace('</body>','<iframe src="https://hiring.example.test/public-board"></iframe></body>')})
 assert.equal(r.evidence.listingComplete,false);assert.ok(r.audit.reasons.some(s=>s.includes('embedded')))
})
test('synthetic HTTP 200 explicit bot gate stops the complete source immediately',async()=>{
 let calls=0;await assert.rejects(run(()=>{calls++;return '<title>Just a moment</title><div id="challenge-form"></div>'}),/denied/i);assert.equal(calls,1)
})
test('synthetic explicit visible no-openings state can become verified empty after closing reconciliation',async()=>{
 const r=await run({[ROOT]:home,[BOARD]:board('<p>No current openings. Please check back later.</p>')})
 assert.equal(r.jobs.length,0);assert.equal(r.evidence.status,'verified-empty');assert.equal(r.evidence.listingComplete,true);assert.equal(r.evidence.indiaFacetCount,0)
})
test('synthetic closing worksite country change withdraws previously inferred India output',async()=>{
 const careers=board(row({country:''})),contactUrl=ROOT+'contact-us/'
 const corporate=home.replace('</body>','<a href="/contact-us/">Contact Us</a></body>')
 let contacts=0
 const r=await run(url=>url===ROOT?corporate:url===BOARD?careers:`<title>Acuvate Offices</title><div class="elementor-column"><span class="litho-primary-title litho-heading">Hyderabad (${++contacts===1?'India':'United Kingdom'})</span><div class="elementor-widget-text-editor">Hyderabad office, Building 1, 500081</div></div>`)
 assert.equal(r.jobs.length,0);assert.equal(r.audit.closingReconciled,false);assert.equal(r.evidence.listingComplete,false);assert.equal(r.evidence.indiaFacetCount,null)
})
