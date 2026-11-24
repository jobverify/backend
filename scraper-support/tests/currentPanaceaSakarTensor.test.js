import assert from 'node:assert/strict'
import test, { after } from 'node:test'
const originalFetch = globalThis.fetch
globalThis.fetch = async () => { throw new Error('Unmocked network in regression test') }
after(() => { globalThis.fetch = originalFetch })
import * as tensor from '../../scraper/tensorgosoftwarepvtltd/script.js'
import * as sakar from '../../scraper/sakarrobotics/script.js'
import * as panacea from '../../scraper/panaceamedicaltechnologiespvtltd/script.js'

const tensorShell = '<title>HumAIn by TensorGo | The World\'s First Pre-AGI Teammates</title><link rel="canonical" href="https://tensorgo.com/"><script type="application/ld+json">{"name":"TensorGo"}</script><script src="/static/js/main.fixture.js"></script><div id="root"></div>'
const tensorBundle = 'const api="https://api.humains.one";get("/api/jobs");get("/api/jobs/".concat(slug));path:"/careers";path:"/careers/:slug";"JobPosting";name:"TensorGo"'
const tensorRow = (id,locations=['Hyderabad']) => ({id,slug:'engineer-'+id,title:'Engineer '+id,locations,department:'Engineering',type:'Full-time',yearsRange:'1 to 3 years',workMode:'WFO',short:'Build AI products.',datePosted:'2026-08-22'})
const runTensor = (payload,detailChange={}) => tensor.run({fetchText:async url=>url.includes('/static/js/')?tensorBundle:tensorShell,fetchJson:async url=>url==='https://api.humains.one/api/jobs'?payload:{...payload.items.find(row=>url.endsWith('/'+row.slug)),description:'Design and build reliable AI systems for enterprise customers.',...detailChange}})

test('TensorGo follows original current native API and full role details with country facts preserved',async()=>{const{replay,fast}=await import('../../scraper/tensorgosoftwarepvtltd/nativeFixture20261120.js');await fast(async()=>{const io=replay(),jobs=await tensor.run(io);assert.equal(jobs.length,10);assert.equal(io.calls.length,38);assert.ok(jobs.every(j=>j.country===null&&j.sourcePublicLocationPolicyQualified&&j.sourceDetailComplete&&j.lifecycleCleanupAllowed===false));assert.ok(jobs.every(j=>j.jobDescription.length>1000))})})

test('TensorGo rejects malformed, paginated, duplicate, mismatched-detail and body-only snapshots',async()=>{const{replay,fast,responseFor,API}=await import('../../scraper/tensorgosoftwarepvtltd/nativeFixture20261120.js');for(const mode of ['duplicate','pagination','locations','detail'])await fast(async()=>{const io=replay(({row})=>{if(row.requestedURL===API&&mode!=='detail'){const data=JSON.parse(Buffer.from(row.bodyBase64,'base64'));if(mode==='duplicate')data.items[1].id=data.items[0].id;if(mode==='pagination')data.nextCursor='more';if(mode==='locations')data.items[0].locations=[];return responseFor(row,JSON.stringify(data))}if(row.requestedURL===API+'/ai-engineer'&&mode==='detail'){const data=JSON.parse(Buffer.from(row.bodyBase64,'base64'));data.id='wrong';return responseFor(row,JSON.stringify(data))}});await assert.rejects(tensor.run(io),/invalid|incomplete|duplicate|scope|pagination|mismatched/i)});await assert.rejects(runTensor({items:[tensorRow('1')]}),/metadata|body-only/i);await assert.rejects(tensor.run({fetchText:async()=>tensorShell.replace('<script src="/static/js/main.fixture.js"></script>','')}),/metadata|body-only/i)})

