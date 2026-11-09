import assert from 'node:assert/strict'
import test from 'node:test'

import { createPublicisSapientScraper } from '../../scraper/publicissapient/script.js'

const sampleListingPayload = {
  response: {
    numFound: 2,
    start: 0,
    docs: [
      {
        id: '2026-144903',
        name: 'Senior Associate Data Engineering L2',
        typeOfEmployment: 'Full-time',
        experienceLevel: 'Associate Level',
        city: 'Bengaluru',
        countryName: 'India',
        displayLocation: 'Bengaluru, Karnataka, India',
        jobUrl: 'https://sapient-publicisgroupe.icims.com/jobs/144903/job/login',
        releasedDate: '2026-06-19T07:43:00Z',
        teams: 'Technology and Engineering',
        jobDetailUrl: '/job-details/2026-144903-senior-associate-data-engineering-l2-bengaluru',
        jobId: '2026-144903',
      },
      {
        id: '2026-144904',
        name: 'Manager Data Engineering',
        typeOfEmployment: 'Full-time',
        experienceLevel: 'Senior Level',
        city: 'Gurgaon',
        countryName: 'India',
        displayLocation: 'Gurgaon, Haryana, India',
        jobUrl: 'https://sapient-publicisgroupe.icims.com/jobs/144904/job/login',
        releasedDate: '2026-07-01T10:20:00Z',
        teams: 'Technology and Engineering',
        jobDetailUrl: '/job-details/2026-144904-manager-data-engineering-gurgaon',
        jobId: '2026-144904',
      },
    ],
  },
}

const sampleDetailHtml = `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "Senior Associate Data Engineering L2",
  "description": "Senior Associate L2 &ndash; Data Engineering",
  "datePosted": "2026-06-19T07:43:00Z",
  "employmentType": "Full-time",
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "2870 Bagmane Constellation Business Park Bengaluru Karnataka 560037 India",
      "addressRegion": "Karnataka",
      "addressCountry": "India"
    }
  }
}
</script>
<div class="job-details-header">
  <p class="job-details-header-teams">Technology and Engineering</p>
  <h1 class="job-title">Senior Associate Data Engineering L2</h1>
  <ul class="tag-list">
    <li class="level-item">Job ID: 2026-144903</li>
    <li class="level-item">Bengaluru, Karnataka, India</li>
    <li class="level-item">Full-time</li>
  </ul>
  <div class="controls">
    <a v-bind:href="'https://sapient-publicisgroupe.icims.com/jobs/144903/job/login?'+srQueryPerem" class="button is-rounded apply-now">Apply now</a>
  </div>
</div>
<div class="job-details-content content">
  <div class="add-half-top-module-margin">
    <h2>Job Description</h2>
    <div><p>Design and deliver scalable data engineering solutions.</p></div>
  </div>
  <div class="add-half-top-module-margin">
    <h2>Qualifications</h2>
    <div>
      <p>Your Skills &amp; Experience:</p>
      <ul>
        <li>6+ years of IT experience</li>
        <li>Strong programming expertise in Scala or Python</li>
      </ul>
    </div>
  </div>
  <div class="add-half-top-module-margin">
    <h2>Additional Information</h2>
    <div>
      <ul>
        <li>Relevant cloud or big data certifications</li>
      </ul>
    </div>
  </div>
</div>
</div>
<div class="siov-column is-4-desktop job-details-other-jobs"></div>
`

