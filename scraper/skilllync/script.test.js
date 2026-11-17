import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ACCEPTED_UNAVAILABLE_STATUSES,
  CAREERS_URL,
  COMPANY,
  JOBS_URL,
  SOURCE,
  createSkillLyncScraper,
  hasOfficialCareersSignal,
  hasOfficialJobsPageSignal,
  hasRenderedPublicJobCards,
  isVerifiedUnavailablePage,
} from './script.js'

const careersHtml = `
  <html>
    <body>
      <h1>Make a positive career move. Reach for the stars!</h1>
      <p>Evolve with us and create the future of learning! Learning is everything here.</p>
      <a href="https://skill-lync.com/careers/jobs">Click To View Openings</a>
    </body>
  </html>
`

const jobsShellHtml = `
  <html>
    <body>
      <section>
        <h2>CURRENT OPENINGS</h2>
        <p>Filter by location</p>
        <p>Filter by team</p>
        <p>Filter by work type</p>
        <button>Clear All</button>
      </section>
      <section>
        <h2>SPEAK WITH US</h2>
      </section>
    </body>
  </html>
`

const publicJobsHtml = `
  <html>
    <body>
      <section>
        <h2>CURRENT OPENINGS</h2>
        <a href="/careers/jobs/sales-manager">View jobs</a>
        <a href="/careers/jobs/sales-manager/apply">Apply now</a>
      </section>
    </body>
  </html>
`

const unavailableHtml = `
  <html>
    <head>
      <title>503 Service Temporarily Unavailable</title>
    </head>
    <body>
      <center><h1>503 Service Temporarily Unavailable</h1></center>
    </body>
  </html>
`

const badGatewayHtml = `
  <html>
    <head>
      <title>502 Bad Gateway</title>
    </head>
    <body>
      <center><h1>502 Bad Gateway</h1></center>
    </body>
  </html>
`

test('Skill-Lync sentinel stays pinned to the first-party careers page and current-openings shell', () => {
  assert.equal(SOURCE, 'skilllync')
  assert.equal(COMPANY, 'Skill-Lync')
  assert.equal(CAREERS_URL, 'https://www.skill-lync.com/careers')
  assert.equal(JOBS_URL, 'https://skill-lync.com/careers/jobs')
  assert.deepEqual(ACCEPTED_UNAVAILABLE_STATUSES, [502, 503])
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasOfficialJobsPageSignal(jobsShellHtml), true)
  assert.equal(hasRenderedPublicJobCards(jobsShellHtml), false)
  assert.equal(hasRenderedPublicJobCards(publicJobsHtml), true)
  assert.equal(
    isVerifiedUnavailablePage({
      status: 503,
      url: CAREERS_URL,
      html: unavailableHtml,
    }),
    true,
  )
  assert.equal(
    isVerifiedUnavailablePage({
      status: 502,
      url: CAREERS_URL,
      html: badGatewayHtml,
    }),
    true,
  )
})


test('Skill-Lync current runtime rejects historical metadata-free empty/unavailable callbacks',async()=>{
 let calls=0;await assert.rejects(createSkillLyncScraper().run({fetchPage:async()=>{calls++;return{status:503,html:unavailableHtml}}}),/metadata|unsupported/);assert.equal(calls,0)
})
test('Skill-Lync current observed503 remains upstream HTTP and never returns company zero',async()=>{
 let calls=0;await assert.rejects(createSkillLyncScraper().run({requestIntervalMs:0,fetchImpl:async url=>{calls++;const r=new Response(unavailableHtml,{status:503,headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:url});return r}}),error=>error.status===503);assert.equal(calls,1)
})
test('Skill-Lync current transport failure remains exact without alternate-route retries',async()=>{
 const reason=Object.freeze({owner:'skill-network'});let calls=0;await assert.rejects(createSkillLyncScraper().run({requestIntervalMs:0,fetchImpl:async()=>{calls++;throw reason}}),error=>error===reason);assert.equal(calls,1)
})
