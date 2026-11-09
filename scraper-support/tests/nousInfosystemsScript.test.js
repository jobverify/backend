import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'

const FIXED_SCRAPED_AT = '2026-08-03T00:00:00.000Z'

const ROOT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Artizent (formerly known as Nous Infosystems) | The Engineering Partner for Mission Critical AI</title>
    <meta name="description" content="Artizent builds, modernizes, and operates production grade AI systems for enterprises where scale is massive, money is real, and outcomes matter.">
    <meta property="og:site_name" content="Artizent">
    <script src="/runtime-config.js"></script>
    <script type="module" src="/assets/index-live.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Artizent</title>
    <script src="/runtime-config.js"></script>
    <script type="module" src="/assets/index-live.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const MAIN_BUNDLE = `
const __vite__mapDeps=(i)=>i;
const deps=["assets/Careers-live.js","assets/JobOpenings-live.js","assets/jobs-live.js","assets/JobDetail-live.js"];
export {};
`

const JOB_OPENINGS_ASSET = `
function JobOpenings(){
  return "/insights/careers/openings/\${t.slug}";
}
const backHref="/insights/careers";
const title="Open Positions";
const filterA="Select Designation";
const filterB="Select Location";
const button="Back to Careers";
`

const JOB_DETAIL_ASSET = `
const accept=".pdf,.doc,.docx";
const submit=()=>fetch("/api/apply",{method:"POST"});
const sent="Application received";
const fullNameError="Full name is required";
const resumeError="Resume is required";
`

const JOBS_ASSET = `
const e=[
  {
    slug:"java-fullstack-developer-ai",
    title:"Java Full Stack Developer",
    team:"Software Engineering",
    location:"Pune",
    openings:1,
    type:"Full time",
    experience:"8 to 12 Years",
    description:[
      "Build full stack AI-enabled product experiences.",
      "Collaborate with product and delivery teams."
    ],
    skills:["Java full stack development","React.js","Java Spring Boot"]
  },
  {
    slug:"databricks-team-lead-pyspark",
    title:"Databricks Team Lead (PySpark)",
    team:"Data Engineering",
    location:"Bangalore",
    openings:1,
    type:"Full time",
    experience:"7 to 10 Years",
    description:[
      "Lead Data Engineers and design scalable Databricks solutions."
    ],
    skills:["Databricks","PySpark","Python"]
  }
];
export { e as J };
`

const loadModule = async () => {
  try {
    return await import('../../scraper/nousinfosystems/script.js')
  } catch {
    assert.fail('Expected Nous Infosystems scraper module at ../../scraper/nousinfosystems/script.js')
  }
}

test('Nous Infosystems historical August shell and fragment helpers preserve raw city uncertainty', async () => {
  const nous = await loadModule()

  assert.equal(nous.SOURCE, 'nousinfosystems')
  assert.equal(nous.COMPANY, 'Nous Infosystems')
  assert.equal(nous.OFFICIAL_BRAND_NAME, 'Artizent')
  assert.equal(nous.VERIFIED_ON, '2026-08-03')
  assert.equal(nous.LEGACY_HOMEPAGE_URL, 'https://www.nousinfosystems.com/')
  assert.equal(nous.HOMEPAGE_REDIRECT_URL, 'https://www.artizent.com/')
  assert.equal(nous.CAREERS_URL, 'https://www.artizent.com/insights/careers')
  assert.equal(nous.OPENINGS_URL, 'https://www.artizent.com/insights/careers/openings')
  assert.equal(nous.hasOfficialHomepageSignal(ROOT_HTML), true)
  assert.equal(
    nous.isVerifiedHomepageRedirect({
      status: 200,
      url: 'https://www.artizent.com/',
      html: ROOT_HTML,
    }),
    true,
  )
  assert.equal(nous.extractBundleAssetPath(ROOT_HTML), '/assets/index-live.js')
  assert.equal(nous.extractJobsAssetPath(MAIN_BUNDLE), 'assets/jobs-live.js')
  assert.equal(nous.extractJobOpeningsAssetPath(MAIN_BUNDLE), 'assets/JobOpenings-live.js')
  assert.equal(nous.extractJobDetailAssetPath(MAIN_BUNDLE), 'assets/JobDetail-live.js')
  assert.equal(nous.routeMatchesVerifiedShell(CAREERS_HTML, '/assets/index-live.js'), true)
  assert.equal(nous.hasVerifiedJobOpeningsAssetSignal(JOB_OPENINGS_ASSET), true)
  assert.equal(nous.hasVerifiedJobDetailAssetSignal(JOB_DETAIL_ASSET), true)

  assert.deepEqual(nous.extractJobsFromAssetText(JOBS_ASSET), [
    {
      slug: 'java-fullstack-developer-ai',
      title: 'Java Full Stack Developer',
      department: 'Software Engineering',
      location: 'Pune',
      city: null,
      openings: 1,
      employmentType: 'Full-time',
      experienceRequired: '8 to 12 Years',
      requiredSkills: ['Java full stack development', 'React.js', 'Java Spring Boot'],
      jobDescription: 'Build full stack AI-enabled product experiences. Collaborate with product and delivery teams.',
    },
    {
      slug: 'databricks-team-lead-pyspark',
      title: 'Databricks Team Lead (PySpark)',
      department: 'Data Engineering',
      location: 'Bangalore',
      city: null,
      openings: 1,
      employmentType: 'Full-time',
      experienceRequired: '7 to 10 Years',
      requiredSkills: ['Databricks', 'PySpark', 'Python'],
      jobDescription: 'Lead Data Engineers and design scalable Databricks solutions.',
    },
  ])
})


// The entire historical synthetic shell/client fixtures above remain historical
// helper evidence. Current runtime authority is replayed from genuine44 bodies.
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const currentGzip=fs.readFileSync(new URL('../../scraper/nousinfosystems/test-data-20261107/default-current.json.gz',import.meta.url))
assert.equal(sha(currentGzip),'5d606c82e59d6cb4e9f8ae1c7e7c8dd4f8b5d9c450c86e2b8f56eec9c1643cc2')
const current=JSON.parse(gunzipSync(currentGzip))
assert.equal(current.closingResponseReuse,false)
assert.equal(current.requests.length,44)
for(const [hash,body]of Object.entries(current.entities))assert.equal(sha(Buffer.from(body,'base64')),hash)
for(const p of current.requests)assert.equal(Buffer.from(current.entities[p.bodySHA256],'base64').length,p.bodyBytes)
const previousFetch=globalThis.fetch
test.before(()=>{globalThis.fetch=()=>{throw Error('Legacy Nous test forbids unrecorded network')}})
test.after(()=>{globalThis.fetch=previousFetch})
function currentReplay(mutate=({bytes})=>bytes){
 const calls=[]
 return{calls,fetchImpl:async(input,init={})=>{
  const packet=current.requests[calls.length];assert.ok(packet,'Only captured current native requests may be made')
  assert.equal(String(input),packet.url);assert.equal(init.method,packet.method);assert.equal(init.redirect,packet.redirect);assert.equal(init.credentials,packet.credentials);assert.equal(init.body,undefined)
  assert.deepEqual(Object.fromEntries(new Headers(init.headers)),packet.sourceHeaders)
  assert.deepEqual(Object.fromEntries(new Request(input,init).headers),packet.wireRequestHeaders)
  calls.push(packet.url)
  const bytes=mutate({packet,bytes:Buffer.from(current.entities[packet.bodySHA256],'base64')})
  const response=new Response(bytes,{status:packet.status,headers:{'content-type':packet.contentType}});Object.defineProperty(response,'url',{value:packet.finalURL});return response
 }}
}
const withoutExecutionClocks=audit=>({...audit,originalResponses:audit.originalResponses.map(({startedAt,completedAt,...packet})=>packet)})

test('Nous current factory reconciles genuine44 opening and closing responses as fourteen country-unknown observations',async()=>{
 const nous=await loadModule(),io=currentReplay(),jobs=await nous.createNousInfosystemsScraper({now:()=>current.expected.inventory.verifiedAt}).run({fetchImpl:io.fetchImpl})
 assert.equal(io.calls.length,44);assert.equal(io.calls.includes(nous.LEGACY_HOMEPAGE_URL),false)
 assert.deepEqual(jobs,current.expected.jobs)
 assert.deepEqual(readInventoryEvidence(jobs),current.expected.inventory)
 assert.deepEqual(readSourceObservationEvidence(jobs,'nousinfosystems'),current.expected.observations)
 assert.deepEqual(withoutExecutionClocks(jobs.nativeCollectionEvidence),withoutExecutionClocks(current.expected.nativeCollectionEvidence))
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observations.length,14)
 assert.ok(jobs.nativeCollectionEvidence.observations.every(o=>o.country===null&&o.postedDate===null&&o.workplaceMode===null&&o.nativeStatus===null&&o.legalHiringOrganization===null))
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaZeroProven,false);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
})

test('Nous current runtime fails closed when the genuine whole literal program drifts',async()=>{
 const nous=await loadModule(),io=currentReplay(({packet,bytes})=>packet.url.endsWith('/assets/jobs-Bj5fZx4-.js')?Buffer.from('const broken=true; export { broken };'):bytes)
 await assert.rejects(nous.createNousInfosystemsScraper().run({fetchImpl:io.fetchImpl}),/Whole literal export contract changed/)
 assert.equal(io.calls.length,8);assert.equal(io.calls.includes(nous.LEGACY_HOMEPAGE_URL),false)
})

test('Nous historical short SPA shell does not establish current reciprocal identity or vacancy authority',async()=>{
 const nous=await loadModule(),io=currentReplay(({packet,bytes})=>packet.url===nous.HOMEPAGE_REDIRECT_URL?Buffer.from(ROOT_HTML):bytes)
 await assert.rejects(nous.createNousInfosystemsScraper().run({fetchImpl:io.fetchImpl}),/canonical|title|program/i)
 assert.equal(io.calls.length,1);assert.equal(io.calls.includes(nous.LEGACY_HOMEPAGE_URL),false)
})
