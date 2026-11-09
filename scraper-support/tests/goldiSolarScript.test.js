import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  buildSearchUrl,
  createGoldiSolarScraper,
  extractSearchResults,
  pageIndicatesApplyForm,
} from '../../scraper/goldisolar/script.js'

const sampleHtml = `
<section id="community" class="image-side-content intro-title-offset">
  <div class="container">
    <article class="block openposition image-left image-portrait narrow-text has-additional-img">
      <div class="content" style="display: block">
        <article class="medium-mce">
          <p class="text-justify">Step into the future with us! Bring your ideas to the solar revolution and take pride in driving change. A fulfilling career awaits!</p>
        </article>
      </div>
    </article>
  </div>
</section>
<table id="tablepress-1" class="tablepress tablepress-id-1" aria-labelledby="tablepress-1-name">
  <thead>
    <tr class="row-1">
      <th class="column-1">Sr. No.</th><th class="column-2">Department</th>
    </tr>
  </thead>
  <tbody class="row-striping row-hover">
    <tr class="row-2">
      <td class="column-1">1</td><td class="column-2">Production <br />[Diploma/BE/Btech/ITI(Mechanical,Electrical,EC)]</td>
    </tr>
    <tr class="row-3">
      <td class="column-1">2</td><td class="column-2">Quality <br />[Diploma/BE/Btech/ITI(Mechanical,Electrical,EC)]</td>
    </tr>
    <tr class="row-4">
      <td class="column-1">3</td><td class="column-2">Maintenance <br />[Diploma/BE/Btech/ITI(Mechanical,Electrical,EC)]</td>
    </tr>
    <tr class="row-5">
      <td class="column-1">4</td><td class="column-2">Operations <br />[Diploma/BE/Btech/ITI(Mechanical,Electrical,EC)]</td>
    </tr>
  </tbody>
</table>
<section id="contact-us" class="form intro-title-offset">
  <div class="inner">
    <div class="form-wrap">
      <h4>Apply Here</h4>
      <form action="/career/#wpcf7-f3150-p57-o1"></form>
    </div>
  </div>
</section>
`

test('extractSearchResults maps Goldi Solar department intake rows into conservative job records', () => {
  const jobs = extractSearchResults(sampleHtml)

  assert.equal(jobs.length, 4)
  assert.equal(pageIndicatesApplyForm(sampleHtml), true)
  assert.deepEqual(jobs[0], {
    title: 'Maintenance',
    company: 'Goldi Solar',
    department: 'Maintenance',
    location: 'Surat, Gujarat, India',
    city: 'Surat',
    country: 'India',
    jobId: 'goldi-solar-maintenance',
    requisitionId: 'goldi-solar-maintenance',
    sourceUrl: 'https://goldisolar.com/career/',
    applyUrl: 'https://goldisolar.com/career/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: 'Diploma/BE/Btech/ITI(Mechanical,Electrical,EC)',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Step into the future with us! Bring your ideas to the solar revolution and take pride in driving change. A fulfilling career awaits! Eligibility criteria for Maintenance: Diploma/BE/Btech/ITI(Mechanical,Electrical,EC). Apply via the Goldi Solar careers page.',
  })
  assert.deepEqual(jobs[3], {
    title: 'Quality',
    company: 'Goldi Solar',
    department: 'Quality',
    location: 'Surat, Gujarat, India',
    city: 'Surat',
    country: 'India',
    jobId: 'goldi-solar-quality',
    requisitionId: 'goldi-solar-quality',
    sourceUrl: 'https://goldisolar.com/career/',
    applyUrl: 'https://goldisolar.com/career/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: 'Diploma/BE/Btech/ITI(Mechanical,Electrical,EC)',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Step into the future with us! Bring your ideas to the solar revolution and take pride in driving change. A fulfilling career awaits! Eligibility criteria for Quality: Diploma/BE/Btech/ITI(Mechanical,Electrical,EC). Apply via the Goldi Solar careers page.',
  })
})

test('run fetches the Goldi Solar careers page and decorates the extracted intake jobs', async () => {
  const requestedUrls = []
  const scraper = createGoldiSolarScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return sampleHtml
    },
  })

  assert.equal(buildSearchUrl(), CAREER_PAGE_URL)
  assert.deepEqual(requestedUrls, [CAREER_PAGE_URL])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'goldisolar')
  assert.equal(jobs[0].link, 'https://goldisolar.com/career/')
  assert.equal(jobs[0].scrapedAt, jobs[0].scrapedAt)
})
