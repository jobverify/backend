import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.fetch=()=>{throw Error('Offline Financial Times network tripwire')}
const load=()=>import('./script.js')
import { fixture,replay } from '../../scraper-support/native-sources/declaredGreenhouse/fixtureReplay.js'
const offices=[
 {id:1,name:'APAC',parent_id:null,child_ids:[2,3]},
 {id:2,name:'India',parent_id:1,child_ids:[3]},
 {id:3,name:'Bangalore',parent_id:2,child_ids:[]},
 {id:4,name:'North America',parent_id:null,child_ids:[5,6]},
 {id:5,name:'United States of America',parent_id:4,child_ids:[6]},
 {id:6,name:'Georgia',parent_id:5,child_ids:[]},
]
const role={id:101,internal_job_id:999,requisition_id:'JR123',title:'Platform Engineer',company_name:'Financial Times',
 absolute_url:'https://job-boards.eu.greenhouse.io/financialtimes33/jobs/101',location:{name:'Bangalore'},offices:[{id:3,name:'Bangalore',parent_id:2,child_ids:[]}],departments:[{id:7,name:'Technology'}],
 first_published:'2026-10-20T09:14:33-04:00',updated_at:'2026-10-27T18:30:00Z',application_deadline:'2026-11-20T12:00:00Z',
 content:'&lt;h2&gt;The role&lt;/h2&gt;&lt;p&gt;Build connectors &amp;amp; retain &amp;lt;literal&amp;gt; examples.&lt;/p&gt;&lt;h3&gt;Requirements&lt;/h3&gt;&lt;ul&gt;&lt;li&gt;Production API experience.&lt;/li&gt;&lt;li&gt;Database skills.&lt;/li&gt;&lt;/ul&gt;',metadata:[]}

test('FT country resolves through exact native office ancestry without interpreting a US-state office as Georgia country',async()=>{
 const mod=await load();assert.equal(typeof mod.buildOfficeGraph,'function')
 const graph=mod.buildOfficeGraph({offices})
 const india=mod.classifyFinancialTimesWorksites(role,graph)
 assert.equal(india.country,'India');assert.equal(india.complete,true)
 const us=mod.classifyFinancialTimesWorksites({...role,location:{name:'Georgia'},offices:[offices[5]]},graph)
 assert.equal(us.country,'United States');assert.equal(us.complete,true)
})

test('registered FT broader reader retains all genuine original posts, career surfaces and published program handoffs',async()=>{
 const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
 const r=replay();let records
 const jobs=await createCatalogScraper(getScraperCatalog().find(p=>p.source==='financialtimes')).run({...r.options,fetchJson:undefined,onRecords:value=>{records=value}})
 const audit=r.audits[0],expected=fixture.oracle.financialtimes.records
 assert.equal(audit.nativeInventoryComplete,true);assert.equal(records.length,expected.length)
 assert.ok(audit.openingSurfaces.pages.length>=19);assert.ok(audit.closingSurfaces.pages.length>=19)
 assert.ok(audit.additionalRecruitmentScopes.some(item=>item.url.includes('maisiefellowship')))
 assert.equal(audit.allOfficeAssignmentsAreAvailableWorksites,false)
 for(const row of expected){const job=records.find(job=>job.jobId===String(row.postId));assert.deepEqual(job.sourceNativeRecord,row.nativeFeedRecord)
  assert.equal(job.sourceNativeContentText,row.nativeContentText);assert.equal(job.jobDescription.replace(/\s+/g,' ').trim(),row.fullCriteriaText)
  assert.equal(job.postingDate,row.nativeFeedRecord.first_published);assert.equal(job.sourceScopeComplete,false)}
 assert.equal(jobs.length,0);assert.equal(audit.wholeCompanyIndia,null)
})

test('FT full native criteria decode transport and individual text leaves once and preserve original native identities/dates',async()=>{
 const mod=await load();assert.equal(typeof mod.parseFinancialTimesRole,'function')
 const job=mod.parseFinancialTimesRole(role,mod.buildOfficeGraph({offices}),{now:'2026-10-27T00:00:00Z'})
 assert.equal(job.jobId,'101');assert.equal(job.requisitionId,'JR123');assert.equal(job.internalJobId,999)
 assert.equal(job.postingDate,role.first_published);assert.equal(job.closingDate,role.application_deadline);assert.equal(job.sourceClosingDateIsExact,true)
 assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,true)
 for(const text of ['connectors & retain <literal> examples.','Production API experience.','Database skills.'])assert.ok(job.sourceDescription.includes(text))
 assert.equal(job.legalEmployer,null);assert.equal(job.employmentType,null);assert.equal(job.workMode,null)
})

