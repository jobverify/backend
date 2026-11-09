import assert from 'node:assert/strict'
import test from 'node:test'

const loadAaravSolutionsModule = async () => {
  try {
    return await import('../../scraper/aaravsolutions/script.js')
  } catch {
    assert.fail('Expected Aarav Solutions scraper module at ../../scraper/aaravsolutions/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aarav Solutions</title>
  </head>
  <body>
    <main>
      <h2>Let's Shape the Future Together</h2>
      <h2>Unlock Your Business Potential With Oracle and Aarav Solutions</h2>
      <a href="https://www.aaravsolutions.com/careers/">Careers</a>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aarav Solutions</title>
  </head>
  <body>
    <main>
      <section>
        <h1>You At Aarav</h1>
        <h2>Careers</h2>
        <div class="job-board-wrapper">
          <ul class="job-tabs">
            <li class="active" data-tab="ahmedabad">India</li>
            <li data-tab="bangalore">USA</li>
            <li data-tab="uk">UK</li>
            <li data-tab="canada">Canada</li>
          </ul>
          <div class="job-content active" id="ahmedabad">
            <div class="job-item">
              <a href="#career-form"><h3>Lead BRM Developer</h3></a>
              <span class="job-location">India</span>
            </div>
            <div class="job-item">
              <a href="#career-form"><h3>Graphic Designer</h3></a>
              <span class="job-location">India</span>
            </div>
            <div class="job-item">
              <a href="#career-form"><h3>Senior Odoo Developer</h3></a>
              <span class="job-location">India</span>
            </div>
            <div class="job-item">
              <a href="#career-form"><h3>FrontEnd Developer</h3></a>
              <span class="job-location">India</span>
            </div>
          </div>
          <div class="job-content" id="bangalore">
            <div class="job-item">
              <a href="#career-form"><h3>Senior Architect</h3></a>
              <span class="job-location">USA</span>
            </div>
          </div>
          <div class="job-content" id="uk">
            <div class="job-item">
              <a href="#career-form"><h3>VP Sales</h3></a>
              <span class="job-location">UK</span>
            </div>
          </div>
          <div class="job-content" id="canada">
            <div class="job-item">
              <a href="#career-form"><h3>Lead BRM Developer</h3></a>
              <span class="job-location">Canada</span>
            </div>
          </div>
        </div>
      </section>
      <section class="career-banner">
        <h2>Want to accelerate your career with us.</h2>
        <a href="https://in.linkedin.com/company/aarav-solutions-private-limited">
          Stay updated on the latest opportunities follow us on LinkedIn
        </a>
      </section>
      <section id="career-form" class="contact-section">
        <h1>Discover your new career with Aarav Solutions.</h1>
        <p>Explore opportunities that challenge you, inspire you, and move your career forward.</p>
        <script>
          hbspt.forms.create({
            portalId: "22580721",
            formId: "5ddff43e-dbd5-41aa-ba85-e1060ab84790",
            region: "na1"
          });
        </script>
      </section>
    </main>
  </body>
</html>
`

const careersHtmlWithoutHubSpot = careersHtml.replace(
  /<script>[\s\S]*?<\/script>/i,
  '<div class="contact-form-wrapper">Apply here</div>',
)

const careersHtmlWithoutIndiaRoles = careersHtml.replace(
  /<div class="job-content active" id="ahmedabad">[\s\S]*?<\/div>\s*<div class="job-content" id="bangalore">/i,
  `<div class="job-content active" id="ahmedabad"></div>
          <div class="job-content" id="bangalore">`,
)

const careersHtmlWithCurrentTitleAndHeading = careersHtml
  .replace(
    '<title>Aarav Solutions</title>',
    '<title>Careers - Aarav Solutions</title>',
  )
  .replace(
    '<h1>You At Aarav</h1>',
    '<h2>Life at Aarav Solutions</h2>',
  )

const structuredCareersHtml = `
<html><head><title>Careers - Aarav Solutions</title></head><body>
  <section id="open-roles"><h2>Current openings</h2>
    <article class="ac-role" id="lead-engineer-odoo-ai"><h3>Lead Engineer, Odoo &amp; AI</h3></article>
    <article class="ac-role" id="us-only-role"><h3>US Only Role</h3></article>
  </section>
  <section id="apply"><form><input name="job-title"></form></section>
  <script type="application/ld+json">${JSON.stringify([
    {
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      title: 'Lead Engineer, Odoo & AI',
      description: '<p>Build Odoo modules and production AI applications.</p>',
      datePosted: '2026-09-11',
      employmentType: 'FULL_TIME',
      url: 'https://www.aaravsolutions.com/careers/#lead-engineer-odoo-ai',
      hiringOrganization: { '@type': 'Organization', name: 'Aarav Solutions', sameAs: 'https://www.aaravsolutions.com' },
      jobLocationType: 'TELECOMMUTE',
      applicantLocationRequirements: [{ '@type': 'Country', name: 'India' }, { '@type': 'Country', name: 'United States' }],
    },
    {
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      title: 'US Only Role',
      description: '<p>US applicants only.</p>',
      datePosted: '2026-09-11',
      employmentType: 'FULL_TIME',
      url: 'https://www.aaravsolutions.com/careers/#us-only-role',
      hiringOrganization: { '@type': 'Organization', name: 'Aarav Solutions', sameAs: 'https://www.aaravsolutions.com' },
      jobLocationType: 'TELECOMMUTE',
      applicantLocationRequirements: [{ '@type': 'Country', name: 'United States' }],
    },
  ])}</script>
</body></html>
`

test('run extracts current structured Aarav roles only when India is explicitly eligible', async () => {
  const aarav = await loadAaravSolutionsModule()
  const jobs = await aarav.createAaravSolutionsScraper({
    now: () => '2026-10-02T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => ({
      status: 200,
      url,
      html: url === aarav.HOMEPAGE_URL ? homepageHtml : structuredCareersHtml,
    }),
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Lead Engineer, Odoo & AI')
  assert.equal(jobs[0].location, 'Remote, India')
  assert.equal(jobs[0].sourceUrl, 'https://www.aaravsolutions.com/careers/#lead-engineer-odoo-ai')
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
  assert.equal(jobs[0].postingDate, '2026-09-11')
})

test('Aarav Solutions validates the verified homepage, careers page shell, shared HubSpot form, and India roles', async () => {
  const aarav = await loadAaravSolutionsModule()

  assert.equal(aarav.SOURCE, 'aaravsolutions')
  assert.equal(aarav.COMPANY, 'Aarav Solutions')
  assert.equal(aarav.VERIFIED_AT, '2026-07-14')
  assert.equal(aarav.HOMEPAGE_URL, 'https://www.aaravsolutions.com/')
  assert.equal(aarav.CAREERS_URL, 'https://www.aaravsolutions.com/careers/')
  assert.equal(aarav.CAREER_FORM_URL, 'https://www.aaravsolutions.com/careers/#career-form')
  assert.equal(aarav.HUBSPOT_PORTAL_ID, '22580721')
  assert.equal(aarav.HUBSPOT_FORM_ID, '5ddff43e-dbd5-41aa-ba85-e1060ab84790')
  assert.equal(aarav.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(aarav.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(aarav.hasVerifiedHubSpotApplyForm(careersHtml), true)
  assert.deepEqual(aarav.extractIndiaRoles(careersHtml), [
    { title: 'Lead BRM Developer', location: 'India' },
    { title: 'Graphic Designer', location: 'India' },
    { title: 'Senior Odoo Developer', location: 'India' },
    { title: 'FrontEnd Developer', location: 'India' },
  ])
})

test('normalizeRole converts Aarav Solutions India cards into the shared job shape', async () => {
  const aarav = await loadAaravSolutionsModule()
  const role = aarav.extractIndiaRoles(careersHtml)[0]

  const normalized = aarav.normalizeRole(role, {
    now: () => '2026-07-14T00:00:00.000Z',
  })

  assert.deepEqual(normalized, {
    jobId: 'lead-brm-developer-india',
    requisitionId: 'lead-brm-developer-india',
    title: 'Lead BRM Developer',
    company: 'Aarav Solutions',
    department: null,
    location: 'India',
    city: null,
    country: 'India',
    link: 'https://www.aaravsolutions.com/careers/#career-form',
    applyUrl: 'https://www.aaravsolutions.com/careers/#career-form',
    sourceUrl: 'https://www.aaravsolutions.com/careers/',
    source: 'aaravsolutions',
    employmentType: null,
    experienceRequired: null,
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    scrapedAt: '2026-07-14T00:00:00.000Z',
  })
})

test('run validates the verified first-party Aarav Solutions surfaces and returns only India roles', async () => {
  const aarav = await loadAaravSolutionsModule()
  const requestedUrls = []
  const scraper = aarav.createAaravSolutionsScraper({
    now: () => '2026-07-14T00:00:00.000Z',
  })

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === aarav.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === aarav.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    aarav.HOMEPAGE_URL,
    aarav.CAREERS_URL,
  ])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].company, 'Aarav Solutions')
  assert.equal(jobs[0].source, 'aaravsolutions')
  assert.equal(jobs[0].link, 'https://www.aaravsolutions.com/careers/#career-form')
  assert.equal(jobs[0].scrapedAt, '2026-07-14T00:00:00.000Z')
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['Lead BRM Developer', 'Graphic Designer', 'Senior Odoo Developer', 'FrontEnd Developer'],
  )
})

test('Aarav Solutions accepts the current first-party careers title and Life at Aarav heading', async () => {
  const aarav = await loadAaravSolutionsModule()

  assert.equal(aarav.hasOfficialCareersSignal(careersHtmlWithCurrentTitleAndHeading), true)

  const jobs = await aarav.createAaravSolutionsScraper({
    now: () => '2026-08-01T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      if (url === aarav.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === aarav.CAREERS_URL) {
        return { status: 200, url, html: careersHtmlWithCurrentTitleAndHeading }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 4)
  assert.ok(jobs.every((job) => job.source === 'aaravsolutions'))
})

test('Aarav Solutions fails closed when the verified homepage, careers shell, HubSpot form, or India cards drift', async () => {
  const aarav = await loadAaravSolutionsModule()

  await assert.rejects(
    aarav.createAaravSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === aarav.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Aarav</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    aarav.createAaravSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === aarav.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aarav.CAREERS_URL) {
          return { status: 200, url, html: '<html><body><h1>Careers</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    aarav.createAaravSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === aarav.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aarav.CAREERS_URL) {
          return { status: 200, url, html: careersHtmlWithoutHubSpot }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /shared first-party hubspot/i,
  )

  await assert.rejects(
    aarav.createAaravSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === aarav.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aarav.CAREERS_URL) {
          return { status: 200, url, html: careersHtmlWithoutIndiaRoles }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /india job cards/i,
  )
})
