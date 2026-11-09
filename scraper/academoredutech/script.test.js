import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
const currentPublicFixture=()=>JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-public-20261103.json.gz',import.meta.url))))
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractJobPostings,
  createAcademorEdutechScraper,
  LINKEDIN_COMPANY_URL,
} from './script.js'

const hiringPostHtml = `
  <article data-urn="urn:li:activity:7109916574026801153">
    <a href="https://www.linkedin.com/posts/academor_academor-activity-7109916574026801153-rFEi">
      Academor's Post
    </a>
    <div class="feed-shared-update-v2__description">
      Academor is currently hiring talented individuals like you!
      Position: Inside Sales / Business Development
      Location: Bangalore
      Full-Time/Part-Time: Full Time
      Work From Office: HSR Layout Bangalore 560068
      <a href="https://forms.gle/example">Apply here</a>
    </div>
  </article>
`

test('extractJobPostings parses a company-authored LinkedIn hiring post', () => {
  const jobs = extractJobPostings(hiringPostHtml)

  assert.deepEqual(jobs, [{
    title: 'Inside Sales / Business Development',
    company: 'Academor Edutech',
    location: 'Bangalore',
    city: 'Bangalore',
    country: null,
    employmentType: 'Full Time',
    sourceUrl: 'https://www.linkedin.com/posts/academor_academor-activity-7109916574026801153-rFEi',
    applyUrl: 'https://forms.gle/example',
    jobDescription: 'Academor is currently hiring talented individuals like you! Position: Inside Sales / Business Development Location: Bangalore Full-Time/Part-Time: Full Time Work From Office: HSR Layout Bangalore 560068 Apply here',
    remoteStatus: 'On-site',
  }])
})

test("run retains the current native employer profile without promoting unqualified historical article snippets",async () => {
 const calls=[];let audit
 const jobs=await createAcademorEdutechScraper().run({fetchPage:async url=>{calls.push(url);const row=currentPublicFixture().responses.find(row=>row.url===url);assert.ok(row);return{url:row.finalURL,status:row.status,html:row.body}},onAudit:value=>{audit=value}})
 assert.deepEqual(calls,[LINKEDIN_COMPANY_URL,LINKEDIN_COMPANY_URL]);assert.equal(jobs.length,0);assert.equal(audit.nativeOrganizationId,'82553226');assert.equal(audit.nativeAnnouncements.length,0);assert.equal(audit.inventoryEvidence.reportedTotal,null)
})
