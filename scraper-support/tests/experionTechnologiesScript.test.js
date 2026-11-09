import assert from 'node:assert/strict'
import test from 'node:test'

const loadExperionModule = async () => {
  try {
    return await import('../../scraper/experiontechnologies/script.js')
  } catch {
    assert.fail('Expected Experion Technologies scraper module at ../../scraper/experiontechnologies/script.js')
  }
}

const listingsHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Explore Exciting IT Career Opportunities at Experion Technologies</title>
    <link rel="canonical" href="https://experionglobal.com/job-openings/" />
  </head>
  <body>
    <h1>Job Openings</h1>
    <div class="career-jobs-ajax-wrapper">
      <div class="career-jobs-container">
        <a href="https://experionglobal.com/jobs/senior-director-delivery-services/" class="career-job-row" data-exp="18+ Years" data-loc="Kochi, Trivandrum">
          <div class="career-job-info">
            <h3 class="career-job-title">Senior Director – Delivery Services</h3>
            <div class="career-job-meta">
              <span class="meta-item">18+ Years</span>
              <span class="meta-item">Full time</span>
              <span class="meta-item">Kochi, Trivandrum</span>
            </div>
          </div>
        </a>
        <a href="https://experionglobal.com/jobs/lead-ai-engineer/" class="career-job-row" data-exp="7+ Years" data-loc="Kochi, Trivandrum, Remote">
          <div class="career-job-info">
            <h3 class="career-job-title">Lead AI Engineer</h3>
            <div class="career-job-meta">
              <span class="meta-item">7+ Years</span>
              <span class="meta-item">Full time</span>
              <span class="meta-item">Kochi, Trivandrum, Remote</span>
            </div>
          </div>
        </a>
      </div>
    </div>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Senior Director – Delivery Services - Experion Technologies</title>
  </head>
  <body>
    <header class="job-header">
      <h1 class="job-title">Senior Director – Delivery Services</h1>
      <div class="job-meta-info">
        <span class="meta-item experience"><strong>Total Experience:</strong> 18+ Years</span>
        <span class="meta-item location"><strong>Job Location:</strong> Kochi, Trivandrum</span>
      </div>
    </header>
    <div class="job-description">
      <h4>Job Purpose</h4>
      <p>Own delivery excellence across a major client portfolio.</p>
      <h4>Job Description</h4>
      <ul>
        <li class="outside_li">Lead delivery and account growth.</li>
        <li class="outside_li">Coach multi-disciplinary engineering teams.</li>
      </ul>
      <h4>Duties &amp; Responsibilities</h4>
      <ul>
        <li class="outside_li">Drive stakeholder communication.</li>
      </ul>
    </div>
    <aside class="job-right-sidebar">
      <div class="sticky-form-wrapper">
        <h2 class="career-form-title">Apply for this position</h2>
        <div class="wpcf7 no-js" id="wpcf7-f8967-o1" data-wpcf7-id="8967">
          <form action="/jobs/senior-director-delivery-services/#wpcf7-f8967-o1" method="post" class="wpcf7-form init" enctype="multipart/form-data">
            <input type="text" name="full-name" />
            <input type="email" name="email-address" />
            <input type="file" name="cv-file" />
            <button type="submit" class="job-submit-btn">SUBMIT</button>
          </form>
        </div>
      </div>
    </aside>
  </body>
