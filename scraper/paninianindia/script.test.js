import assert from 'node:assert/strict'
import test from 'node:test'

const loadPaninianModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Paninian India scraper module at ./script.js')
  }
}

const richText = (value, headingLevel = 'h1') => `
  <div data-testid="richTextElement">
    <${headingLevel} class="font_0 wixui-rich-text__text">${String(value)
      .replaceAll('&', '&amp;')
      .replaceAll("'", '&#39;')
      .replaceAll('\n', '<br class="wixui-rich-text__text">')}</${headingLevel}>
  </div>
`

const roleDefinitions = [
  {
    title: 'CAD Engineer',
    locationLabel: 'Hyderabad',
    qualification: 'B.Tech. in Relevant Field',
    skills: [
      '3D CAD Modeling [Autodesk Inventor/Fusion 360]',
      'Electromechanical Assembly',
      'Composite Part Design',
      'Mechanical Drafting',
      'GD&T',
      'BOM Creation',
      'Manufacturing Drawings',
      'Design for Assembly [DFA]',
    ],
  },
  {
    title: 'Structural Engineer',
    locationLabel: 'Hyderabad',
    qualification: 'M.Tech. / B.Tech. [+2 years experience]',
    skills: [
      'Structural Mechanics',
      'FEA',
      'Fatigue and creep analysis',
      'CalculiX/Nastran',
      'CAD',
      'C++/Python',
      'Gas Turbine Engines',
    ],
  },
  {
    title: 'Aerospace Structural Engineer',
    locationLabel: 'Hyderabad',
    qualification: 'M.Tech. / B.Tech. [+2 years experience]',
    skills: [
      'Aircraft Structural Systems',
      'Structural Analysis [Static, Dynamic, Fatigue]',
      'Airframe and Aerostructures',
      'Composites [materials, manufacturing processes, analysis]',
      'Programming [C++ / Python]',
      'CAD Tools',
      'CalculiX/Nastran',
    ],
  },
  {
    title: 'Materials Engineer',
    locationLabel: 'Hyderabad',
    qualification: 'M.Tech. / B.Tech. [+2 years experience]',
    skills: [
      'Multiscale Material Modeling',
      'Additive Manufacturing',
      'High-Temperature Fatigue Applications',
      'Material Informatics',
      'Programming [C++ / Python]',
      'PSP Relationships',
    ],
  },
  {
    title: 'Avionics and Flight Control Engineer',
    locationLabel: 'Hyderabad',
    qualification: 'M.Tech. / B.Tech. [+2 years experience]',
    skills: [
      'Avionics Systems',
      'Actuator Control',
      'Embedded Hardware',
      'Sensor Fusion',
      'Control Algorithms [C++/Python/Simulink]',
    ],
  },
  {
    title: 'Power Electronics Engineer',
    locationLabel: 'Hyderabad\n/Bangalore',
    qualification: 'M.Tech. / B.Tech. [+2 years experience]',
    skills: [
      'Power Electronics Design',
      'Aerospace Power Systems',
      'Circuit Simulation [PLECS/MATLAB/Simulink]',
      'Energy Storage Solutions',
      'System Simulation and Modeling',
    ],
  },
  {
    title: 'Control Systems Engineer',
    locationLabel: 'Bangalore',
    qualification: 'M.Tech. / B.Tech. [+2 years experience]',
    skills: [
      'Gas Turbine Engine Control Systems',
      'Power Electronics',
      'Control Systems',
      'FPGA Programming',
      'Verilog',
      'SIL/HIL',
      'C++, Python, MATLAB/Simulink',
    ],
  },
  {
    title: 'Combustion Systems Engineer',
    locationLabel: 'Hyderabad',
    qualification: 'M.Tech. / B.Tech. [+2 years experience]',
    skills: [
      'Gas Turbine Combustion and Fuel Systems Design',
      'Fuel Systems Engineering',
      'Combustion Modeling',
      'CFD Simulation',
      'Components Testing and Integration',
    ],
  },
  {
    title: 'CFD Simulation Engineer',
    locationLabel: 'Hyderabad\n/Bangalore',
    qualification: 'M.Tech. / B.Tech. [+2 years experience]',
    skills: [
      'CFD Fundamentals',
      'OpenFOAM/SU2 Solver Customization',
      'Ansys scripting',
      'Compressible/Incompressible Flow Simulation',
      'High-Speed Aerodynamics',
      'Turbulence and Multiphase Modeling',
      'C++/Python Programming',
    ],
  },
  {
    title: 'C++ Developer',
    locationLabel: 'Hyderabad',
    qualification: 'M.Tech. / B.Tech. [+2 years experience]',
    skills: [
      'C++ Programming',
      'Software Architecture',
      'Multithreading',
      'Algorithm Optimization',
      'CUDA [Desirable]',
    ],
  },
  {
    title: 'UX Developer',
    locationLabel: 'Hyderabad\n/Bangalore',
    qualification: "Bachelor's in Relevant Field",
    skills: [
      'UX Design',
      'Figma/Adobe XD',
      'Frontend [HTML/CSS/JS]',
      'Responsive Design',
      'UI Frameworks',
      'User Testing',
    ],
  },
  {
    title: 'Java Developer',
    locationLabel: 'Hyderabad\n/Bangalore',
    qualification: "Bachelor's in Relevant Field",
    skills: [
      'Core Java Programming',
      'Object-Oriented Design',
      'Multithreading',
      'Design Patterns',
      'Data Structures and Algorithms',
    ],
  },
  {
    title: 'JavaScript Developer',
    locationLabel: 'Hyderabad/Bangalore',
    qualification: "Bachelor's in Relevant Field",
    skills: [
      'JavaScript',
      'ReactJS',
      'Frontend Development',
      'Responsive UI Design',
      'API Integration [REST]',
      'Component-Based Architecture',
    ],
  },
  {
    title: 'Engineering Manager',
    locationLabel: 'Hyderabad\n/Bangalore',
    qualification: "Master's Degree in Relevant Field",
    skills: [
      'Engineering Management',
      'Systems Engineering',
      'Project Planning [Jira/Confluence/Excel]',
      'Cross-Functional Coordination',
      'Data-Driven Engineering',
      'Aerospace Product Lifecycle',
    ],
  },
  {
    title: 'Business Development Manager',
    locationLabel: 'Hyderabad/Bangalore',
    qualification: "Master's Degree in Relevant Field",
    skills: [
      'Market Research',
      'Lead Generation',
      'Strategic Planning',
      'Data Analysis',
      'Customer Interface',
      'Aerospace & Defense Markets',
      'Business Strategy Development',
    ],
  },
  {
    title: 'Composite Fabrication Technician',
    locationLabel: 'Hyderabad',
    qualification: 'Diploma/B.Tech in Relevant Field',
    skills: [
      'Composite Layup',
      'Mould Preparation',
      'Hand Lamination',
      'Vacuum Bagging',
      'Autoclave Operation/Oven Curing/RTM',
      'Trimming and Finishing',
      'Quality Inspection',
    ],
  },
  {
    title: 'Electromechanical Assembly Expert',
    locationLabel: 'Hyderabad',
    qualification: 'Diploma/B.Tech in Relevant Field',
    skills: [
      'Electromechanical Assembly',
      'Wiring and Harnessing',
      'PCB Integration',
      'Mechanical Sub-Assembly',
      'Sensor and Actuator Installation',
      'System Testing',
    ],
  },
  {
    title: 'Fabrication Technician',
    locationLabel: 'Hyderabad',
    qualification: 'Diploma in Relevant Field',
    skills: [
      'Wood Cutting and Shaping',
      'Tool Handling and Operation',
      'Jig and Fixture Preparation',
      'Material Measurement and Marking',
      'Assembly Support',
      'Workshop Safety Practices',
    ],
  },
]

