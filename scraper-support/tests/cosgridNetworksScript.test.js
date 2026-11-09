import assert from 'node:assert/strict'
import test from 'node:test'

const loadCosgridNetworksModule = async () => import('../../scraper/cosgridnetworks/script.js')

test('COSGrid careers landing accepts live h1 markup with attributes', async () => {
  const cosgrid = await loadCosgridNetworksModule()

  const careersHtml = `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Join the COSGrid Team: Build a Brighter Digital Future</title>
      </head>
      <body>
        <main>
          <h1 class="hero-title" data-aos="fade-up">Join Our Team</h1>
          <p>Take a look at our latest job opportunities</p>
          <a ng-reflect-router-link="openings" href="/company/careers/openings">View openings</a>
          <a href="mailto:careers@cosgrid.com">careers@cosgrid.com</a>
        </main>
      </body>
    </html>
  `

  assert.equal(cosgrid.hasOfficialCareersLandingSignal(careersHtml), true)
})

test('COSGrid careers landing accepts the current rendered openings link', async () => {
  const cosgrid = await loadCosgridNetworksModule()

  const careersHtml = `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Join the COSGrid Team: Build a Brighter Digital Future</title>
      </head>
      <body>
        <main>
          <h1 class="hero-title">Join Our Team</h1>
          <p>Take a look at our latest job opportunities</p>
          <a href="/company/careers/openings">View openings</a>
        </main>
      </body>
    </html>
  `

  assert.equal(cosgrid.hasOfficialCareersLandingSignal(careersHtml), true)
})

test('COSGrid openings parser accepts live attribute-heavy card markup', async () => {
  const cosgrid = await loadCosgridNetworksModule()

  const openingsHtml = `
    <!doctype html>
    <html lang="en">
      <head>
        <title>COSGrid Networks | Current Job Openings | Join Our Team</title>
      </head>
      <body>
        <div class="row d-flex justify-content-center ng-star-inserted">
          <div class="col-12 p-4 single-career-container my-2">
            <div class="row">
              <div class="col-8 col-sm-5 py-1">
                <p class="fw-bold fs-6">Backend Developer</p>
              </div>
              <div class="col-4 col-sm-3 py-1">
                <p class="fs-6">Engineering</p>
              </div>
              <div class="col-8 col-sm-3 py-1">
                <p class="fs-6">Full-Time</p>
              </div>
              <div class="col-4 py-1 col-sm-1">
                <button class="btn-primary btn fs-6" ng-reflect-router-link="backend-developer">Apply</button>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `

  assert.deepEqual(cosgrid.extractSearchResults(openingsHtml), [
    {
      title: 'Backend Developer',
      department: 'Engineering',
      employmentType: 'Full-time',
      slug: 'backend-developer',
      sourceUrl: 'https://www.cosgrid.com/company/careers/openings/backend-developer',
    },
  ])
})

test('COSGrid detail parser accepts live plain-text headings with fallback department', async () => {
  const cosgrid = await loadCosgridNetworksModule()

  const detailHtml = `
    <!doctype html>
    <html lang="en">
      <body>
        <h1>Backend Developer | Engineering</h1>
        <p>About the company COSGrid Networks is a leading networking and cybersecurity products company that delivers secure access.</p>
        <p class="fs-6 mt-3">Chennai Full-Time</p>
        <p>Required Skills</p>
        <p>Python</p>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Backend Developer",
            "employmentType": "FULL_TIME",
            "datePosted": "2026-07-01",
            "validThrough": "2026-08-31",
            "jobLocation": {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Chennai",
                "addressCountry": "IN"
              }
            },
            "description": "Backend developer role"
          }
        </script>
      </body>
    </html>
  `

  assert.deepEqual(
    cosgrid.extractJobDetail(detailHtml, {
      sourceUrl: 'https://www.cosgrid.com/company/careers/openings/backend-developer',
      fallbackListing: {
        title: 'Backend Developer',
        department: 'Engineering',
        employmentType: 'Full-time',
      },
    }),
    {
      title: 'Backend Developer',
      department: 'Engineering',
      employmentType: 'Full-time',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      postingDate: '2026-07-01',
      closingDate: '2026-08-31',
      jobDescription: 'Backend developer role',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      remoteStatus: null,
    },
  )
})
