import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-14T12:00:00.000Z'

const SEARCH_URL =
  'https://careers.safran-group.com/offre-de-emploi/liste-toutes-offres.aspx?Keywords=Safran%20Engineering%20Services&LCID=1033'

const SEARCH_PAGE_HTML = `
  <html>
    <head>
      <title>Safran - Search results (7 job openings 1) - Keywords : Safran Engineering Services</title>
    </head>
    <body>
      <a
        class="ts-ol-criterias-keep__link ts-ol-criterias-keep__link--rss"
        href="../handlers/offerRss.ashx?lcid=1033&amp;Keywords=Safran%20Engineering%20Services"
      >
        RSS
      </a>

      <li class="ts-offer-list-item offerlist-item ">
        <a
          href="/job/job-sw-architect-techlead-1-position-p1-boostit-indirect_160060.aspx"
          class="ts-offer-list-item__title-link"
        >
          SW Architect / TechLead (1 Position) P1 - BoostIT - Indirect
        </a>
        <ul class="ts-offer-list-item__description ">
          <li>SW Architect / TechLead (1 Position) P1 - BoostIT - Indirect Ref. : 2025-160060</li>
          <li>6/9/2026</li>
          <li>Permanent</li>
          <li>Bangalore</li>
        </ul>
      </li>

      <li class="ts-offer-list-item offerlist-item ">
        <a
          href="/job/job-engine-mechanic-in-fal-airbus-hamburg-m-f-d-_181390.aspx"
          class="ts-offer-list-item__title-link"
        >
          Engine Mechanic in FAL AIRBUS Hamburg (m/f/d)
        </a>
        <ul class="ts-offer-list-item__description ">
          <li>Engine Mechanic in FAL AIRBUS Hamburg (m/f/d) Ref. : 2026-181390</li>
          <li>6/8/2026</li>
          <li>Permanent</li>
          <li>Hamburg</li>
        </ul>
      </li>

      <li class="ts-offer-list-item offerlist-item ">
        <a
          href="/job/job-architect-infrastructure-it-1-position-p1-boostit-indirect_160766.aspx"
          class="ts-offer-list-item__title-link"
        >
          Architect - Infrastructure IT (1 Position) P1 - BoostIT - Indirect
        </a>
        <ul class="ts-offer-list-item__description ">
          <li>Architect - Infrastructure IT (1 Position) P1 - BoostIT - Indirect Ref. : 2025-160766</li>
          <li>12/17/2025</li>
          <li>Permanent</li>
          <li>Bangalore</li>
        </ul>
      </li>
    </body>
  </html>
`

const INDIA_DETAIL_HTML = `
  <html>
    <head>
      <title>Safran - SW Architect / TechLead (1 Position) P1 - BoostIT - Indirect</title>
      <meta
        name="Description"
        content="Offre d&#39;emploi Safran Engineering Services - India de &#39;SW Architect / TechLead (1 Position) P1 - BoostIT - Indirect&#39;. Lieu : Bangalore. Date : 09/06/2026. Ref : 2025-160060."
      >
    </head>
    <body>
      <p id="fldjobdescription_primaryprofile">Software - Software for product information systems</p>
      <p id="fldjobdescription_jobtitle">SW Architect / TechLead (1 Position) P1 - BoostIT - Indirect</p>
      <p id="fldjobdescription_contract">Permanent</p>
      <p id="fldjobdescription_description1">
        Reporting to the IS Automation and Innovation team of Safran Engineering Services, the Software architect's missions are to define application design and solutions.
      </p>
      <p id="fldjobdescription_longtext2">
        Transversal skills • English • design methods and documentation
      </p>
      <p id="fldjobdescription_description2">
        The candidate must demonstrate strong development skills in .NET and good knowledge of AWS architectures and services.
      </p>
      <p id="fldlocation_location_geographicalareacollection">Asia, India</p>
      <p id="fldlocation_joblocation">Bangalore</p>
      <p id="fldapplicantcriteria_educationlevel">Bachelor's Degree</p>
      <p id="fldapplicantcriteria_experiencelevel">More than 8 years</p>
    </body>
  </html>
`

