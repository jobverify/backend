import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const VERIFIED_ROLE_TITLES = [
  'Embedded Senior Engineer',
  'Design Engineer - Parabolic & Earth Station Antennas',
  'PCB Designer Engineer',
  'Quality Management System',
  'RF Manager / Senior Manager',
  'Project Manager',
  'Senior Manager / DGM - Quality',
]

const VERIFIED_JOB_LISTINGS = [
  {
    id: 1,
    role: 'Embedded Senior Engineer',
    type: 'Full Time',
    location: 'Vishakhapatnam / Hyderabad',
    city: 'Hyderabad/Vishakhapatnam',
    industry: 'Electronics Design / R & D',
    companyprofile: 'Avantel develops indigenous aerospace and defence electronics solutions.',
    qualification: 'BE/B.Tech (ECE), M.Sc. (Electronics)',
    skills: [
      'Strong embedded C and RTOS experience.',
      'Experience in ARM or DSP based product development.',
    ],
    responsibilities: [
      'Design and develop embedded products for aerospace and defence applications.',
      'Collaborate with hardware and system teams on integration and validation.',
    ],
    preferable: ['Exposure to SATCOM or defence electronics programs.'],
    relevantindustry: 'Only Defense and Aerospace, Electronics, Semi-Conductors, (No Automative industry)',
    experience: '5 to 10 years',
    compensation: '6 to 12 LPA',
    joining: 'Immediate',
    interviewprocess: 'Virtual',
    contact: 'D. Gopal (Senior Manager-HR), (O)040-66305000, (M) 9177996628, hr@avantel.in',
  },
  {
    id: 2,
    role: 'Design Engineer - Parabolic & Earth Station Antennas',
    type: 'Full Time',
    location: 'Vishakhapatnam / Hyderabad',
    city: 'Hyderabad/Vishakhapatnam',
    industry: 'Electronics Design / R & D',
    jobdesc: 'Design, simulate, and validate parabolic and earth station antenna subsystems for satellite communication.',
    qualification: '',
    skills: [
      'Experience in large antenna system design.',
      'Strong RF simulation background.',
      'Exposure to SATCOM antenna validation.',
    ],
    responsibilities: [
      'Own subsystem design for earth station antenna programs.',
      'Coordinate simulation and validation activities.',
    ],
    preferable: [
      'Experience with antenna test range activities.',
      'Hands-on work with large SATCOM apertures.',
      'Cross-functional aerospace or defence collaboration experience.',
    ],
    experience: '5 - 10 Years',
  },
  {
    id: 3,
    role: 'PCB Designer Engineer',
    type: 'Full Time',
    location: 'Hyderabad',
    city: 'Hyderabad',
    companyprofile: 'Avantel develops indigenous aerospace and defence electronics solutions.',
    qualification: 'B.Tech / Diploma (ECE / EIE / EEE)',
    skills: [
      'Multilayer PCB layout experience.',
      'High-speed digital design awareness.',
      'Manufacturing release documentation experience.',
    ],
    experience: '2 to 4 years',
    contact: 'D. Gopal (Senior Manager-HR), (O)040-66305000, (M) 9177996628, hr@avantel.in',
  },
  {
    id: 4,
    role: 'Quality Management System',
    type: 'Full Time',
    location: 'E-City, Tukkuguda, Hyderabad',
    city: 'Hyderabad',
    industry: 'Defence, Electronics Manufacturing and Satellite communication',
    companyprofile: 'Avantel develops indigenous aerospace and defence electronics solutions.',
    qualification: 'B.Tech (ECE) / M.Sc (Electronics)',
    skills: [
      'QMS implementation',
      'Internal audits',
      'Corrective action tracking',
    ],
    relevantindustry: 'Defence, Electronics Manufacturing and Satellite communication',
    experience: 'Min 5 years',
    compensation: 'As per industry standards',
    contact: 'D. Gopal (Senior Manager-HR), (O)040-66305000, (M) 9177996628, gopal@avantel.in',
  },
  {
    id: 5,
    role: 'RF Manager / Senior Manager',
    type: 'Full Time',
    location: 'Vishakhapatnam',
    city: 'Vishakhapatnam',
    industry: 'Electronics /Telecommunications',
    companyprofile: 'Avantel develops indigenous aerospace and defence electronics solutions.',
    qualification: 'B.Tech / M.Tech (Electronics)',
    skills: [
      'RF subsystem design leadership.',
      'SATCOM payload integration.',
      'Lab validation and production support.',
    ],
    relevantindustry: 'Electronics /Telecommunications',
    experience: '8 to 12 years',
    compensation: '12 to 18 LPA',
    contact: 'D. Gopal (Senior Manager-HR), (O)040-66305000, (M) 9177996628, gopal@avantel.in',
  },
  {
    id: 6,
    role: 'Project Manager',
    type: 'Full Time',
    location: 'Hyderabad (Tukkuguda) - Near E-City (FAB CITY)',
    city: 'Hyderabad',
    industry: 'Telecom / SATCOM',
    companyprofile: 'Avantel develops indigenous aerospace and defence electronics solutions.',
    qualification: 'MSC/MCA/BTech/MTech',
    skills: [
      'Program planning',
      'Customer communication',
      'Delivery governance',
    ],
    responsibilities: [
      'Own program schedules and milestone reviews.',
      'Drive delivery coordination across engineering teams.',
    ],
    experience: '10 to 20 years',
    contact: 'D. Gopal (Senior Manager-HR), (O)040-66305000, (M) 9177996628, gopal@avantel.in',
  },
  null,
  {
    id: 7,
    role: 'Senior Manager / DGM - Quality',
    type: 'Full Time',
    location: 'Hyderabad (Tukkuguda) - Near E-City (FAB CITY)',
    city: 'Hyderabad',
    industry: 'Aerospace, Defense, Electronics Manufacturing and Satellite Communications',
    companyprofile: 'Avantel develops indigenous aerospace and defence electronics solutions.',
    qualification: 'B.Tech in Electronics & Communication Engineering (ECE) or M.Sc in Electronics is mandatory.',
    skills: [
      'ASQ-aligned quality leadership.',
      'Supplier quality management.',
      'Production quality governance.',
    ],
    responsibilities: [
      'Lead organization-wide quality systems.',
      'Drive customer and regulatory quality compliance.',
    ],
    experience: '15+ years',
    contact: 'D. Gopal (Senior Manager-HR), (O)040-66305000, (M) 9177996628, gopal@avantel.in',
  },
]

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Avantel</title>
    <script defer src="/static/js/main.bc2d10f8.js"></script>
    <script src="js/script.js"></script>
    <script src="js/bootstrap.bundle.min.js"></script>
    <script src="js/jquery.min.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <meta
      name="description"
      content="Avantel offers innovative, customized network centric solutions in the Aerospace and Defence Electronics domain."
    />
  </body>