const liveShapeDetailHtml = `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "Manager Data Engineering",
  "description": "Manager - Data Engineering Publicis Sapient is seeking a Manager - Data Engineering to join our high-performing engineering team.",
  "datePosted": "2026-07-01T10:20:00Z",
  "employmentType": "Full-time",
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Tower B, Bldg. No.8, Candor Infospace, Sector 21 Gurgaon Haryana 122016 India",
      "addressRegion": "Haryana",
      "addressCountry": "India"
    }
  }
}
</script>
<div data-job-details='{&#34;jobDescriptionSection&#34;:{&#34;title&#34;:&#34;Job Description&#34;,&#34;body&#34;:&#34;&lt;p>&lt;strong>Manager &amp;ndash; Data Engineering&lt;/strong>&lt;/p>&lt;p>Publicis Sapient is seeking a Manager &amp;ndash; Data Engineering to join our high-performing engineering team.&lt;/p>&lt;p>&amp;bull; Lead large-scale cloud data engineering programs.&lt;/p>&#34;},&#34;qualificationDescriptionSection&#34;:{&#34;title&#34;:&#34;Qualifications&#34;,&#34;body&#34;:&#34;&lt;p>&lt;strong>&lt;u>Your Skills &amp;amp; Experience:&lt;/u>&lt;/strong>&lt;/p>&lt;p>&amp;bull; 8+ years of IT experience, with 5+ years in data engineering, big data, or related technologies.&lt;/p>&lt;p>&amp;bull; Strong hands-on expertise in Python (Scala as secondary).&lt;/p>&#34;},&#34;additionalInformationSection&#34;:{&#34;title&#34;:&#34;Additional Information&#34;,&#34;body&#34;:&#34;&lt;p>&amp;bull; Relevant cloud or big data certifications.&lt;/p>&lt;p>&lt;span style=\\&#34;text-decoration: underline;\\&#34;>&lt;strong>Benefits of Working Here:&lt;/strong>&lt;/span>&lt;/p>&#34;},&#34;companyDetailsSection&#34;:{&#34;title&#34;:&#34;Company Description&#34;,&#34;body&#34;:&#34;&lt;p>Publicis Sapient is a digital transformation partner.&lt;/p>&#34;},&#34;primaryCta&#34;:{&#34;ctaLabel&#34;:&#34;Apply now&#34;,&#34;ctaAriaLabel&#34;:&#34;Apply now&#34;,&#34;ctaLinkUrl&#34;:&#34;https://sapient-publicisgroupe.icims.com/jobs/144904/job/login&#34;,&#34;ctaOpenLinkInNewTab&#34;:true,&#34;ctaIconType&#34;:&#34;arrow-right&#34;},&#34;:type&#34;:&#34;ps-redesign/components/jobDetails&#34;}' id="job-details-id"></div>
<div class="h-full">
  <p class="sr-only">Technology and Engineering</p>
  <p class="sr-only">Manager Data Engineering</p>
  <p class="sr-only">Job ID: 2026-144904 | Tower B, Bldg. No.8, Candor Infospace, Sector 21 Gurgaon Haryana 122016 India | Full-time</p>
  <a class="sr-only" href="https://sapient-publicisgroupe.icims.com/jobs/144904/job/login">Apply now</a>
</div>
`

test('buildJobsApiUrl keeps the Publicis Sapient India filter on the official search endpoint', () => {
  const scraper = createPublicisSapientScraper()

  assert.equal(
    scraper.buildJobsApiUrl({ start: 50, rows: 25 }),
    'https://careers.publicissapient.com/apps/ps-rebrand/careersJobsearch?searchType=%2Fsearch&lang=en&q=&start=50&rows=25&country=India',
  )
})

test('extractJobsPayload and normalizeJobListing keep the public Solr response contract intact', () => {
  const scraper = createPublicisSapientScraper()
  const payload = scraper.extractJobsPayload(sampleListingPayload)
  const listing = scraper.normalizeJobListing(payload.jobs[0])

  assert.equal(payload.totalCount, 2)
  assert.equal(payload.jobs.length, 2)
  assert.deepEqual(listing, {
    title: 'Senior Associate Data Engineering L2',
    department: 'Technology and Engineering',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '2026-144903',
    requisitionId: '2026-144903',
    employmentType: 'Full-time',
    experienceRequired: 'Associate Level',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-19T07:43:00Z',
    closingDate: null,
    sourceUrl: 'https://careers.publicissapient.com/job-details/2026-144903-senior-associate-data-engineering-l2-bengaluru',
    applyUrl: 'https://sapient-publicisgroupe.icims.com/jobs/144903/job/login',
    jobDescription: null,
  })
})

test('extractJobDetail reads the branded detail page sections, apply URL, and JSON-LD fallback fields', () => {
  const scraper = createPublicisSapientScraper()
  const detail = scraper.extractJobDetail(sampleDetailHtml, {
    title: 'Senior Associate Data Engineering L2',
    department: 'Technology and Engineering',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    employmentType: 'Full-time',
    applyUrl: 'https://sapient-publicisgroupe.icims.com/jobs/144903/job/login',
    sourceUrl: 'https://careers.publicissapient.com/job-details/2026-144903-senior-associate-data-engineering-l2-bengaluru',
    postingDate: '2026-06-19T07:43:00Z',
  })

  assert.equal(detail.title, 'Senior Associate Data Engineering L2')
  assert.equal(detail.department, 'Technology and Engineering')
  assert.equal(detail.location, 'Bengaluru, Karnataka, India')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.applyUrl, 'https://sapient-publicisgroupe.icims.com/jobs/144903/job/login')
  assert.match(detail.jobDescription, /Design and deliver scalable data engineering solutions/i)
  assert.match(detail.minimumQualification, /6\+ years of IT experience/i)
  assert.match(detail.preferredQualification, /Relevant cloud or big data certifications/i)
  assert.equal(detail.publicExperienceChecked, true)
  assert.deepEqual(detail.requiredSkills, [
    '6+ years of IT experience',
    'Strong programming expertise in Scala or Python',
  ])
})