const wrappedRole = roleDefinitions[0]
const linearRoles = roleDefinitions.slice(1)

const homepageHtml = `
  <html>
    <head>
      <title>Home | Paninian Svayatt Portal</title>
      <link rel="canonical" href="https://www.svayatt.co.in">
      <meta property="og:site_name" content="Paninian Svayatt Portal">
    </head>
    <body>
      <h1>PANINIAN</h1>
      <p>THE UNIFIED PLATFORM FOR AUTONOMOUS SYSTEMS</p>
      <a href="https://www.svayatt.co.in/blank-19">Job Openings</a>
      <a href="https://www.linkedin.com/company/paninian-india-pvt-ltd/posts/?feedView=all">LinkedIn</a>
      <a href="mailto:info@paninian.com">info@paninian.com</a>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>Careers | Paninian Svayatt Portal</title>
      <link rel="canonical" href="https://www.svayatt.co.in/blank-19">
      <meta property="og:site_name" content="Paninian Svayatt Portal">
    </head>
    <body>
      <h1>Careers</h1>
      <p>Paninian Aerospace is seeking to talent accross various disciplines to augment Aerospace Engineering.</p>
      <p>Join us to make an impact.</p>
      <p>Email us at <a href="mailto:careers_india@paninian.com">careers_india@paninian.com</a></p>
      <a href="https://www.svayatt.co.in/blank-24">View Open Positions</a>
    </body>
  </html>
`

