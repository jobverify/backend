import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'

import {
  CAREER_PAGE_URL,
  createCdacScraper,
  extractSearchResults,
  pageIndicatesCurrentOpenings,
} from '../../scraper/cdac/script.js'

const sampleHtml = `
  <main>
    <h3>Current Openings</h3>
    <div class="job-list">
      <a href="/index.aspx?id=pdf_hrd_sil&dynamicId=walkin-CINE-REC-2026-01.pdf">
        Walk-In Interview for the positions of Project Manager, Senior Project Engineer, Project Engineer, Project Associate and Project Support Staff to be posted in Guwahati, Assam
      </a>
    </div>
    <h3>Rolling Advertisements</h3>
    <div class="job-list">
      <a href="/index.aspx?id=job_corp_CAE_2020">
        Applications are invited (online only) for C-DAC Adjunct Engineer (CAE) scheme from motivated and experienced researchers for doing research in C-DAC interest areas
      </a>
    </div>
    <h3>Notifications</h3>
    <a href="/index.aspx?id=cancelled">Cancellation of Recruitment Process</a>
  </main>
`

test('extractSearchResults maps official C-DAC current and rolling announcements to job records', () => {
  const jobs = extractSearchResults(sampleHtml)

  assert.equal(pageIndicatesCurrentOpenings(sampleHtml), true)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Applications are invited (online only) for C-DAC Adjunct Engineer (CAE) scheme from motivated and experienced researchers for doing research in C-DAC interest areas',
    company: 'C-DAC',
    department: null,
    location: null,
    city: null,
    country: null,
    jobId: 'cdac-job-corp-cae-2020',
    requisitionId: 'job_corp_CAE_2020',
    sourceUrl: CAREER_PAGE_URL,
    applyUrl: 'https://cdac.in/index.aspx?id=job_corp_CAE_2020',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.equal(jobs[1].requisitionId, 'walkin-CINE-REC-2026-01.pdf')
  assert.equal(jobs[1].applyUrl, 'https://cdac.in/index.aspx?id=pdf_hrd_sil&dynamicId=walkin-CINE-REC-2026-01.pdf')
})

test('run follows the official C-DAC rolling role inventory and hydrates full individual native criteria', async () => {
  const native = JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/cdac/test-data/native-20261102.json.gz', import.meta.url))))
  const requestedUrls = []
  const jobs = await createCdacScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREER_PAGE_URL) return sampleHtml
      const receipt = [...native.ads, ...native.details].find(row => row.url === url)
      assert.ok(receipt, url)
      return receipt.body
    },
    fetchBinary: async url => Buffer.from(native.ads.find(row => row.url === url).body, 'base64'),
    now: () => new Date('2026-11-02T18:00:00Z'),
  })

  assert.equal(requestedUrls.filter(url => url === CAREER_PAGE_URL).length, 2)
  assert.equal(requestedUrls.filter(url => url.includes('job_corp_CAE_2020')).length, 2)
  assert.ok(requestedUrls.includes('https://cdac.in/index.aspx?id=ca_CHN-CAE-01'))
  assert.equal(jobs.length, 49)
  assert.equal(jobs[0].source, 'cdac')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.ok(Date.parse(jobs[0].scrapedAt))
})
