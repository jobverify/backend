import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_PAGE_URL,
  createCriodoScraper,
  extractCareerJobs,
} from './script.js'

const careersHtml = `
  <div id="workwithus">
    <section>
      <h2>Work With Us</h2>
      <p>Explore exciting career opportunities at Crio.Do and become a part of our dynamic team.</p>
      <div class="job-apply-container">
        <div class="swiper-slide">
          <div class="max-w-[150px] text-v5-neutral-500 md:text-lg">Business Development Associate</div>
          <div>
            <span class="font-semibold">Team: </span><span class="font-normal">Business Development</span>
          </div>
          <div>
            <span class="font-semibold">Location: </span><span class="font-normal">Bengaluru, Chennai</span>
          </div>
          <a href="#tally-open=woy4vx&amp;tally-emoji-text=👋&amp;tally-emoji-animation=wave">Apply Now <!-- -->&gt;</a>
        </div>
        <div class="swiper-slide">
          <div class="max-w-[150px] text-v5-neutral-500 md:text-lg">Brand Design Specialist</div>
          <div>
            <span class="font-semibold">Team: </span><span class="font-normal">Growth</span>
          </div>
          <div>
            <span class="font-semibold">Location: </span><span class="font-normal">Bengaluru</span>
          </div>
          <a href="#tally-open=w8dORz&amp;tally-emoji-text=👋&amp;tally-emoji-animation=wave">Apply Now <!-- -->&gt;</a>
        </div>
        <div class="swiper-slide">
          <div class="max-w-[150px] text-v5-neutral-500 md:text-lg">Associate Program Manager</div>
          <div>
            <span class="font-semibold">Team: </span><span class="font-normal">Growth</span>
          </div>
          <div>
            <span class="font-semibold">Location: </span><span class="font-normal">Bengaluru</span>
          </div>
          <a href="#tally-open=w4NBqb&amp;tally-emoji-text=👋&amp;tally-emoji-animation=wave">Apply Now <!-- -->&gt;</a>
        </div>
      </div>
    </section>
  </div>
`

test('extractCareerJobs parses official career cards and keeps India openings', () => {
  assert.deepEqual(extractCareerJobs(careersHtml), [
    {
      title: 'Business Development Associate',
      company: 'Crio.Do',
      department: 'Business Development',
      location: 'Bengaluru, Chennai, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'business-development-associate',
      requisitionId: 'business-development-associate',
      sourceUrl: CAREERS_PAGE_URL,
      applyUrl: 'https://www.crio.do/about-us/#tally-open=woy4vx&tally-emoji-text=%F0%9F%91%8B&tally-emoji-animation=wave',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
      companyCareerPage: CAREERS_PAGE_URL,
      atsPlatform: 'official-company-careers',
    },
    {
      title: 'Brand Design Specialist',
      company: 'Crio.Do',
      department: 'Growth',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'brand-design-specialist',
      requisitionId: 'brand-design-specialist',
      sourceUrl: CAREERS_PAGE_URL,
      applyUrl: 'https://www.crio.do/about-us/#tally-open=w8dORz&tally-emoji-text=%F0%9F%91%8B&tally-emoji-animation=wave',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
      companyCareerPage: CAREERS_PAGE_URL,
      atsPlatform: 'official-company-careers',
    },
    {
      title: 'Associate Program Manager',
      company: 'Crio.Do',
      department: 'Growth',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'associate-program-manager',
      requisitionId: 'associate-program-manager',
      sourceUrl: CAREERS_PAGE_URL,
      applyUrl: 'https://www.crio.do/about-us/#tally-open=w4NBqb&tally-emoji-text=%F0%9F%91%8B&tally-emoji-animation=wave',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
      companyCareerPage: CAREERS_PAGE_URL,
      atsPlatform: 'official-company-careers',
    },
  ])
})

test('run validates the official careers surface and adds scraper metadata', async () => {
  const scraper = createCriodoScraper()
  const requestedUrls = []
  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_PAGE_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'criodo')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
