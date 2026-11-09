import assert from 'node:assert/strict'
import test from 'node:test'

const officialSiteHtml = `
  <main>
    <h1>Careers</h1>
    <p>Our current openings are coming soon on the site.</p>
    <a href="https://www.linkedin.com/company/bootlabs-technologies">LinkedIn</a>
    <a href="https://www.linkedin.com/company/bootlabs-technologies/jobs/">See open roles on LinkedIn</a>
  </main>
`

const searchResultsHtml = `
  <section class="two-pane-serp-page__results-list">
    <ul class="jobs-search__results-list">
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4060905526">
          <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/lead-devops-engineer-at-bootlabs-4060905526?position=1&amp;pageNum=0"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Lead DevOps Engineer</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://www.linkedin.com/company/bootlabs-technologies">BootLabs Technologies</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">Bengaluru, Karnataka, India</span>
              <time class="job-search-card__listdate" datetime="2026-07-05">4 days ago</time>
            </div>
          </div>
        </div>
      </li>
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4060905527">
          <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/platform-engineer-at-bootlabs-4060905527?position=2&amp;pageNum=0"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Platform Engineer</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://www.linkedin.com/company/bootlabs-technologies">BootLabs Technologies</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">London, United Kingdom</span>
              <time class="job-search-card__listdate" datetime="2026-07-05">4 days ago</time>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </section>
`

const detailHtml = `
  <html>
    <head>
      <title>BootLabs Technologies hiring Lead DevOps Engineer in Bengaluru, Karnataka, India | LinkedIn</title>
      <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "JobPosting",
          "datePosted": "2026-07-05T04:09:09.000Z",
          "employmentType": "FULL_TIME",
          "description": "&lt;p&gt;Lead cloud infrastructure and CI/CD automation.&lt;/p&gt;",
          "title": "Lead DevOps Engineer",
          "hiringOrganization": {
            "@type": "Organization",
            "name": "BootLabs Technologies"
          },
          "jobLocation": {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Bengaluru",
              "addressRegion": "Karnataka",
              "addressCountry": "IN"
            }
          }
        }
      </script>
    </head>
    <body></body>
  </html>
`

const loadBootLabsModule = async () => {
  try {
    return await import('../../scraper/bootlabstechnologies/script.js')
  } catch {
    assert.fail('Expected BootLabs Technologies scraper module at ../../scraper/bootlabstechnologies/script.js')
  }
}

test('extractSearchResults keeps only India jobs from the public BootLabs LinkedIn search page', async () => {
  const bootlabs = await loadBootLabsModule()
  const jobs = bootlabs.extractSearchResults(searchResultsHtml)

  assert.equal(bootlabs.pageIndicatesLinkedinHandoff(officialSiteHtml), true)
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Lead DevOps Engineer',
    company: 'BootLabs Technologies',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '4060905526',
    requisitionId: null,
    sourceUrl: 'https://in.linkedin.com/jobs/view/lead-devops-engineer-at-bootlabs-4060905526?position=1&pageNum=0',
    applyUrl: 'https://in.linkedin.com/jobs/view/lead-devops-engineer-at-bootlabs-4060905526?position=1&pageNum=0',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-05',
    closingDate: null,
    jobDescription: null,
  })
})

test('extractJobDetail enriches a public BootLabs LinkedIn detail page using JobPosting JSON-LD', async () => {
  const bootlabs = await loadBootLabsModule()
  const detail = bootlabs.extractJobDetail(detailHtml)

  assert.deepEqual(detail, {
    company: 'BootLabs Technologies',
    location: 'Bengaluru, Karnataka, IN',
    city: 'Bengaluru',
    country: 'India',
    employmentType: 'Full-time',
    postingDate: '2026-07-05',
    jobDescription: 'Lead cloud infrastructure and CI/CD automation.',
  })
})

import {nativeFixture} from '../../scraper/bizongo/nativeFixture.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
test('run forwards caller options, validates the current native employer and retains complete public announcement observations',async()=>{
 const bootlabs=await loadBootLabsModule(),fixture=nativeFixture(new URL('../../scraper/bootlabstechnologies/script.js',import.meta.url)),reports=[]
 const jobs=await bootlabs.run({fetchPage:fixture.fetchPage,onAudit:r=>reports.push(r)})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(reports.length,1)
 assert.equal(reports[0].nativeCompanyId,'14621861');assert.equal(reports[0].observations.length,10)
 assert.ok(reports[0].observations.every(r=>r.jobId===null&&r.requisitionId===null&&r.country===null&&r.originalText))
})