const sakarShell='<title>Sakar Robotics</title><meta name="description" content="Sakar builds general-purpose robots that perceive, decide, and act."><meta property="og:url" content="https://www.sakarrobotics.com/"><script src="/build/seo.js?v=206"></script><script src="/build/pages/company.js?v=206"></script><script src="/build/app.js?v=206"></script>'
const widget='function Careers() {rec_embed_js.load({page_name:"sakarrobotics-career",site:"https://sakarrobotics.zohorecruit.in",source:"CareerSite"})} Careers at Sakar Robotics'
const zrow={id:'1',Posting_Title:'Engineer',City:'Pune City',Country:'India',$url:'https://sakarrobotics.zohorecruit.in/jobs/sakarrobotics-career/1/Engineer?source=CareerSite',Date_Opened:'09/02/2026'}
const zboard=records=>'<title>Careers at Sakar Robotics</title><input id="pageJson" value="{}"><input id="moduleMeta" value="[]"><input id="jobs" value="'+JSON.stringify(records).replaceAll('"','&quot;')+'">'
const runSakar=(records=[zrow],changes={},boardRecords=[zrow])=>sakar.run({fetchText:async url=>url.includes('/build/pages/company.js')?widget:url.includes('/build/app.js')?'if(p === "/company/careers") return {node:React.createElement(Careers,null)}':url.includes('/jobs/sakarrobotics-career/')?'<script>var jobs = JSON.parse('+JSON.stringify(JSON.stringify([{...zrow,Job_Description:'Build reliable robotics systems in Pune for industrial customers.',Date_Opened:'2026-09-02',...changes}]))+');</script>':url.endsWith('/jobs/sakarrobotics-career')?zboard(boardRecords):sakarShell,fetchJson:async()=>({code:'success',data:records,info:{page_name:'sakarrobotics-career'}})})

test('Sakar verifies current route and exact new Zoho widget page, reconciles embedded IDs and reads full details',async()=>{
  const jobs=await runSakar()
  assert.equal(jobs.length,1)
  assert.match(jobs[0].jobDescription,/reliable robotics/)
  assert.equal(jobs[0].postingDate,'2026-09-02')
})

test('Sakar rejects incomplete inventory and mismatched detail identity',async()=>{
  await assert.rejects(runSakar([]),/incomplete/i)
  await assert.rejects(runSakar([zrow,zrow]),/duplicate|incomplete/i)
  await assert.rejects(runSakar([zrow],{id:'2'}),/detail|identity/i)
})

test('Panacea recognizes current Unicode title separator and rejects missing detail content',()=>{
  const detail=panacea.extractJobDetail('<title>Engineer \u2013 Panacea Careers</title><h2>About the Role</h2><p>Build reliable medical products and improve radiotherapy systems.</p><h2>Job Overview</h2><p>Job Code / Ref</p><p>PMT-1</p><p>Location</p><p>Bengaluru</p>')
  assert.equal(detail.detailTitle,'Engineer')
})

for(const [name,module] of [['Panacea',panacea],['Sakar',sakar],['TensorGo',tensor]])test(name+' honors caller cancellation before networking',async()=>{
  const reason=new Error('Cancelled '+name)
  await assert.rejects(module.run({signal:AbortSignal.abort(reason),fetchText:async()=>{throw Error('Network called')}}),error=>error===reason)
})

test('Panacea canonicalizes numbered page one links to avoid re-reading the first ten jobs',()=>{
  assert.deepEqual(panacea.extractJobsListPageUrls('<a href="https://www.panaceamedical.in/careers/page/1/">1</a>'),[panacea.CAREERS_URL])
})

test('Sakar returns readable detail content without embedded style or script text',async()=>{
  const jobs=await runSakar([zrow],{Job_Description:'<style>.huge{color:red}</style><script>trackSecret()</script><h2>Robotics Engineer</h2><p>Build reliable systems for industrial customers in Pune.</p>'})
  assert.equal(jobs[0].jobDescription,'Robotics Engineer Build reliable systems for industrial customers in Pune.')
})

test('Sakar rejects coherent inventory with unknown or mixed country labels before an empty India result',async()=>{
  for(const Country of ['Remote','Unknown','India, Canada','India / Remote','Indiana']){
    const row={...zrow,Country}
    await assert.rejects(runSakar([row],{},[row]),error=>error.code==='SAKAR_LOCATION_UNVERIFIED'&&error.abortRetries===true,Country)
  }
})

test('Sakar excludes known foreign countries without requiring their job details',async()=>{
  const foreign={...zrow,Country:'Canada'}
  assert.deepEqual(await runSakar([foreign],{},[foreign]),[])
})