</html>
`

const careersHtml = homepageHtml

const bundleJs = `
href:"careers",children:"Careers";
"We're hiring";
"Open Positions";
"Search by job role";
"Select Department";
"City, State, or country/region";
"Software";
"R & D";
filteredJobListing.map((job)=>job);
to:{pathname:"/jobdescription",state:e},className:"applyNow",children:"Apply Now →";
fetch("/resume");
const careersState={jobListings:${JSON.stringify(VERIFIED_JOB_LISTINGS)}};
`

const currentBundleJs = `
href:"careers",children:"Careers";
"We're hiring";
"Open Positions";
"Search by job role";
"Select Department";
"City, State, or country/region";
filteredJobListing.map((job)=>job);
to:{pathname:"/jobdescription",state:e},className:"applyNow",children:"Apply Now →";
fetch("/resume");
const careersState={jobListings:${JSON.stringify([
  {
    id: 1,
    role: 'Project Manager – Communications & Defense Systems',
    type: 'Full Time',
    location: 'Hyderabad',
    city: 'Hyderabad',
    qualification: 'B.Tech / M.Tech in Electronics & Communication Engineering (ECE)',
    experience: '8 to 15 years',
    companyprofile: 'AVANTEL LIMITED is a technology-driven public limited company focused on defense electronics.',
    skills: [
      { key: 1, point: 'Strong knowledge in Java – primary development language for project deliverables' },
      { key: 2, point: 'Very good knowledge of Spring Boot Framework and front-end technologies' },
    ],
    responsibilities: [
      { key: 1, point: 'Lead end-to-end software project delivery for communications and Defense electronics systems.' },
    ],
    preferable: [
      { key: 1, point: 'Familiarity in IEEE 12207, DO 178 and DO 254 is a plus' },
    ],
  },
  {
    id: 2,
    role: 'Embedded Project Manager (Xilinx FPGA is mandatory)',
    type: 'Full Time',
    location: 'Vishakhapatnam / Hyderabad',
    city: 'Hyderabad/Vishakhapatnam',
    qualification: 'B.Tech / M.Tech',
    experience: '10 to 18 years',
    skills: [
      { key: 1, point: 'Mandatory experience with Xilinx FPGA programs' },
    ],
    responsibilities: [],
    preferable: [],
  },
  {
    id: 3,
    role: 'ITI Technicians – Mechanical Trades (05 Positions)',
    type: 'Full Time',
    location: 'E-City, Tukkuguda, Hyderabad',
    city: 'Hyderabad',
    qualification: 'ITI Mechanical',
    experience: '2 to 5 years',
    skills: [
      { key: 1, point: 'Assembly and mechanical fitment support' },
    ],
    responsibilities: [],
    preferable: [],
  },
  {
    id: 3,
    role: 'ITI Technicians – Electronics Trades (10 Positions)',
    type: 'Full Time',
    location: 'E-City, Tukkuguda, Hyderabad',
    city: 'Hyderabad',
    qualification: 'ITI Electronics',
    experience: '2 to 5 years',
    skills: [
      { key: 1, point: 'Soldering and electronics manufacturing support' },
    ],
    responsibilities: [],
    preferable: [],
  },
  {
    id: 5,
    role: 'RF Manager / Senior Manager',
    type: 'Full Time',
    location: 'Vishakhapatnam',
    city: 'Vishakhapatnam',
    qualification: 'B.Tech / M.Tech (Electronics)',
    experience: '8 to 12 years',
    skills: [],
    responsibilities: [],
    preferable: [],
  },
  {
    id: 6,
    role: 'Project Manager',
    type: 'Full Time',
    location: 'Hyderabad (Tukkuguda) - Near E-City (FAB CITY)',
    city: 'Hyderabad',
    qualification: 'MSC/MCA/BTech/MTech',
    experience: '10 to 20 years',
    skills: [],
    responsibilities: [],
    preferable: [],
  },
  {
    id: 7,
    role: 'Senior Manager / DGM - Quality',
    type: 'Full Time',
    location: 'Hyderabad (Tukkuguda) - Near E-City (FAB CITY)',
    city: 'Hyderabad',
    qualification: 'B.Tech in Electronics & Communication Engineering (ECE) or M.Sc in Electronics is mandatory.',
    experience: '15+ years',
    skills: [],
    responsibilities: [],
    preferable: [],
  },
] )};
`

const loadAvantelModule = async () => {
  try {
    return await import('../../scraper/avantel/script.js')
  } catch {
    assert.fail('Expected Avantel scraper module at ../../scraper/avantel/script.js')
  }
}

test('Avantel helpers stay pinned to the verified first-party shell, exact bundle URL, and embedded job array topology', async () => {
  const avantel = await loadAvantelModule()

  assert.equal(avantel.SOURCE, 'avantel')
  assert.equal(avantel.COMPANY, 'Avantel')
  assert.equal(avantel.OFFICIAL_BRAND_NAME, 'Avantel Limited')
  assert.equal(avantel.VERIFIED_ON, '2026-07-15')
  assert.equal(avantel.HOMEPAGE_URL, 'https://www.avantel.in/')
  assert.equal(avantel.CAREERS_URL, 'https://www.avantel.in/careers')
  assert.equal(avantel.JOB_DESCRIPTION_ROUTE_URL, 'https://www.avantel.in/jobdescription')
  assert.equal(avantel.BUNDLE_URL, 'https://www.avantel.in/static/js/main.bc2d10f8.js')
  assert.deepEqual(avantel.VERIFIED_ROLE_TITLES, VERIFIED_ROLE_TITLES)
  assert.equal(avantel.hasOfficialShellSignal(homepageHtml), true)
  assert.equal(
    avantel.extractMainBundleUrl(homepageHtml, avantel.HOMEPAGE_URL),
    avantel.BUNDLE_URL,
  )
  assert.equal(avantel.hasCareersBundleSignal(bundleJs), true)
  assert.deepEqual(
    avantel.extractEmbeddedJobListings(bundleJs).map((job) => ({
      id: job.id,
      role: job.role,
      location: job.location,
      city: job.city,
    })),
    [
      { id: 1, role: 'Embedded Senior Engineer', location: 'Vishakhapatnam / Hyderabad', city: 'Hyderabad/Vishakhapatnam' },
      { id: 2, role: 'Design Engineer - Parabolic & Earth Station Antennas', location: 'Vishakhapatnam / Hyderabad', city: 'Hyderabad/Vishakhapatnam' },
      { id: 3, role: 'PCB Designer Engineer', location: 'Hyderabad', city: 'Hyderabad' },
      { id: 4, role: 'Quality Management System', location: 'E-City, Tukkuguda, Hyderabad', city: 'Hyderabad' },
      { id: 5, role: 'RF Manager / Senior Manager', location: 'Vishakhapatnam', city: 'Vishakhapatnam' },
      { id: 6, role: 'Project Manager', location: 'Hyderabad (Tukkuguda) - Near E-City (FAB CITY)', city: 'Hyderabad' },
      { id: 7, role: 'Senior Manager / DGM - Quality', location: 'Hyderabad (Tukkuguda) - Near E-City (FAB CITY)', city: 'Hyderabad' },
    ],
  )
})

test('Avantel run returns the seven verified first-party jobs from the embedded careers bundle', async () => {
  const avantel = await loadAvantelModule()
  const requestedUrls = []
  const rotatedBundleUrl = 'https://www.avantel.in/static/js/main.39fa96ce.js'
  const rotatedHomepageHtml = homepageHtml.replace('main.bc2d10f8.js', 'main.39fa96ce.js')
  const rotatedCareersHtml = careersHtml.replace('main.bc2d10f8.js', 'main.39fa96ce.js')

  const jobs = await avantel.createAvantelScraper({
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === avantel.HOMEPAGE_URL) {
        return { status: 200, url, html: rotatedHomepageHtml }
      }

      if (url === avantel.CAREERS_URL) {
        return { status: 200, url, html: rotatedCareersHtml }
      }

      if (url === rotatedBundleUrl) {
        return { status: 200, url, html: bundleJs }
      }

      throw new Error(`Unexpected Avantel URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    avantel.HOMEPAGE_URL,
    avantel.CAREERS_URL,
    rotatedBundleUrl,
  ])

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      employmentType: job.employmentType,
      experienceRequired: job.experienceRequired,
      minimumQualification: job.minimumQualification,
      preferredQualification: job.preferredQualification,
      requiredSkills: job.requiredSkills,
      source: job.source,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Embedded Senior Engineer',
        location: 'Vishakhapatnam / Hyderabad, India',
        city: 'Hyderabad',
        jobId: '1',
        requisitionId: '1',
        sourceUrl: 'https://www.avantel.in/careers',
        applyUrl: 'https://www.avantel.in/careers',
        employmentType: 'Full Time',
        experienceRequired: '5 to 10 years',
        minimumQualification: 'BE/B.Tech (ECE), M.Sc. (Electronics)',
        preferredQualification: 'Exposure to SATCOM or defence electronics programs.',
        requiredSkills: [
          'Strong embedded C and RTOS experience.',
          'Experience in ARM or DSP based product development.',
        ],
        source: 'avantel',
        link: 'https://www.avantel.in/careers',
        scrapedAt: '2026-07-15T00:00:00.000Z',
      },
      {
        title: 'Design Engineer - Parabolic & Earth Station Antennas',
        location: 'Vishakhapatnam / Hyderabad, India',
        city: 'Hyderabad',
        jobId: '2',
        requisitionId: '2',
        sourceUrl: 'https://www.avantel.in/careers',
        applyUrl: 'https://www.avantel.in/careers',
        employmentType: 'Full Time',
        experienceRequired: '5 - 10 Years',
        minimumQualification: null,
        preferredQualification: 'Experience with antenna test range activities. Hands-on work with large SATCOM apertures. Cross-functional aerospace or defence collaboration experience.',
        requiredSkills: [
          'Experience in large antenna system design.',
          'Strong RF simulation background.',
          'Exposure to SATCOM antenna validation.',
        ],
        source: 'avantel',
        link: 'https://www.avantel.in/careers',
        scrapedAt: '2026-07-15T00:00:00.000Z',
      },
      {
        title: 'PCB Designer Engineer',
        location: 'Hyderabad, India',
        city: 'Hyderabad',
        jobId: '3',
        requisitionId: '3',
        sourceUrl: 'https://www.avantel.in/careers',
        applyUrl: 'https://www.avantel.in/careers',
        employmentType: 'Full Time',
        experienceRequired: '2 to 4 years',
        minimumQualification: 'B.Tech / Diploma (ECE / EIE / EEE)',
        preferredQualification: null,
        requiredSkills: [
          'Multilayer PCB layout experience.',
          'High-speed digital design awareness.',
          'Manufacturing release documentation experience.',
        ],
        source: 'avantel',
        link: 'https://www.avantel.in/careers',
        scrapedAt: '2026-07-15T00:00:00.000Z',
      },
      {
        title: 'Quality Management System',
        location: 'E-City, Tukkuguda, Hyderabad, India',
        city: 'Hyderabad',
        jobId: '4',
        requisitionId: '4',
        sourceUrl: 'https://www.avantel.in/careers',
        applyUrl: 'https://www.avantel.in/careers',
        employmentType: 'Full Time',
        experienceRequired: 'Min 5 years',
        minimumQualification: 'B.Tech (ECE) / M.Sc (Electronics)',
        preferredQualification: null,
        requiredSkills: [
          'QMS implementation',
          'Internal audits',
          'Corrective action tracking',
        ],
        source: 'avantel',
        link: 'https://www.avantel.in/careers',
        scrapedAt: '2026-07-15T00:00:00.000Z',
      },
      {
        title: 'RF Manager / Senior Manager',
        location: 'Vishakhapatnam, India',
        city: 'Vishakhapatnam',
        jobId: '5',
        requisitionId: '5',
        sourceUrl: 'https://www.avantel.in/careers',
        applyUrl: 'https://www.avantel.in/careers',
        employmentType: 'Full Time',
        experienceRequired: '8 to 12 years',
        minimumQualification: 'B.Tech / M.Tech (Electronics)',
        preferredQualification: null,
        requiredSkills: [
          'RF subsystem design leadership.',
          'SATCOM payload integration.',
          'Lab validation and production support.',
        ],
        source: 'avantel',
        link: 'https://www.avantel.in/careers',
        scrapedAt: '2026-07-15T00:00:00.000Z',
      },
      {
        title: 'Project Manager',
        location: 'Hyderabad (Tukkuguda) - Near E-City (FAB CITY), India',
        city: 'Hyderabad',
        jobId: '6',
        requisitionId: '6',
        sourceUrl: 'https://www.avantel.in/careers',
        applyUrl: 'https://www.avantel.in/careers',
        employmentType: 'Full Time',
        experienceRequired: '10 to 20 years',
        minimumQualification: 'MSC/MCA/BTech/MTech',
        preferredQualification: null,
        requiredSkills: [
          'Program planning',
          'Customer communication',
          'Delivery governance',
        ],
        source: 'avantel',
        link: 'https://www.avantel.in/careers',
        scrapedAt: '2026-07-15T00:00:00.000Z',
      },
      {
        title: 'Senior Manager / DGM - Quality',
        location: 'Hyderabad (Tukkuguda) - Near E-City (FAB CITY), India',
        city: 'Hyderabad',
        jobId: '7',
        requisitionId: '7',
        sourceUrl: 'https://www.avantel.in/careers',
        applyUrl: 'https://www.avantel.in/careers',
        employmentType: 'Full Time',
        experienceRequired: '15+ years',
        minimumQualification: 'B.Tech in Electronics & Communication Engineering (ECE) or M.Sc in Electronics is mandatory.',
        preferredQualification: null,
        requiredSkills: [
          'ASQ-aligned quality leadership.',
          'Supplier quality management.',
          'Production quality governance.',
        ],
        source: 'avantel',
        link: 'https://www.avantel.in/careers',
        scrapedAt: '2026-07-15T00:00:00.000Z',
      },
    ],
  )

  assert.match(jobs[0].jobDescription, /Company Profile: Avantel develops indigenous aerospace and defence electronics solutions\./i)
  assert.match(jobs[0].jobDescription, /Contact: D\. Gopal/i)
  assert.match(jobs[1].jobDescription, /Design, simulate, and validate parabolic and earth station antenna subsystems/i)
  assert.match(jobs[3].jobDescription, /Relevant Industry: Defence, Electronics Manufacturing and Satellite communication/i)
})