test('FT original broader traversal awaits both audit and complete-record observers',async()=>{
 const m=await load(),t=transport();let auditDone=false,recordsDone=false
 await m.run({...t.options,onAudit:async()=>{await new Promise(resolve=>setTimeout(resolve,20));auditDone=true},onRecords:async()=>{await new Promise(resolve=>setTimeout(resolve,20));recordsDone=true}})
 assert.equal(auditDone,true);assert.equal(recordsDone,true)
})

test('FT retains original native records and never promotes a bounded source to whole-employer authority',async()=>{
 const m=await load(),t=transport();let audit,records
 const jobs=await m.run({...t.options,onAudit:value=>{audit=value},onRecords:value=>{records=value}})
 assert.equal(records.length,2);assert.deepEqual(records[0].sourceNativeRecord,role)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.wholeCompanyGlobal,null);assert.equal(audit.wholeCompanyIndia,null)
 assert.equal(jobs.sourceAudit.sourceScopeComplete,false)
})

test('FT retains earlier complete positives and closing-only originals when reconciliation is unavailable',async()=>{
 const m=await load(),t=transport();let calls=0,records,audit
 const original=t.options.fetchJson
 t.options.fetchJson=async url=>{if(url.includes('/jobs?')&&++calls===2)throw Error('closing unavailable');return original(url)}
 const jobs=await m.run({...t.options,onRecords:value=>{records=value},onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0);assert.equal(records.length,2);assert.equal(records[0].sourceDescription.includes('Database skills.'),true)
 assert.deepEqual(records[0].sourceNativeRecord,role);assert.equal(records[0].sourceCurrentNativeRoleQualified,false)
 assert.equal(audit.nativeInventoryComplete,false);assert.ok(audit.reasons.some(reason=>reason.includes('closing unavailable')))
 const changed=transport({closing:r=>r.jobs.push({...role,id:103,absolute_url:role.absolute_url.replace('/101','/103')} )})
 changed.options.fetchJson=async url=>{if(url.endsWith('/offices'))return{offices};const n=++calls;return{meta:{total:n>3?3:2},jobs:[role,{...role,id:102,absolute_url:role.absolute_url.replace('/101','/102')},...(n>3?[{...role,id:103,absolute_url:role.absolute_url.replace('/101','/103')}]:[])]}}
 calls=2;await m.run({...changed.options,onRecords:value=>{records=value}})
 assert.deepEqual(records.map(record=>record.jobId),['101','102','103']);assert.equal(records.at(-1).sourceCurrentNativeRoleQualified,false)
})

test('registered FT execution must stop current employer denial before reading the historical public API',async()=>{
 const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
 const calls=[]
 await assert.rejects(createCatalogScraper(getScraperCatalog().find(p=>p.source==='financialtimes')).run({
  fetchPage:async url=>{calls.push(url);return{status:403,url,body:'<title>Access denied</title>',contentType:'text/html'}},
  fetchJson:async()=>({meta:{total:1},jobs:[role]}),
 }),/403|denied/)
 assert.deepEqual(calls,['https://aboutus.ft.com/'])
})

test('FT rejects broken office graphs and mismatching native office identities',async()=>{
 const m=await load()
 for(const broken of [[...offices,offices[0]],offices.map(o=>o.id===3?{...o,parent_id:77}:o),offices.map(o=>o.id===2?{...o,parent_id:3}:o)])assert.throws(()=>m.buildOfficeGraph({offices:broken}),/office|cycle/i)
 assert.equal(m.classifyFinancialTimesWorksites({...role,offices:[{...role.offices[0],name:'Mumbai'}]},m.buildOfficeGraph({offices})).complete,false)
 assert.equal(m.classifyFinancialTimesWorksites({...role,location:{name:'Unknown City'}},m.buildOfficeGraph({offices})).complete,false)
})

test('FT broad regions need role-owned location evidence and primary alternatives are all resolved',async()=>{
 const m=await load(),nodes=[...offices,{id:7,name:'Singapore',parent_id:1,child_ids:[]}],g=m.buildOfficeGraph({offices:nodes})
 const apac={...role,location:{name:'APAC'},offices:[nodes.at(-1)]}
 assert.equal(m.classifyFinancialTimesWorksites(apac,g).complete,false)
 const known=m.classifyFinancialTimesWorksites({...apac,content:'&lt;p&gt;This role will be based in Singapore and work closely with colleagues.&lt;/p&gt;'},g)
 assert.equal(known.complete,true);assert.equal(known.country,'Singapore')
 const both=m.classifyFinancialTimesWorksites({...role,location:{name:'Bangalore; Georgia'}},g)
 assert.deepEqual(both.countries,['India','United States']);assert.equal(both.complete,false)
})

test('FT parser excludes hidden and inert criteria and never substitutes update time or invents absent fields',async()=>{
 const m=await load(),j=m.parseFinancialTimesRole({...role,first_published:null,application_deadline:null,requisition_id:null,content:role.content+'&lt;template&gt;NOT A REQUIREMENT&lt;/template&gt;&lt;p hidden&gt;SECRET&lt;/p&gt;&lt;span style="opacity:0"&gt;GHOST&lt;/span&gt;'},m.buildOfficeGraph({offices}))
 assert.equal(j.postingDate,null);assert.equal(j.closingDate,null);assert.equal(j.requisitionId,null)
 for(const v of ['NOT A REQUIREMENT','SECRET','GHOST'])assert.ok(!j.sourceDescription.includes(v))
 const uncertain=m.parseFinancialTimesRole({...role,content:role.content+'&lt;p style="display:var(--show)"&gt;uncertain&lt;/p&gt;'},m.buildOfficeGraph({offices}))
 assert.equal(uncertain.sourceDetailComplete,false)
 for(const drift of [{company_name:'Another company'},{absolute_url:'https://job-boards.eu.greenhouse.io/another/jobs/101'},{absolute_url:'https://job-boards.eu.greenhouse.io/financialtimes33/jobs/102'}])assert.throws(()=>m.parseFinancialTimesRole({...role,...drift},m.buildOfficeGraph({offices})),/employer|identity|board/i)
})

const html='<html><head><title>Careers | Financial Times</title></head><body><a href="/careers/">Careers</a><a href="https://boards.eu.greenhouse.io/financialtimes33/">Vacancies</a></body></html>'
const transport=(changes={})=>{
 const calls=[];let closing=false
 return {calls,options:{now:()=> '2026-10-27T00:00:00Z',fetchPage:async url=>{calls.push(url);return {url,status:200,body:html,contentType:'text/html'}},fetchJson:async url=>{calls.push(url);if(url.endsWith('/offices'))return {offices};const result={meta:{total:2},jobs:[role,{...role,id:102,absolute_url:role.absolute_url.replace('/101','/102')}]};if(closing&&changes.closing)changes.closing(result);closing=true;return result},...changes.options}}
}

// Artificial original-response-shaped controls, never fresh HTTP evidence.
const responseTransport=(mutate=()=>{})=>{
 let phase=0
 return{now:()=> '2026-10-31T00:00:00Z',fetchPage:async url=>{
  let body=html,type='text/html'
  if(url.endsWith('/jobs?content=true')){const payload={meta:{total:2},jobs:[structuredClone(role),{...structuredClone(role),id:102,absolute_url:role.absolute_url.replace('/101','/102')}]};mutate(payload,++phase);body=JSON.stringify(payload);type='application/json'}
  else if(url.endsWith('/offices')){body=JSON.stringify({offices});type='application/json'}
  else assert.ok(url==='https://aboutus.ft.com/'||url==='https://aboutus.ft.com/careers/')
  return{url,status:200,bodyBase64:Buffer.from(body).toString('base64'),headers:{'content-type':type}}
 }}
}

test('FT India results and both awaited complete-corpus observers are independently JSON serializable',async()=>{
 const m=await load();let auditCount=0,recordCount=0
 const jobs=await m.run({...responseTransport(),onAudit:async value=>{await new Promise(resolve=>setTimeout(resolve,5));assert.equal(JSON.parse(JSON.stringify(value)).observations.length,2);auditCount++},onRecords:async value=>{await new Promise(resolve=>setTimeout(resolve,5));assert.equal(JSON.parse(JSON.stringify(value)).length,2);recordCount++}})
 assert.equal(auditCount,1);assert.equal(recordCount,1);assert.equal(JSON.parse(JSON.stringify(jobs)).length,2)
 assert.deepEqual(jobs[0].sourceNativeRecord,role)
})

for(const phase of ['opening','closing'])test('FT malformed '+phase+' row preserves earlier healthy observations and full raw closing history',async()=>{
 const m=await load();let audit,records
 const jobs=await m.run({...responseTransport((data,n)=>{if(n===(phase==='opening'?1:2))data.jobs[1].first_published='2026-02-30T10:00:00Z'}),onAudit:value=>{audit=value;JSON.stringify(value)},onRecords:value=>{records=value;JSON.stringify(value)}})
 assert.deepEqual(jobs.map(job=>job.jobId),['101']);assert.equal(records.length,2);assert.equal(audit.observations.length,2)
 assert.deepEqual(records[0].sourceNativeRecord,role);assert.equal(records[1].sourceCurrentNativeRoleQualified,false)
 assert.ok(records[1].jobDescription.includes('Database skills.'))
 const invalid=phase==='opening'?records[1]:audit.observationHistory.find(pair=>pair.postId===102).current
 assert.equal(invalid.sourceNativeRecord.first_published,'2026-02-30T10:00:00Z');assert.ok(invalid.sourceNativeIssues.some(issue=>/calendar|date/.test(issue)))
})

test('FT role-owned typed Location metadata reconciles conflicts without replacing its primary-office policy',async()=>{
 const m=await load(),metadata=[{name:'Location',value_type:'single_select',value:'United States'}]
 const scope=m.classifyFinancialTimesWorksites({...role,metadata},m.buildOfficeGraph({offices}))
 assert.equal(scope.indiaEligible,false);assert.equal(scope.complete,false);assert.equal(scope.country,null)
 const jobs=await m.run(responseTransport(data=>{for(const row of data.jobs)row.metadata=metadata}))
 assert.equal(jobs.length,0);assert.equal(jobs.sourceAudit.allOfficeAssignmentsAreAvailableWorksites,false)
 assert.ok(jobs.sourceAudit.observations.every(job=>job.country===null&&job.location===null))
})

test('FT registered adapter reconciles complete native inventory before caps and retains native totals',async()=>{
 const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js');const {readInventoryEvidence}=await import('../../scraper-support/utils/inventoryEvidence.js')
 const t=transport();let audit;const jobs=await createCatalogScraper(getScraperCatalog().find(p=>p.source==='financialtimes')).run({...t.options,maxJobs:1,onAudit:a=>{audit=a}})
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'101');assert.equal(audit.nativePostings,2);assert.equal(audit.indiaVacancies,2)
 assert.equal(t.calls.filter(u=>u.includes('/jobs?')).length,2);assert.equal(t.calls.filter(u=>u.endsWith('/offices')).length,2)
 assert.equal(readInventoryEvidence(jobs).status,'discovery-only');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 const full=await createCatalogScraper(getScraperCatalog().find(p=>p.source==='financialtimes')).run(transport().options)
 assert.equal(readInventoryEvidence(full).status,'discovery-only');assert.equal(readInventoryEvidence(full).reportedTotal,null)
})