const openPositionsHtml = `
  <html>
    <head>
      <title>open positions | Paninian Svayatt Portal</title>
      <link rel="canonical" href="https://www.svayatt.co.in/blank-24">
      <meta property="og:site_name" content="Paninian Svayatt Portal">
    </head>
    <body>
      ${richText('Open Positions')}
      ${richText('Job Title')}
      ${richText('Location')}
      ${richText('Min Qualification')}
      ${richText('Skills')}
      ${richText(wrappedRole.skills.map((skill) => `- ${skill}`).join('\n'))}
      ${linearRoles.map((role) => [
        richText(role.title),
        richText(role.locationLabel),
        richText(role.qualification),
        richText(role.skills.map((skill) => `- ${skill}`).join('\n')),
      ].join('')).join('')}
      ${richText(wrappedRole.title)}
      ${richText(wrappedRole.locationLabel)}
      ${richText(wrappedRole.qualification)}
      ${richText('The next generation platform for affordable autonomous aerial systems')}
    </body>
  </html>
`

const missingRouteHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta name="robots" content="noindex">
      <title>404 Error: Page Not Found</title>
      <script>
        window.__ERROR_DATA__ = {
          errorCode: '404-NotBranded'
        };
      </script>
      <link rel="stylesheet" href="//static.parastorage.com/services/classic-error-pages-statics/1.90.0/app.min.css">
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