test('Avantel accepts the current live-style bundle with object skill points and duplicate numeric ids', async () => {
  const avantel = await loadAvantelModule()

  const extracted = avantel.extractEmbeddedJobListings(currentBundleJs)
  assert.equal(extracted.length, 7)
  assert.deepEqual(Array.from(extracted[0].skills), [
    'Strong knowledge in Java – primary development language for project deliverables',
    'Very good knowledge of Spring Boot Framework and front-end technologies',
  ])
  assert.deepEqual(Array.from(extracted[0].responsibilities), [
    'Lead end-to-end software project delivery for communications and Defense electronics systems.',
  ])
  assert.deepEqual(Array.from(extracted[0].preferable), [
    'Familiarity in IEEE 12207, DO 178 and DO 254 is a plus',
  ])

  const jobs = await avantel.createAvantelScraper({
    now: () => '2026-07-25T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      if (url === avantel.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml.replace('main.bc2d10f8.js', 'main.41673755.js') }
      }

      if (url === avantel.CAREERS_URL) {
        return { status: 200, url, html: careersHtml.replace('main.bc2d10f8.js', 'main.41673755.js') }
      }

      if (url === 'https://www.avantel.in/static/js/main.41673755.js') {
        return { status: 200, url, html: currentBundleJs }
      }

      throw new Error(`Unexpected Avantel URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 7)
  assert.deepEqual(
    jobs.map((job) => job.jobId),
    [
      '1',
      '2',
      '3-iti-technicians-mechanical-trades-05-positions',
      '3-iti-technicians-electronics-trades-10-positions',
      '5',
      '6',
      '7',
    ],
  )
  assert.equal(jobs[0].title, 'Project Manager – Communications & Defense Systems')
  assert.deepEqual(jobs[0].requiredSkills, [
    'Strong knowledge in Java – primary development language for project deliverables',
    'Very good knowledge of Spring Boot Framework and front-end technologies',
  ])
  assert.equal(
    jobs[2].minimumQualification,
    'ITI Mechanical',
  )
})

test('Avantel returns discovery-only evidence when the official hostname cannot be resolved', async () => {
  const avantel = await loadAvantelModule()
  const dnsError = Object.assign(new Error('fetch failed'), {
    cause: { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND www.avantel.in' },
  })

  const jobs = await avantel.createAvantelScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
    fetchPage: async () => { throw dnsError },
  })

  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.surface, avantel.HOMEPAGE_URL)
  assert.equal(evidence?.listingComplete, false)
})

test('Avantel fails closed when the shell, exact bundle URL, bundle signals, or embedded job topology drifts', async () => {
  const avantel = await loadAvantelModule()

  await assert.rejects(
    avantel.createAvantelScraper().run({
      fetchPage: async (url) => {
        if (url === avantel.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Avantel URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    avantel.createAvantelScraper().run({
      fetchPage: async (url) => {
        if (url === avantel.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === avantel.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace('/static/js/main.bc2d10f8.js', '/static/js/main.changed.js'),
          }
        }

        throw new Error(`Unexpected Avantel URL: ${url}`)
      },
    }),
    /bundle url/i,
  )

  await assert.rejects(
    avantel.createAvantelScraper().run({
      fetchPage: async (url) => {
        if (url === avantel.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === avantel.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === avantel.BUNDLE_URL) {
          return { status: 200, url, html: 'const careersState={jobListings:[]};' }
        }

        throw new Error(`Unexpected Avantel URL: ${url}`)
      },
    }),
    /careers bundle/i,
  )

  await assert.rejects(
    avantel.createAvantelScraper().run({
      fetchPage: async (url) => {
        if (url === avantel.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === avantel.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === avantel.BUNDLE_URL) {
          return {
            status: 200,
            url,
            html: bundleJs.replace('Senior Manager / DGM - Quality', ''),
          }
        }

        throw new Error(`Unexpected Avantel URL: ${url}`)
      },
    }),
    /jobListings array changed materially/i,
  )
})