test('FT refuses total truncation, changed closing capture, corporate drift, and aborted requests',async()=>{
 const m=await load()
 const changed=transport({closing:r=>{r.jobs[1].content+='changed'}});const partial=await m.run(changed.options)
 assert.equal(partial.sourceAudit.complete,false);assert.ok(partial.sourceAudit.reasons.some(r=>/closing/.test(r)))
 const truncated=transport({options:{fetchJson:async u=>u.endsWith('/offices')?{offices}:{meta:{total:3},jobs:[role]}}})
 await assert.rejects(m.run(truncated.options),/total|truncat/i)
 await assert.rejects(m.run({...transport().options,fetchPage:async u=>({url:u,status:200,body:html.replaceAll('financialtimes33','another')})}),/handoff|binding/i)
 const c=new AbortController();c.abort();const aborted=transport();await assert.rejects(m.run({...aborted.options,signal:c.signal}),/abort/i);assert.equal(aborted.calls.length,0)
})

test('FT retains complete primary proof but stops at denied advertised fellowship information and withholds company totals',async()=>{
 const m=await load(),t=transport(),original=t.options.fetchPage
 t.options.fetchPage=async url=>url.startsWith('https://aboutus.ft.com/')?{...(await original(url)),body:html.replace('</body>','<a href="https://www.ft.com/maisiefellowship">Maisie Hylton Fellowship</a><a href="https://www.ft.com/brittanfellowship">Sir Samuel Brittan Fellowship</a></body>')}:(t.calls.push(url),{url,status:403,body:'<title>Security Verification</title>'})
 const jobs=await m.run(t.options)
 assert.equal(jobs.sourceAudit.nativePostings,2);assert.equal(jobs.sourceAudit.nativeInventoryComplete,true)
 assert.equal(jobs.sourceAudit.complete,false);assert.equal(jobs.sourceAudit.wholeCompanyIndia,null);assert.equal(jobs.sourceAudit.wholeCompanyGlobal,null)
 assert.equal(jobs.sourceAudit.additionalRecruitmentScopes[0].status,403)
 assert.equal(t.calls.at(-1),'https://www.ft.com/maisiefellowship');assert.equal(t.calls.includes('https://www.ft.com/brittanfellowship'),false)
})

