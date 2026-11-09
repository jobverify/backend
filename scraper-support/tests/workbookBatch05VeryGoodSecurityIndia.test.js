import {fixture,replay,editHTML,editJSON,mutateNativePost} from '../native-sources/publicLeverChannels/fixtureReplay.js'
import {syntheticPaginatedVgs} from '../native-sources/publicLeverChannels/testSupport.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  LEVER_BOARD_URL,
  run,
} from '../../scraper/verygoodsecurityindia/script.js'

const careersHtml = `
  <html><head><title>Careers | VGS</title></head><body>
    <h1>It Takes Exceptional People to Build VGS</h1>
    <a href="#lever-jobs-container">View All Open Roles</a>
    <h2>What We Look For In Every Teammate</h2>
    <p>We're a remote-first company looking for passionate professionals.</p>
    <section class="lever-jobs"><div id="lever-jobs-container"></div>
      <h2>Discover Opportunities</h2></section>
  </body></html>
`

const boardHtml = `
  <html><head><title>VGS</title>
    <meta property="og:url" content="https://jobs.lever.co/verygoodsecurity">
  </head><body><p>Location type Location Team Work type</p>
    <a href="https://jobs.lever.co/verygoodsecurity/us-role">Apply</a>
    <p>Powered by Lever</p>
  </body></html>
`

test("Very Good Security retains current foreign-role observations without an employer-wide India-zero claim",async()=>{
   const r=replay(),jobs=await run(r.options);assert.equal(jobs.length,0)
   assert.equal(r.audits[0].observations.length,18);assert.equal(r.audits[0].sourceScopeComplete,false)
   assert.equal(r.audits[0].authoritativeIndiaFacetCount,null)
  
})

test("Very Good Security holds changed current careers and board identities while retaining native criteria",async()=>{
   for(const changed of ['primary','board']){
    const r=replay((url,page)=>changed==='primary'&&url===CAREERS_URL?editHTML(page,html=>html.replace('id="lever-jobs-container"','id="old-target"')):changed==='board'&&url===LEVER_BOARD_URL?editHTML(page,html=>html.replace('<title>VGS</title>','<title>Other</title>')):page)
    assert.equal((await run(r.options)).length,0);assert.equal(r.audits[0].closing.publisherQualified,false)
    assert.equal(r.audits[0].observations.length,18);assert.ok(r.audits[0].observations.every(row=>row.jobDescription))
   }
  
})
