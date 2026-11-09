import assert from 'node:assert/strict'
import test from 'node:test'

const loadAkasaAirModule = async () => {
  try {
    return await import('../../scraper/akasaair/script.js')
  } catch {
    assert.fail('Expected Akasa Air scraper module at ../../scraper/akasaair/script.js')
  }
}

const careersLandingHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers at Akasa Air</title>
    <link rel="canonical" href="https://www.akasaair.com/careers-at-akasa-air/now-hiring" />
    <meta name="keywords" content="careers, hiring, pilots, cabin crew, akasa air, corporate, commercial, jobs, opportunities, airline" />
  </head>
  <body>
    <h1>Now Hiring</h1>
    <p>Important notice for job applicants</p>
    <a href="mailto:jobverification@akasaair.com">jobverification@akasaair.com</a>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.akasaair.com/careers-at-akasa-air/now-hiring</loc></url>
  <url><loc>https://www.akasaair.com/careers-at-akasa-air/crew-careers-at-akasa-air</loc></url>
  <url><loc>https://www.akasaair.com/careers-at-akasa-air/pilots-careers-at-akasa-air</loc></url>
  <url><loc>https://www.akasaair.com/careers-at-akasa-air/corporate-and-commercial-careers-at-akasa-air</loc></url>
  <url><loc>https://www.akasaair.com/careers-at-akasa-air/why-join-akasa</loc></url>
  <url><loc>https://www.akasaair.com/careers-at-akasa-air/diversity-and-inclusion-careers-at-akasa-air</loc></url>
</urlset>
`

const crewRoleHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Hiring Cabin Crew - Careers at Akasa Air</title>
    <link rel="canonical" href="https://www.akasaair.com/careers-at-akasa-air/crew-careers-at-akasa-air" />
    <meta name="description" content="Join our inflight services community at Akasa Air." />
  </head>
  <body>
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"story":{"content":{"body":[{"Name":"Opportunities","body":[{"link":{"url":"https://careers-akasa.peoplestrong.com/job/joblist"},"text":"Apply","component":"button"}]},{"name":"Job Posting Schema","schema":"{ \\"@context\\": \\"https://schema.org/\\", \\"@type\\": \\"JobPosting\\", \\"name\\": \\"Hiring Cabin Crew at Akasa Air\\", \\"applicantLocationRequirements\\": { \\"@type\\": \\"Country\\", \\"name\\": \\"India\\" } }"}]}}}}
    </script>
    <h1>Hiring Cabin Crew</h1>
  </body>
</html>
`

const pilotRoleHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Hiring Pilots - Careers at Akasa Air</title>
    <link rel="canonical" href="https://www.akasaair.com/careers-at-akasa-air/pilots-careers-at-akasa-air" />
    <meta name="description" content="Pilots at Akasa Air can build a future-ready career on the B737 MAX fleet." />
  </head>
  <body>
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"story":{"content":{"body":[{"Name":"Experienced First Officers","body":[]},{"Name":"Pilot opportunities","body":[{"body":"Experienced First Officers","component":"p"},{"link":{"url":"https://forms.office.com/pages/responsepage.aspx?id=9ZowM48mvkq4Z3pFDULIGiuhPAGD1SNKuPL2TTPwggtUQ0hDTTBJR1hLRlE5R0ZaRVJQSkpUUURFRi4u&route=shorturl"},"text":"Apply Now","component":"button"}]},{"name":"Job Posting Schema","schema":"{ \\"@context\\": \\"https://schema.org/\\", \\"@type\\": \\"JobPosting\\", \\"name\\": \\"Hiring Pilots at Akasa Air\\", \\"applicantLocationRequirements\\": { \\"@type\\": \\"Country\\", \\"name\\": \\"India\\" } }"}]}}}}
    </script>
    <h1>Hiring Pilots</h1>
    <p>Experienced First Officers</p>
  </body>
</html>
`

const corporateRoleHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Corporate and Commercial - Careers at Akasa Air</title>
    <link rel="canonical" href="https://www.akasaair.com/careers-at-akasa-air/corporate-and-commercial-careers-at-akasa-air" />
    <meta name="description" content="Corporate and commercial career opportunities at Akasa Air." />
  </head>
  <body>
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"story":{"content":{"body":[{"Name":"Opportunities","body":[{"link":{"url":"https://careers-akasa.peoplestrong.com/job/joblist"},"text":"Apply","component":"button"}]},{"name":"Job Posting Schema","schema":"{ \\"@context\\": \\"https://schema.org/\\", \\"@type\\": \\"JobPosting\\", \\"name\\": \\"Corporate and Commercial Career Opportunities at Akasa Air\\", \\"applicantLocationRequirements\\": { \\"@type\\": \\"Country\\", \\"name\\": \\"India\\" } }"}]}}}}
    </script>
    <h1>Corporate and Commercial</h1>
  </body>
</html>
`

const brokenPeopleStrongPage = {
  status: 404,
  url: 'https://careers-akasa.peoplestrong.com/job/joblist',
  html: '<html><head><title>404 Not Found</title></head><body><h1>404</h1></body></html>',
}

const workingOfficeFormPage = {
  status: 200,
  url: 'https://forms.office.com/pages/responsepage.aspx?id=9ZowM48mvkq4Z3pFDULIGiuhPAGD1SNKuPL2TTPwggtUQ0hDTTBJR1hLRlE5R0ZaRVJQSkpUUURFRi4u&route=shorturl',
  html: '<html><head><title>Microsoft Forms</title></head><body><form></form></body></html>',
}

const redirectedWorkingOfficeFormPage = {
  status: 200,
  url: 'https://forms.cloud.microsoft/pages/responsepage.aspx?id=9ZowM48mvkq4Z3pFDULIGiuhPAGD1SNKuPL2TTPwggtUQ0hDTTBJR1hLRlE5R0ZaRVJQSkpUUURFRi4u&route=shorturl',
  html: '<html><head><title>Microsoft Forms</title></head><body><form></form></body></html>',
}

test('Akasa Air helpers stay pinned to the verified careers landing page, sitemap role discovery, and mixed handoff signals', async () => {
  const akasaAir = await loadAkasaAirModule()

  assert.equal(akasaAir.SOURCE, 'akasaair')
  assert.equal(akasaAir.COMPANY, 'Akasa Air')
  assert.equal(akasaAir.OFFICIAL_BRAND_NAME, 'Akasa Air')
  assert.equal(akasaAir.VERIFIED_ON, '2026-07-15')
  assert.equal(akasaAir.CAREERS_REDIRECT_URL, 'https://www.akasaair.com/careers')
  assert.equal(
    akasaAir.CAREERS_LANDING_URL,
    'https://www.akasaair.com/careers-at-akasa-air/now-hiring',
  )
  assert.equal(akasaAir.SITEMAP_URL, 'https://www.akasaair.com/sitemap.xml')
  assert.deepEqual(akasaAir.ROLE_PAGE_URLS, [
    'https://www.akasaair.com/careers-at-akasa-air/crew-careers-at-akasa-air',
    'https://www.akasaair.com/careers-at-akasa-air/pilots-careers-at-akasa-air',
    'https://www.akasaair.com/careers-at-akasa-air/corporate-and-commercial-careers-at-akasa-air',
  ])
  assert.equal(
    akasaAir.BROKEN_PEOPLESTRONG_JOBLIST_URL,
    'https://careers-akasa.peoplestrong.com/job/joblist',
  )
  assert.equal(
    akasaAir.PILOT_APPLY_URL,
    'https://forms.office.com/pages/responsepage.aspx?id=9ZowM48mvkq4Z3pFDULIGiuhPAGD1SNKuPL2TTPwggtUQ0hDTTBJR1hLRlE5R0ZaRVJQSkpUUURFRi4u&route=shorturl',
  )
  assert.equal(akasaAir.hasCareersLandingSignal(careersLandingHtml), true)
  assert.deepEqual(akasaAir.extractCareerRoleUrlsFromSitemap(sitemapXml), akasaAir.ROLE_PAGE_URLS)
  assert.equal(akasaAir.extractApplyUrl(crewRoleHtml), akasaAir.BROKEN_PEOPLESTRONG_JOBLIST_URL)
  assert.equal(akasaAir.extractApplyUrl(pilotRoleHtml), akasaAir.PILOT_APPLY_URL)
  assert.equal(
    akasaAir.extractApplyUrl(corporateRoleHtml),
    akasaAir.BROKEN_PEOPLESTRONG_JOBLIST_URL,
  )
  assert.equal(akasaAir.hasJobPostingSignal(crewRoleHtml), true)
  assert.equal(akasaAir.hasJobPostingSignal(pilotRoleHtml), true)
  assert.equal(akasaAir.hasJobPostingSignal(corporateRoleHtml), true)
  assert.equal(akasaAir.isBrokenPeopleStrongSurface(brokenPeopleStrongPage), true)
  assert.equal(akasaAir.isWorkingOfficeFormSurface(workingOfficeFormPage), true)
  assert.equal(akasaAir.isWorkingOfficeFormSurface(redirectedWorkingOfficeFormPage), true)
})

test('Akasa Air run returns only the live pilot posting and filters role pages whose official apply handoff is currently broken', async () => {
  const akasaAir = await loadAkasaAirModule()
  const requestedUrls = []

  const jobs = await akasaAir.createAkasaAirScraper({
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === akasaAir.CAREERS_REDIRECT_URL) {
        return {
          status: 200,
          url: akasaAir.CAREERS_LANDING_URL,
          html: careersLandingHtml,
        }
      }

      if (url === akasaAir.SITEMAP_URL) {
        return {
          status: 200,
          url,
          html: sitemapXml,
        }
      }

      if (url === akasaAir.ROLE_PAGE_URLS[0]) {
        return {
          status: 200,
          url,
          html: crewRoleHtml,
        }
      }

      if (url === akasaAir.ROLE_PAGE_URLS[1]) {
        return {
          status: 200,
          url,
          html: pilotRoleHtml,
        }
      }

      if (url === akasaAir.ROLE_PAGE_URLS[2]) {
        return {
          status: 200,
          url,
          html: corporateRoleHtml,
        }
      }

      if (url === akasaAir.BROKEN_PEOPLESTRONG_JOBLIST_URL) {
        return brokenPeopleStrongPage
      }

      if (url === akasaAir.PILOT_APPLY_URL) {
        return workingOfficeFormPage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    akasaAir.CAREERS_REDIRECT_URL,
    akasaAir.SITEMAP_URL,
    akasaAir.ROLE_PAGE_URLS[0],
    akasaAir.BROKEN_PEOPLESTRONG_JOBLIST_URL,
    akasaAir.ROLE_PAGE_URLS[1],
    akasaAir.PILOT_APPLY_URL,
    akasaAir.ROLE_PAGE_URLS[2],
    akasaAir.BROKEN_PEOPLESTRONG_JOBLIST_URL,
  ])

  assert.deepEqual(jobs, [
    {
      title: 'Hiring Pilots',
      company: 'Akasa Air',
      department: 'Pilots',
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'pilots-careers-at-akasa-air',
      requisitionId: null,
      sourceUrl: 'https://www.akasaair.com/careers-at-akasa-air/pilots-careers-at-akasa-air',
      applyUrl: 'https://forms.office.com/pages/responsepage.aspx?id=9ZowM48mvkq4Z3pFDULIGiuhPAGD1SNKuPL2TTPwggtUQ0hDTTBJR1hLRlE5R0ZaRVJQSkpUUURFRi4u&route=shorturl',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Pilots at Akasa Air can build a future-ready career on the B737 MAX fleet.',
      source: 'akasaair',
      link: 'https://forms.office.com/pages/responsepage.aspx?id=9ZowM48mvkq4Z3pFDULIGiuhPAGD1SNKuPL2TTPwggtUQ0hDTTBJR1hLRlE5R0ZaRVJQSkpUUURFRi4u&route=shorturl',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
  ])
})

test('Akasa Air run propagates the runner abort signal to each page fetch', async () => {
  const akasaAir = await loadAkasaAirModule()
  const controller = new AbortController()
  const seenSignals = []

  await akasaAir.createAkasaAirScraper().run({
    signal: controller.signal,
    fetchPage: async (url, { signal } = {}) => {
      seenSignals.push(signal)

      if (url === akasaAir.CAREERS_REDIRECT_URL) {
        return {
          status: 200,
          url: akasaAir.CAREERS_LANDING_URL,
          html: careersLandingHtml,
        }
      }

      if (url === akasaAir.SITEMAP_URL) {
        return {
          status: 200,
          url,
          html: sitemapXml,
        }
      }

      if (url === akasaAir.ROLE_PAGE_URLS[0]) {
        return {
          status: 200,
          url,
          html: crewRoleHtml,
        }
      }

      if (url === akasaAir.ROLE_PAGE_URLS[1]) {
        return {
          status: 200,
          url,
          html: pilotRoleHtml,
        }
      }

      if (url === akasaAir.ROLE_PAGE_URLS[2]) {
        return {
          status: 200,
          url,
          html: corporateRoleHtml,
        }
      }

      if (url === akasaAir.BROKEN_PEOPLESTRONG_JOBLIST_URL) {
        return brokenPeopleStrongPage
      }

      if (url === akasaAir.PILOT_APPLY_URL) {
        return workingOfficeFormPage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(seenSignals.length, 8)
  assert.ok(seenSignals.every((signal) => signal === controller.signal))
})

test('Akasa Air fails closed when the first-party landing page, sitemap role set, pilot handoff, or broken PeopleStrong state drifts', async () => {
  const akasaAir = await loadAkasaAirModule()

  await assert.rejects(
    akasaAir.createAkasaAirScraper().run({
      fetchPage: async (url) => {
        if (url === akasaAir.CAREERS_REDIRECT_URL) {
          return {
            status: 200,
            url: akasaAir.CAREERS_LANDING_URL,
            html: '<html><head><title>Unexpected</title></head><body></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers landing page/i,
  )

  await assert.rejects(
    akasaAir.createAkasaAirScraper().run({
      fetchPage: async (url) => {
        if (url === akasaAir.CAREERS_REDIRECT_URL) {
          return {
            status: 200,
            url: akasaAir.CAREERS_LANDING_URL,
            html: careersLandingHtml,
          }
        }

        if (url === akasaAir.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml.replace(
              '<url><loc>https://www.akasaair.com/careers-at-akasa-air/pilots-careers-at-akasa-air</loc></url>',
              '',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified role-page sitemap set/i,
  )

  await assert.rejects(
    akasaAir.createAkasaAirScraper().run({
      fetchPage: async (url) => {
        if (url === akasaAir.CAREERS_REDIRECT_URL) {
          return {
            status: 200,
            url: akasaAir.CAREERS_LANDING_URL,
            html: careersLandingHtml,
          }
        }

        if (url === akasaAir.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml,
          }
        }

        if (url === akasaAir.ROLE_PAGE_URLS[0]) {
          return { status: 200, url, html: crewRoleHtml }
        }

        if (url === akasaAir.ROLE_PAGE_URLS[1]) {
          return {
            status: 200,
            url,
            html: pilotRoleHtml.replace(
              akasaAir.PILOT_APPLY_URL,
              'https://example.com/apply',
            ),
          }
        }

        if (url === akasaAir.BROKEN_PEOPLESTRONG_JOBLIST_URL) {
          return brokenPeopleStrongPage
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified role page surface/i,
  )

  await assert.rejects(
    akasaAir.createAkasaAirScraper().run({
      fetchPage: async (url) => {
        if (url === akasaAir.CAREERS_REDIRECT_URL) {
          return {
            status: 200,
            url: akasaAir.CAREERS_LANDING_URL,
            html: careersLandingHtml,
          }
        }

        if (url === akasaAir.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml,
          }
        }

        if (url === akasaAir.ROLE_PAGE_URLS[0]) {
          return { status: 200, url, html: crewRoleHtml }
        }

        if (url === akasaAir.ROLE_PAGE_URLS[1]) {
          return { status: 200, url, html: pilotRoleHtml }
        }

        if (url === akasaAir.ROLE_PAGE_URLS[2]) {
          return { status: 200, url, html: corporateRoleHtml }
        }

        if (url === akasaAir.BROKEN_PEOPLESTRONG_JOBLIST_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Open Jobs</title></head><body>Jobs</body></html>',
          }
        }

        if (url === akasaAir.PILOT_APPLY_URL) {
          return workingOfficeFormPage
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /broken peoplestrong handoff/i,
  )
})