const SECOND_INDIA_DETAIL_HTML = `
  <html>
    <head>
      <title>Safran - Architect - Infrastructure IT (1 Position) P1 - BoostIT - Indirect</title>
      <meta
        name="Description"
        content="Offre d&#39;emploi Safran Engineering Services - India de &#39;Architect - Infrastructure IT (1 Position) P1 - BoostIT - Indirect&#39;. Lieu : Bangalore. Date : 17/12/2025. Ref : 2025-160766."
      >
    </head>
    <body>
      <p id="fldjobdescription_primaryprofile">Software - Software for product information systems</p>
      <p id="fldjobdescription_jobtitle">Architect - Infrastructure IT (1 Position) P1 - BoostIT - Indirect</p>
      <p id="fldjobdescription_contract">Permanent</p>
      <p id="fldjobdescription_description1">
        Reporting to the IS Automation and Innovation team of Safran Engineering Services, the IT architect's missions are to define infrastructure design and solutions.
      </p>
      <p id="fldjobdescription_description2">
        The candidate must demonstrate advanced network and system architecture skills and AWS infrastructure knowledge.
      </p>
      <p id="fldlocation_location_geographicalareacollection">Asia, India</p>
      <p id="fldlocation_joblocation">Bangalore</p>
      <p id="fldapplicantcriteria_educationlevel">Bachelor's Degree</p>
      <p id="fldapplicantcriteria_experiencelevel">More than 8 years</p>
    </body>
  </html>
`

const GERMANY_DETAIL_HTML = `
  <html>
    <head>
      <title>Safran - Engine Mechanic in FAL AIRBUS Hamburg (m/f/d)</title>
      <meta
        name="Description"
        content="Offre d&#39;emploi Safran Engineering Services - Germany de &#39;Engine Mechanic in FAL AIRBUS Hamburg (m/f/d)&#39;. Lieu : Hamburg. Date : 08/06/2026. Ref : 2026-181390."
      >
    </head>
    <body>
      <p id="fldjobdescription_primaryprofile">Mechanics - Mechanical system architecture</p>
      <p id="fldjobdescription_jobtitle">Engine Mechanic in FAL AIRBUS Hamburg (m/f/d)</p>
      <p id="fldjobdescription_contract">Permanent</p>
      <p id="fldjobdescription_description1">
        Safran Engineering Services offers high-technology engineering services in the fields of aerospace, energy and ground transportation.
      </p>
      <p id="fldlocation_location_geographicalareacollection">Europe, Germany</p>
      <p id="fldlocation_joblocation">Hamburg</p>
      <p id="fldapplicantcriteria_educationlevel">Vocational/Trade School</p>
      <p id="fldapplicantcriteria_experiencelevel">More than 3 years</p>
    </body>
  </html>
`

const loadSafranEngineeringServicesIndiaModule = async () => {
  try {
    return await import('../../scraper/safranengineeringservicesindia/script.js')
  } catch {
    assert.fail('Expected Safran Engineering Services India scraper module at ../../scraper/safranengineeringservicesindia/script.js')
  }
}