test('FT retains structured public criteria, current talent classification and strict original calendar dates',async()=>{
 const m=await load(),g=m.buildOfficeGraph({offices})
 const j=m.parseFinancialTimesRole({...role,include_ai_disclaimer:true,ai_disclaimer:'<p>Disclose AI use.</p>',questions:[{label:'Portfolio &amp; experience',required:true,fields:[{values:[{label:'Three years'},{label:'Five years'}]}]}]},g)
 for(const t of ['Disclose AI use.','Portfolio & experience','Required','Three years','Five years'])assert.ok(j.sourceDescription.includes(t))
 const talent=m.parseFinancialTimesRole({...role,title:'Join our Talent Community and Build a Newsworthy Career',location:{name:'Global'},offices:[]},g)
 assert.equal(talent.nativeNonVacancy,true);assert.equal(talent.sourceIndiaEligible,false);assert.equal(talent.country,null)
 const expired=m.parseFinancialTimesRole({...role,application_deadline:'2026-10-21T00:00:00Z'},g,{now:'2026-10-27T00:00:00Z'});assert.equal(expired.nativeVacancy,false)
 assert.throws(()=>m.parseFinancialTimesRole({...role,first_published:'2026-02-30T00:00:00Z'},g),/date|calendar/i)
})

test('FT follows actual hiring context for opaque advertised program links and preserves healthy primary India roles',async()=>{
 const m=await load(),t=transport(),original=t.options.fetchPage
 t.options.fetchPage=async url=>({...await original(url),body:html.replace('</body>','<p>Applications for our fellowship open Autumn 2026. <a href="https://partner.example/program/123">Read more</a></p></body>')})
 const jobs=await m.run(t.options)
 assert.equal(jobs.length,2);assert.equal(jobs.sourceAudit.nativeInventoryComplete,true);assert.equal(jobs.sourceAudit.complete,false)
 assert.ok(jobs.sourceAudit.additionalRecruitmentScopes.some(s=>s.url==='https://partner.example/program/123'))
 assert.equal(t.calls.some(u=>u.startsWith('https://partner.example')),false)
})

test('FT stops 200 bot gates and recognises an opaque external Apply now handoff',async()=>{
 const m=await load(),gate=transport()
 await assert.rejects(m.run({...gate.options,fetchPage:async url=>{gate.calls.push(url);return{url,status:200,body:'<title>Security Verification</title>'}}}),/denied|gate/i)
 assert.deepEqual(gate.calls,['https://aboutus.ft.com/'])
 const t=transport(),original=t.options.fetchPage
 t.options.fetchPage=async url=>({...await original(url),body:html.replace('</body>','<a href="https://partner.example/opaque/123">Apply now</a></body>')})
 const jobs=await m.run(t.options);assert.equal(jobs.sourceAudit.complete,false);assert.ok(jobs.sourceAudit.additionalRecruitmentScopes.some(s=>s.url==='https://partner.example/opaque/123'))
})