test('Paninian India scraper verifies the official surfaces and extracts the wrapped open positions grid', async () => {
  const paninian = await loadPaninianModule()

  assert.equal(paninian.SOURCE, 'paninianindia')
  assert.equal(paninian.COMPANY, 'Paninian India')
  assert.equal(paninian.COMPANY_DOMAIN, 'svayatt.co.in')
  assert.equal(paninian.HOMEPAGE_URL, 'https://www.svayatt.co.in/')
  assert.equal(paninian.CAREERS_URL, 'https://www.svayatt.co.in/blank-19')
  assert.equal(paninian.OPEN_POSITIONS_URL, 'https://www.svayatt.co.in/blank-24')
  assert.equal(paninian.SHARED_APPLY_URL, 'mailto:careers_india@paninian.com')
  assert.equal(paninian.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(paninian.hasVerifiedCareersLink(homepageHtml), true)
  assert.equal(paninian.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(paninian.hasVerifiedOpenPositionsLink(careersHtml), true)
  assert.equal(paninian.extractApplyEmail(careersHtml), 'careers_india@paninian.com')
  assert.equal(paninian.hasOfficialOpenPositionsSignal(openPositionsHtml), true)
  assert.equal(
    paninian.isVerifiedMissingRoute({
      status: 404,
      url: paninian.MISSING_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )

  const jobs = paninian.extractPublicJobs(openPositionsHtml)

  assert.equal(jobs.length, 18)
  assert.deepEqual(
    jobs.map((job) => job.title),
    paninian.EXPECTED_JOB_TITLES,
  )

  const cadEngineer = jobs.find((job) => job.title === 'CAD Engineer')
  assert.ok(cadEngineer)
  assert.equal(cadEngineer.location, 'Hyderabad, India')
  assert.equal(cadEngineer.minimumQualification, 'B.Tech. in Relevant Field')
  assert.equal(cadEngineer.applyUrl, 'mailto:careers_india@paninian.com')
  assert.deepEqual(cadEngineer.requiredSkills.slice(0, 3), [
    '3D CAD Modeling [Autodesk Inventor/Fusion 360]',
    'Electromechanical Assembly',
    'Composite Part Design',
  ])

  const structuralEngineer = jobs.find((job) => job.title === 'Structural Engineer')
  assert.ok(structuralEngineer)
  assert.equal(structuralEngineer.city, 'Hyderabad')
  assert.equal(structuralEngineer.minimumQualification, 'M.Tech. / B.Tech.')
  assert.equal(structuralEngineer.experienceRequired, '2+ years experience')
})

test('Paninian India scraper returns the verified first-party openings through the provider run path', async () => {
  const paninian = await loadPaninianModule()
  const requestedUrls = []

  const jobs = await paninian.createPaninianIndiaScraper({
    now: () => new Date('2026-07-11T10:30:00.000Z'),
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === paninian.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (paninian.HOMEPAGE_ALIAS_URLS.includes(url)) {
        return { status: 200, url: paninian.HOMEPAGE_URL, html: homepageHtml }
      }

      if (url === paninian.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === paninian.OPEN_POSITIONS_URL) {
        return { status: 200, url, html: openPositionsHtml }
      }

      if (paninian.MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    paninian.HOMEPAGE_URL,
    ...paninian.HOMEPAGE_ALIAS_URLS,
    paninian.CAREERS_URL,
    paninian.OPEN_POSITIONS_URL,
    ...paninian.MISSING_ROUTE_URLS,
  ])
  assert.equal(jobs.length, 18)
  assert.equal(jobs[0].company, 'Paninian India')
  assert.equal(jobs[0].source, 'paninianindia')
  assert.equal(jobs[0].companyCareerPage, 'https://www.svayatt.co.in/blank-24')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.match(jobs[0].scrapedAt, /^2026-07-11T10:30:00\.000Z$/)
})

test('Paninian India scraper fails closed when the verified careers handoff or open positions role set drifts', async () => {
  const paninian = await loadPaninianModule()

  await assert.rejects(
    paninian.createPaninianIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === paninian.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (paninian.HOMEPAGE_ALIAS_URLS.includes(url)) {
          return { status: 200, url: paninian.HOMEPAGE_URL, html: homepageHtml }
        }

        if (url === paninian.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace('View Open Positions', 'Explore Roles Elsewhere'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers landing page no longer links/i,
  )

  await assert.rejects(
    paninian.createPaninianIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === paninian.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (paninian.HOMEPAGE_ALIAS_URLS.includes(url)) {
          return { status: 200, url: paninian.HOMEPAGE_URL, html: homepageHtml }
        }

        if (url === paninian.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === paninian.OPEN_POSITIONS_URL) {
          return {
            status: 200,
            url,
            html: openPositionsHtml.replace('Business Development Manager', 'Business Lead'),
          }
        }

        if (paninian.MISSING_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /role set changed materially|grid changed shape/i,
  )
})