test('Safran Engineering Services India constants and helpers stay pinned to the accessible first-party careers search surface', async () => {
  const safran = await loadSafranEngineeringServicesIndiaModule()

  assert.equal(safran.SOURCE, 'safranengineeringservicesindia')
  assert.equal(safran.COMPANY, 'Safran Engineering Services India')
  assert.equal(safran.PUBLIC_COMPANY_NAME, 'Safran Engineering Services')
  assert.equal(safran.SEARCH_KEYWORDS, 'Safran Engineering Services')
  assert.equal(safran.SEARCH_URL, SEARCH_URL)
  assert.equal(safran.buildSearchUrl(), SEARCH_URL)
  assert.equal(
    safran.buildSearchUrl(2),
    'https://careers.safran-group.com/offre-de-emploi/liste-toutes-offres.aspx?Keywords=Safran%20Engineering%20Services&LCID=1033&page=2',
  )
  assert.equal(safran.hasVerifiedSearchPageSignal(SEARCH_PAGE_HTML), true)
  assert.equal(safran.hasVerifiedDetailSignal(INDIA_DETAIL_HTML), true)
  assert.equal(safran.extractTotalPages(SEARCH_PAGE_HTML), 1)
  assert.deepEqual(safran.extractSearchResults(SEARCH_PAGE_HTML), [
    {
      title: 'SW Architect / TechLead (1 Position) P1 - BoostIT - Indirect',
      company: 'Safran Engineering Services India',
      department: null,
      location: 'Bangalore',
      city: 'Bangalore',
      country: null,
      jobId: '160060',
      requisitionId: '2025-160060',
      sourceUrl: 'https://careers.safran-group.com/job/job-sw-architect-techlead-1-position-p1-boostit-indirect_160060.aspx',
      applyUrl: 'https://careers.safran-group.com/job/job-sw-architect-techlead-1-position-p1-boostit-indirect_160060.aspx',
      employmentType: 'Permanent',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-09',
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Engine Mechanic in FAL AIRBUS Hamburg (m/f/d)',
      company: 'Safran Engineering Services India',
      department: null,
      location: 'Hamburg',
      city: 'Hamburg',
      country: null,
      jobId: '181390',
      requisitionId: '2026-181390',
      sourceUrl: 'https://careers.safran-group.com/job/job-engine-mechanic-in-fal-airbus-hamburg-m-f-d-_181390.aspx',
      applyUrl: 'https://careers.safran-group.com/job/job-engine-mechanic-in-fal-airbus-hamburg-m-f-d-_181390.aspx',
      employmentType: 'Permanent',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-08',
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Architect - Infrastructure IT (1 Position) P1 - BoostIT - Indirect',
      company: 'Safran Engineering Services India',
      department: null,
      location: 'Bangalore',
      city: 'Bangalore',
      country: null,
      jobId: '160766',
      requisitionId: '2025-160766',
      sourceUrl: 'https://careers.safran-group.com/job/job-architect-infrastructure-it-1-position-p1-boostit-indirect_160766.aspx',
      applyUrl: 'https://careers.safran-group.com/job/job-architect-infrastructure-it-1-position-p1-boostit-indirect_160766.aspx',
      employmentType: 'Permanent',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-12-17',
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('Safran Engineering Services India default fetch keeps direct responses and never shells out to curl', async () => {
  const safran = await loadSafranEngineeringServicesIndiaModule()
  const calls = []
  const fetchText = safran.createDefaultFetchText({
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return {
        ok: true,
        text: async () => SEARCH_PAGE_HTML,
      }
    },
  })

  const html = await fetchText(safran.SEARCH_URL)

  assert.equal(html, SEARCH_PAGE_HTML)
  assert.equal(calls.length, 1)
  await assert.rejects(
    safran.createDefaultFetchText({
      fetchImpl: async () => ({
        ok: false,
        status: 403,
      }),
    })(safran.SEARCH_URL),
    /HTTP 403/i,
  )
})

test('extractJobDetail prefers the accessible first-party Safran careers detail fields', async () => {
  const safran = await loadSafranEngineeringServicesIndiaModule()
  const [listing] = safran.extractSearchResults(SEARCH_PAGE_HTML)

  assert.deepEqual(safran.extractJobDetail(INDIA_DETAIL_HTML, listing), {
    title: 'SW Architect / TechLead (1 Position) P1 - BoostIT - Indirect',
    company: 'Safran Engineering Services India',
    department: 'Software - Software for product information systems',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '160060',
    requisitionId: '2025-160060',
    sourceUrl: 'https://careers.safran-group.com/job/job-sw-architect-techlead-1-position-p1-boostit-indirect_160060.aspx',
    applyUrl: 'https://careers.safran-group.com/job/job-sw-architect-techlead-1-position-p1-boostit-indirect_160060.aspx',
    employmentType: 'Permanent',
    experienceRequired: 'More than 8 years',
    minimumQualification: "Bachelor's Degree",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-09',
    closingDate: null,
    jobDescription:
      "Reporting to the IS Automation and Innovation team of Safran Engineering Services, the Software architect's missions are to define application design and solutions. Transversal skills • English • design methods and documentation The candidate must demonstrate strong development skills in .NET and good knowledge of AWS architectures and services.",
  })
})

test('run walks the accessible first-party search results, verifies detail pages, and keeps only India jobs', async () => {
  const safran = await loadSafranEngineeringServicesIndiaModule()
  const requestedUrls = []

  const jobs = await safran.createSafranEngineeringServicesIndiaScraper({
    maxPages: 1,
    maxJobs: 2,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === safran.SEARCH_URL) return SEARCH_PAGE_HTML
      if (url === 'https://careers.safran-group.com/job/job-sw-architect-techlead-1-position-p1-boostit-indirect_160060.aspx') {
        return INDIA_DETAIL_HTML
      }
      if (url === 'https://careers.safran-group.com/job/job-engine-mechanic-in-fal-airbus-hamburg-m-f-d-_181390.aspx') {
        return GERMANY_DETAIL_HTML
      }
      if (url === 'https://careers.safran-group.com/job/job-architect-infrastructure-it-1-position-p1-boostit-indirect_160766.aspx') {
        return SECOND_INDIA_DETAIL_HTML
      }

      throw new Error(`Unexpected Safran fixture URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    safran.SEARCH_URL,
    'https://careers.safran-group.com/job/job-sw-architect-techlead-1-position-p1-boostit-indirect_160060.aspx',
    'https://careers.safran-group.com/job/job-engine-mechanic-in-fal-airbus-hamburg-m-f-d-_181390.aspx',
    'https://careers.safran-group.com/job/job-architect-infrastructure-it-1-position-p1-boostit-indirect_160766.aspx',
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      country: job.country,
      city: job.city,
      jobId: job.jobId,
      source: job.source,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'SW Architect / TechLead (1 Position) P1 - BoostIT - Indirect',
        country: 'India',
        city: 'Bangalore',
        jobId: '160060',
        source: 'safranengineeringservicesindia',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Architect - Infrastructure IT (1 Position) P1 - BoostIT - Indirect',
        country: 'India',
        city: 'Bangalore',
        jobId: '160766',
        source: 'safranengineeringservicesindia',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
  assert.equal(
    jobs[0].link,
    'https://careers.safran-group.com/job/job-sw-architect-techlead-1-position-p1-boostit-indirect_160060.aspx',
  )
  assert.equal(
    jobs[1].link,
    'https://careers.safran-group.com/job/job-architect-infrastructure-it-1-position-p1-boostit-indirect_160766.aspx',
  )
})

test('Safran Engineering Services India fails closed when the accessible search or detail pages drift', async () => {
  const safran = await loadSafranEngineeringServicesIndiaModule()

  await assert.rejects(
    safran.createSafranEngineeringServicesIndiaScraper().run({
      fetchText: async (url) => {
        if (url === safran.SEARCH_URL) {
          return '<html><body><h1>Unexpected</h1></body></html>'
        }

        throw new Error(`Unexpected Safran fixture URL: ${url}`)
      },
    }),
    /verified accessible Safran Engineering Services search page/i,
  )

  await assert.rejects(
    safran.createSafranEngineeringServicesIndiaScraper().run({
      fetchText: async (url) => {
        if (url === safran.SEARCH_URL) return SEARCH_PAGE_HTML
        if (url === 'https://careers.safran-group.com/job/job-sw-architect-techlead-1-position-p1-boostit-indirect_160060.aspx') {
          return '<html><body><h1>Unexpected</h1></body></html>'
        }
        if (url === 'https://careers.safran-group.com/job/job-engine-mechanic-in-fal-airbus-hamburg-m-f-d-_181390.aspx') {
          return GERMANY_DETAIL_HTML
        }
        if (url === 'https://careers.safran-group.com/job/job-architect-infrastructure-it-1-position-p1-boostit-indirect_160766.aspx') {
          return SECOND_INDIA_DETAIL_HTML
        }

        throw new Error(`Unexpected Safran fixture URL: ${url}`)
      },
    }),
    /verified Safran Engineering Services detail page/i,
  )
})