</html>
`

test('Experion Technologies validates the official careers shell and maps listing cards into shared fields', async () => {
  const experion = await loadExperionModule()

  assert.equal(experion.SOURCE, 'experiontechnologies')
  assert.equal(experion.COMPANY, 'Experion Technologies')
  assert.equal(experion.HOMEPAGE_URL, 'https://experionglobal.com/')
  assert.equal(experion.CAREERS_URL, 'https://experionglobal.com/job-openings/')
  assert.equal(typeof experion.hasOfficialHomepageSignal, 'function')
  assert.equal(typeof experion.hasOfficialCareersSignal, 'function')
  assert.equal(typeof experion.extractListings, 'function')
  assert.equal(typeof experion.extractJobDetail, 'function')
  assert.equal(typeof experion.createExperionTechnologiesScraper, 'function')
  assert.equal(typeof experion.run, 'function')

  assert.equal(experion.hasOfficialCareersSignal(listingsHtml), true)

  assert.deepEqual(experion.extractListings(listingsHtml), [
    {
      title: 'Senior Director - Delivery Services',
      company: 'Experion Technologies',
      department: null,
      location: 'Kochi, Trivandrum, India',
      city: 'Kochi',
      country: 'India',
      jobId: 'senior-director-delivery-services',
      requisitionId: 'senior-director-delivery-services',
      sourceUrl: 'https://experionglobal.com/jobs/senior-director-delivery-services/',
      applyUrl: 'https://experionglobal.com/jobs/senior-director-delivery-services/',
      employmentType: 'Full time',
      experienceRequired: '18+ Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Lead AI Engineer',
      company: 'Experion Technologies',
      department: null,
      location: 'Kochi, Trivandrum, Remote, India',
      city: 'Kochi',
      country: 'India',
      jobId: 'lead-ai-engineer',
      requisitionId: 'lead-ai-engineer',
      sourceUrl: 'https://experionglobal.com/jobs/lead-ai-engineer/',
      applyUrl: 'https://experionglobal.com/jobs/lead-ai-engineer/',
      employmentType: 'Full time',
      experienceRequired: '7+ Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Remote',
    },
  ])
})

test('extractJobDetail keeps Experion on the first-party detail page and parses the inline apply form', async () => {
  const experion = await loadExperionModule()
  const listing = experion.extractListings(listingsHtml)[0]
  const detail = experion.extractJobDetail(detailHtml, listing)

  assert.deepEqual(detail, {
    title: 'Senior Director - Delivery Services',
    company: 'Experion Technologies',
    department: null,
    location: 'Kochi, Trivandrum, India',
    city: 'Kochi',
    country: 'India',
    jobId: 'senior-director-delivery-services',
    requisitionId: 'senior-director-delivery-services',
    sourceUrl: 'https://experionglobal.com/jobs/senior-director-delivery-services/',
    applyUrl: 'https://experionglobal.com/jobs/senior-director-delivery-services/',
    employmentType: 'Full time',
    experienceRequired: '18+ Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Job Purpose Own delivery excellence across a major client portfolio. Job Description Lead delivery and account growth. Coach multi-disciplinary engineering teams. Duties & Responsibilities Drive stakeholder communication.',
    remoteStatus: 'On-site',
  })
})

test('run verifies the official homepage and careers page, then fetches Experion detail pages', async () => {
  const experion = await loadExperionModule()
  const requestedUrls = []

  const jobs = await experion.createExperionTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === experion.HOMEPAGE_URL) {
        return `
          <html>
            <body>
              <a href="https://experionglobal.com/job-openings/">Job Openings</a>
              <a href="https://experionglobal.com/life-at-experion/">Life At Experion</a>
            </body>
          </html>
        `
      }

      if (url === experion.CAREERS_URL) return listingsHtml
      if (url === 'https://experionglobal.com/jobs/senior-director-delivery-services/') return detailHtml
      if (url === 'https://experionglobal.com/jobs/lead-ai-engineer/') {
        return detailHtml
          .replaceAll('Senior Director – Delivery Services', 'Lead AI Engineer')
          .replaceAll('18+ Years', '7+ Years')
          .replaceAll('Kochi, Trivandrum', 'Kochi, Trivandrum, Remote')
          .replaceAll('Own delivery excellence across a major client portfolio.', 'Build practical AI solutions for product teams.')
          .replaceAll('Lead delivery and account growth.', 'Lead applied AI delivery across client engagements.')
          .replaceAll('Coach multi-disciplinary engineering teams.', 'Shape agentic solution architecture.')
          .replaceAll('Drive stakeholder communication.', 'Collaborate across product and engineering leadership.')
          .replaceAll('/jobs/senior-director-delivery-services/', '/jobs/lead-ai-engineer/')
      }

      throw new Error(`Unexpected Experion URL: ${url}`)
    },
    now: () => '2026-07-10T08:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://experionglobal.com/',
    'https://experionglobal.com/job-openings/',
    'https://experionglobal.com/jobs/senior-director-delivery-services/',
    'https://experionglobal.com/jobs/lead-ai-engineer/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'experiontechnologies')
  assert.equal(jobs[0].link, 'https://experionglobal.com/jobs/senior-director-delivery-services/')
  assert.equal(jobs[0].scrapedAt, '2026-07-10T08:00:00.000Z')
})

test('Experion Technologies fails closed when the verified careers surface changes materially', async () => {
  const experion = await loadExperionModule()

  await assert.rejects(
    experion.createExperionTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === experion.HOMEPAGE_URL) {
          return `
            <html>
              <body>
                <a href="https://experionglobal.com/job-openings/">Job Openings</a>
                <a href="https://experionglobal.com/life-at-experion/">Life At Experion</a>
              </body>
            </html>
          `
        }

        return '<html><body><h1>Careers</h1></body></html>'
      },
    }),
    /Experion Technologies official careers surface changed/i,
  )
})
