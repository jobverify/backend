import assert from 'node:assert/strict'
import test from 'node:test'

const loadZonesModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Zones India | IT Solutions</title>
  </head>
  <body>
    <header>
      <a href="https://in.zones.com/">Zones India</a>
      <a href="https://in.zones.com/privacy-policy/">Privacy Policy</a>
    </header>
    <main>
      <h1>Zones India</h1>
      <p>Technology solutions and services for modern workplaces.</p>
    </main>
  </body>
</html>
`

const privacyHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Privacy Policy | Zones India</title>
  </head>
  <body>
    <main>
      <h1>Privacy Policy</h1>
      <p>Zones Corporate Solutions Pvt Ltd is committed to protecting personal data.</p>
    </main>
  </body>
</html>
`

const linkedinCompanyHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Zones India | LinkedIn</title>
  </head>
  <body>
    <meta content="urn:li:organization:14454055">
    <a href="https://in.zones.com/">Website</a>
  </body>
</html>
`

const searchHtml = `
<div
  class="base-card base-card--link base-search-card base-search-card--link job-search-card"
  data-entity-urn="urn:li:jobPosting:111222333">
  <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/111222333?refId=abc&amp;trackingId=xyz"></a>
  <h3 class="base-search-card__title">Cloud Engineer</h3>
  <h4 class="base-search-card__subtitle"><a>Zones India</a></h4>
  <span class="job-search-card__location">Bengaluru, Karnataka, India</span>
  <time class="job-search-card__listdate" datetime="2026-07-11"></time>
</div>
<div
  class="base-card base-card--link base-search-card base-search-card--link job-search-card"
  data-entity-urn="urn:li:jobPosting:444555666">
  <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/444555666"></a>
  <h3 class="base-search-card__title">Service Desk Lead</h3>
  <h4 class="base-search-card__subtitle"><a>Zones India</a></h4>
  <span class="job-search-card__location">Hyderabad, Telangana, India</span>
  <time class="job-search-card__listdate" datetime="2026-07-10"></time>
</div>
<div
  class="base-card base-card--link base-search-card base-search-card--link job-search-card"
  data-entity-urn="urn:li:jobPosting:777888999">
  <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/777888999"></a>
  <h3 class="base-search-card__title">US-only Role</h3>
  <h4 class="base-search-card__subtitle"><a>Zones India</a></h4>
  <span class="job-search-card__location">Seattle, Washington, United States</span>
  <time class="job-search-card__listdate" datetime="2026-07-09"></time>
</div>
`

const detailHtmlByUrl = {
  'https://www.linkedin.com/jobs/view/111222333?refId=abc&trackingId=xyz': `
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Cloud Engineer",
        "description": "<p>Build cloud platforms.</p><ul><li>AWS</li><li>Automation</li></ul>",
        "datePosted": "2026-07-11T10:00:00Z",
        "employmentType": "full_time",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "Zones India"
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
  `,
  'https://www.linkedin.com/jobs/view/444555666': `
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Service Desk Lead",
        "description": "<p>Lead enterprise service desk operations.</p>",
        "datePosted": "2026-07-10T10:00:00Z",
        "employmentType": "contract",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "Zones India"
        },
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Hyderabad",
            "addressRegion": "Telangana",
            "addressCountry": "IN"
          }
        }
      }
    </script>
  `,
}

test('Zones scraper recognizes the verified official site, LinkedIn company page, and India guest-search results', async () => {
  const zones = await loadZonesModule()
  assert.ok(zones, 'Expected scraper module at ./script.js')

  assert.equal(zones.SOURCE, 'zonescorporatesolutionspvtltd')
  assert.equal(zones.COMPANY, 'Zones Corporate Solutions Pvt Ltd')
  assert.equal(zones.HOMEPAGE_URL, 'https://in.zones.com/')
  assert.equal(zones.PRIVACY_POLICY_URL, 'https://in.zones.com/privacy-policy/')
  assert.equal(zones.LINKEDIN_COMPANY_PAGE_URL, 'https://in.linkedin.com/company/zonesindia')
  assert.equal(zones.LINKEDIN_INDIA_JOBS_URL, 'https://www.linkedin.com/jobs/search/?f_C=14454055&geoId=102713980')
  assert.equal(zones.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(zones.hasOfficialPrivacySignal(privacyHtml), true)
  assert.equal(zones.pageIndicatesZonesIndiaCompany(linkedinCompanyHtml), true)
  assert.deepEqual(zones.extractSearchResults(searchHtml), [
    {
      title: 'Cloud Engineer',
      company: 'Zones Corporate Solutions Pvt Ltd',
      department: null,
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '111222333',
      requisitionId: '111222333',
      sourceUrl: 'https://www.linkedin.com/jobs/view/111222333?refId=abc&trackingId=xyz',
      applyUrl: 'https://www.linkedin.com/jobs/view/111222333?refId=abc&trackingId=xyz',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-11',
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Service Desk Lead',
      company: 'Zones Corporate Solutions Pvt Ltd',
      department: null,
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: '444555666',
      requisitionId: '444555666',
      sourceUrl: 'https://www.linkedin.com/jobs/view/444555666',
      applyUrl: 'https://www.linkedin.com/jobs/view/444555666',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-10',
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('run fetches the official-site validators, LinkedIn company page, India jobs page, and detail pages', async () => {
  const zones = await loadZonesModule()
  assert.ok(zones, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await zones.createZonesCorporateSolutionsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === zones.HOMEPAGE_URL) return homepageHtml
      if (url === zones.PRIVACY_POLICY_URL) return privacyHtml
      if (url === zones.LINKEDIN_COMPANY_PAGE_URL) return linkedinCompanyHtml
      if (url === zones.LINKEDIN_INDIA_JOBS_URL) return searchHtml
      if (detailHtmlByUrl[url]) return detailHtmlByUrl[url]
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    zones.HOMEPAGE_URL,
    zones.PRIVACY_POLICY_URL,
    zones.LINKEDIN_COMPANY_PAGE_URL,
    zones.LINKEDIN_INDIA_JOBS_URL,
    'https://www.linkedin.com/jobs/view/111222333?refId=abc&trackingId=xyz',
    'https://www.linkedin.com/jobs/view/444555666',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Zones Corporate Solutions Pvt Ltd')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].source, 'zonescorporatesolutionspvtltd')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[1].employmentType, 'Contract')
})

test('run fails closed when the official or LinkedIn verification surfaces drift', async () => {
  const zones = await loadZonesModule()
  assert.ok(zones, 'Expected scraper module at ./script.js')

  await assert.rejects(
    zones.createZonesCorporateSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === zones.HOMEPAGE_URL) return '<html><body><h1>Unexpected</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official india homepage/i,
  )

  await assert.rejects(
    zones.createZonesCorporateSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === zones.HOMEPAGE_URL) return homepageHtml
        if (url === zones.PRIVACY_POLICY_URL) return '<html><body>No legal entity</body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified privacy page/i,
  )

  await assert.rejects(
    zones.createZonesCorporateSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === zones.HOMEPAGE_URL) return homepageHtml
        if (url === zones.PRIVACY_POLICY_URL) return privacyHtml
        if (url === zones.LINKEDIN_COMPANY_PAGE_URL) return '<html><body>Unknown LinkedIn org</body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified linkedin company page/i,
  )
})
