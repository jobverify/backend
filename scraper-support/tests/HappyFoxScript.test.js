import assert from 'node:assert/strict'
import test from 'node:test'
import { happyFoxNativeOptions } from './fixtures/happyFoxNativeOptions.js'

const jobsHubHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>HappyFox Job Opportunities - HappyFox Careers</title>
  </head>
  <body>
    <main>
      <h1>Join Us In Spreading the Happy-ness</h1>
      <p>Open positions in India</p>
      <a href="https://www.happyfox.com/jobs/chennai/">Open positions in India</a>
      <div>Chennai</div>
      <div>Bengaluru</div>
      <div>Hyderabad</div>
    </main>
  </body>
</html>
`

const cityPageTemplate = (city, department = 'engineering') => `
<!doctype html>
<html lang="en">
  <head>
    <title>HappyFox Job Opportunities in ${city} - HappyFox Careers</title>
  </head>
  <body>
    <main>
      <p>Open Positions</p>
      <a href="#engineeringPositions">Engineering</a>
      <div class="hf-jobs__right-pane">
        <h2 class="hf-body__heading section-heading" id="engineeringPositions">${department}</h2>
        <div class="flex-parent streched">
          <div class="hf-jobs__card" data-target="frontend-engineer-${city}">
            <div class="hf-jobs__card-upper">
              <h2 class="hf-body__heading-mini hf-body__heading-bold">Frontend Engineer</h2>
              <div class="hf-jobs__basic-info">
                <div class="jobs-info__inner">
                  <span class="hf-body__para hf-jobs__city hf-body__heading-bold">${city}</span>
                  <span class="hf-body__Para hf-jobs__type hf-body__heading-bold">full time</span>
                </div>
              </div>
              <div id="how_to_apply">
                <a class="hf-body__link hf-body__heading-bold" href="https://hiring.happyfox.co/jobs/frontend-engineer-${city.toLowerCase()}/#apply-section">
                  <span>Apply</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <head><title>Frontend Engineer - Careers at HappyFox</title></head>
  <body>
    <header><a href="https://www.happyfox.com">HappyFox</a><a href="https://www.happyfox.com/jobs/bengaluru/">Back to Bengaluru openings</a></header>
    <h1 class="job-title">Frontend Engineer</h1>
    <div class="job-meta"><span>Bengaluru</span><span>Engineering</span><span>In Person</span></div>
    <div class="job-description">
      <div class="prose prose-wrapper"><p>Build customer-facing product experiences with at least 3 years of relevant professional experience.</p></div>
      <div class="job-actions job-actions-wrapper"><button>Apply</button></div>
    </div>
    <div id="apply-section"><form class="application-form" enctype="multipart/form-data"></form></div>
  </body>
</html>
`

const contractDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Technical Recruiter Intern</h1>
    <p>Bengaluru, Karnataka, India | Human Resources | Contract</p>
    <div>
      <p>Support hiring operations.</p>
      <h2>Application Form</h2>
    </div>
  </body>
</html>
`

const liveLikeDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Frontend Engineer at HappyFox</title>
    <meta property="og:title" content="Frontend Engineer at HappyFox" />
    <meta property="og:description" content="We&rsquo;re looking for an experienced Frontend Engineer to join our growing engineering team. You should apply if: You have at least 3 years of relevant professional experience in building web applications." />
    <script type="application/ld+json">
      {
        "@context": "http://schema.org/",
        "@type": "JobPosting",
        "title": "Frontend Engineer",
        "description": "&lt;p&gt;We&amp;rsquo;re looking for an experienced Frontend Engineer to join our growing engineering team.&lt;/p&gt;&lt;p&gt;You should apply if:&lt;/p&gt;&lt;ul&gt;&lt;li&gt;You have at least 3 years of relevant professional experience in building web applications.&lt;/li&gt;&lt;/ul&gt;",
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Bengaluru",
            "addressRegion": "Karnataka",
            "addressCountry": "India"
          }
        },
        "employmentType": "FULL_TIME"
      }
    </script>
  </head>
  <body>
    <div class="opening-info">
      <span class="meta-job-location-city">Bengaluru</span>
      <span class="meta-job-location-state">Karnataka</span>
      <span class="meta-job-location-country">India</span>
    </div>
    <div class="jobdesciption">
      <p>We’re looking for an experienced Frontend Engineer to join our growing engineering team.</p>
      <p><strong>You should apply if:</strong></p>
      <ul>
        <li>You have at least 3 years of relevant professional experience in building web applications.</li>
      </ul>
    </div>
    <div id="application_holder">
      <h2 class="application-form-title">Application Form</h2>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/happyfox/script.js')
  } catch {
    assert.fail('Expected HappyFox scraper module at ../../scraper/happyfox/script.js')
  }
}

test('HappyFox accepts the current jobs hub and extracts first-party hiring links', async () => {
  const happyfox = await loadModule()

  assert.equal(happyfox.HIRING_JOBS_HOST, 'https://hiring.happyfox.co')
  assert.equal(happyfox.hasOfficialJobsHubSignal(jobsHubHtml), true)
  assert.equal(happyfox.hasOfficialJobDetailSignal(detailHtml), true)
  assert.deepEqual(happyfox.extractIndiaCityPageUrls(jobsHubHtml), [
    'https://www.happyfox.com/jobs/chennai/',
  ])
  assert.deepEqual(
    happyfox.extractListingCards(
      cityPageTemplate('Bengaluru'),
      'https://www.happyfox.com/jobs/bengaluru/',
    ).map((job) => ({
      title: job.title,
      department: job.department,
      detailUrl: job.detailUrl,
    })),
    [
      {
        title: 'Frontend Engineer',
        department: 'Engineering',
        detailUrl: 'https://hiring.happyfox.co/jobs/frontend-engineer-bengaluru/',
      },
    ],
  )
})

test('HappyFox current runtime checks all regional pages and native details before a caller output cap', async () => {
  const happyfox = await loadModule()
  const options = happyFoxNativeOptions()
  const jobs = await happyfox.createHappyFoxScraper({ maxJobs: 1 }).run({
    ...options,
    now: () => '2026-10-26T12:00:00.000Z',
  })
  assert.equal(options.calls.length, 64)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'happyfox')
  assert.equal(jobs[0].company, 'HappyFox')
  assert.equal(jobs[0].location, 'Chennai, India')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].applyUrl, 'https://hiring.happyfox.co/jobs/senior-seo-specialist-chennai/#apply-section')
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('HappyFox extractJobDetail parses the current first-party hiring page', async () => {
  const happyfox = await loadModule()

  const detail = happyfox.extractJobDetail(detailHtml, {
    title: 'Frontend Engineer',
    department: 'Engineering',
    locationHint: 'Bengaluru | full time',
    detailUrl: 'https://hiring.happyfox.co/jobs/frontend-engineer-bengaluru/',
    sourceUrl: 'https://hiring.happyfox.co/jobs/frontend-engineer-bengaluru/',
    applyUrl: 'https://hiring.happyfox.co/jobs/frontend-engineer-bengaluru/',
    jobId: 'frontend-engineer-bengaluru',
    requisitionId: 'frontend-engineer-bengaluru',
  })

  assert.equal(detail.title, 'Frontend Engineer')
  assert.equal(detail.department, 'Engineering')
  assert.equal(detail.location, 'Bengaluru, India')
  assert.equal(detail.city, 'Bengaluru')
  assert.equal(detail.country, 'India')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '3 years')
  assert.equal(detail.publicExperienceChecked, false)
  assert.match(detail.jobDescription, /customer-facing product experiences/i)
})