test('extractJobDetail reads the current embedded Publicis job-details payload used on the live page', () => {
  const scraper = createPublicisSapientScraper()
  const detail = scraper.extractJobDetail(liveShapeDetailHtml, {
    title: 'Manager Data Engineering',
    department: 'Technology and Engineering',
    location: 'Gurgaon, Haryana, India',
    city: 'Gurgaon',
    country: 'India',
    employmentType: 'Full-time',
    applyUrl: 'https://sapient-publicisgroupe.icims.com/jobs/144904/job/login',
    sourceUrl: 'https://careers.publicissapient.com/job-details/2026-144904-manager-data-engineering-gurgaon',
    postingDate: '2026-07-01T10:20:00Z',
  })

  assert.equal(detail.title, 'Manager Data Engineering')
  assert.equal(detail.location, 'Tower B, Bldg. No.8, Candor Infospace, Sector 21 Gurgaon Haryana 122016 India, Haryana, India')
  assert.equal(detail.applyUrl, 'https://sapient-publicisgroupe.icims.com/jobs/144904/job/login')
  assert.match(detail.jobDescription, /high-performing engineering team/i)
  assert.match(detail.minimumQualification, /8\+ years of IT experience/i)
  assert.match(detail.preferredQualification, /Relevant cloud or big data certifications/i)
  assert.equal(detail.publicExperienceChecked, true)
  assert.deepEqual(detail.requiredSkills, [
    '8+ years of IT experience, with 5+ years in data engineering, big data, or related technologies.',
    'Strong hands-on expertise in Python (Scala as secondary).',
  ])
})

test('run paginates the Publicis Sapient JSON endpoint and enriches each listing with detail fields', async () => {
  const scraper = createPublicisSapientScraper()
  const requestedJsonUrls = []
  const requestedDetailUrls = []
  const detailHtmlByUrl = new Map([
    [
      'https://careers.publicissapient.com/job-details/2026-144903-senior-associate-data-engineering-l2-bengaluru',
      sampleDetailHtml,
    ],
    [
      'https://careers.publicissapient.com/job-details/2026-144904-manager-data-engineering-gurgaon',
      sampleDetailHtml
        .replace(/144903/g, '144904')
        .replace(/Senior Associate Data Engineering L2/g, 'Manager Data Engineering')
        .replace(/Bengaluru/g, 'Gurgaon'),
    ],
  ])

  const jobs = await scraper.run({
    rows: 1,
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url.includes('start=0')) {
        return {
          response: {
            numFound: 2,
            start: 0,
            docs: [sampleListingPayload.response.docs[0]],
          },
        }
      }

      if (url.includes('start=1')) {
        return {
          response: {
            numFound: 2,
            start: 1,
            docs: [sampleListingPayload.response.docs[1]],
          },
        }
      }

      return {
        response: {
          numFound: 2,
          start: 2,
          docs: [],
        },
      }
    },
    fetchText: async (url) => {
      requestedDetailUrls.push(url)
      return detailHtmlByUrl.get(url)
    },
  })

  assert.deepEqual(requestedJsonUrls, [
    'https://careers.publicissapient.com/apps/ps-rebrand/careersJobsearch?searchType=%2Fsearch&lang=en&q=&start=0&rows=1&country=India',
    'https://careers.publicissapient.com/apps/ps-rebrand/careersJobsearch?searchType=%2Fsearch&lang=en&q=&start=1&rows=1&country=India',
  ])
  assert.deepEqual(requestedDetailUrls, [
    'https://careers.publicissapient.com/job-details/2026-144903-senior-associate-data-engineering-l2-bengaluru',
    'https://careers.publicissapient.com/job-details/2026-144904-manager-data-engineering-gurgaon',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Publicis Sapient')
  assert.equal(jobs[0].source, 'publicissapient')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(
    jobs[0].link,
    'https://sapient-publicisgroupe.icims.com/jobs/144903/job/login',
  )
})

test('run keeps location-specific variants when Publicis reuses the same jobId across multiple detail URLs', async () => {
  const scraper = createPublicisSapientScraper()

  const jobs = await scraper.run({
    rows: 50,
    fetchJson: async () => ({
      response: {
        numFound: 2,
        start: 0,
        docs: [
          {
            ...sampleListingPayload.response.docs[0],
            jobId: '2026-144903',
            id: '2026-144903',
            city: 'Bengaluru',
            displayLocation: 'Bengaluru, Karnataka, India',
            jobDetailUrl: '/job-details/2026-144903-senior-associate-data-engineering-l2-bengaluru',
          },
          {
            ...sampleListingPayload.response.docs[0],
            jobId: '2026-144903',
            id: '2026-144903',
            city: 'Gurgaon',
            displayLocation: 'Gurgaon, Haryana, India',
            jobDetailUrl: '/job-details/2026-144903-1056675-senior-associate-data-engineering-l2-gurgaon',
          },
        ],
      },
    }),
    fetchText: async (url) => (
      url.includes('gurgaon')
        ? sampleDetailHtml
          .replace(/Bengaluru/g, 'Gurgaon')
          .replace(/144903\/job\/login/g, '144903/job/login')
        : sampleDetailHtml
    ),
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobId, '2026-144903')
  assert.equal(jobs[1].jobId, '2026-144903')
  assert.notEqual(jobs[0].sourceUrl, jobs[1].sourceUrl)
})
