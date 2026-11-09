import assert from 'node:assert/strict'
import test from 'node:test'

const SOURCE = 'mettlesemi'
const COMPANY = 'Mettlesemi systems & technologies'
const HOMEPAGE_URL = 'https://www.mettlesemi.com/'
const CAREERS_URL = 'https://www.mettlesemi.com/careers/'
const CAREERS_ALIAS_URL = 'https://www.mettlesemi.com/career'
const SITEMAP_URL = 'https://www.mettlesemi.com/sitemap.xml'
const JOBS_SITEMAP_URL = 'https://www.mettlesemi.com/awsm_job_openings-sitemap.xml'
const MISSING_ROUTE_URLS = [
  'https://www.mettlesemi.com/jobs',
  'https://www.mettlesemi.com/join-us',
  'https://www.mettlesemi.com/openings',
  'https://www.mettlesemi.com/current-openings',
]

const EXPECTED_PUBLIC_OPENINGS = [
  {
    roleId: '5141',
    title: 'SENIOR CHIP DESIGN ENGINEER',
    detailUrl: 'https://www.mettlesemi.com/jobs/senior-chip-design-engineer/',
    categories: ['Design'],
    experienceLine: '6+ years of experience in chip design.',
    requiredSkills: [
      'Proficiency in Verilog/System Verilog.',
      'Experience with successful tape-outs of complex, high-volume SoCs in advanced design nodes.',
    ],
  },
  {
    roleId: '5140',
    title: 'DFT ENGINEER',
    detailUrl: 'https://www.mettlesemi.com/jobs/dft-engineer/',
    categories: ['Design'],
    experienceLine: '6+ years chip design experience.',
    requiredSkills: [
      'Hands-on experience with multi-vendor DFT tools.',
      'Knowledge of DFT technologies (JTAG, MBIST, Scan).',
    ],
  },
  {
    roleId: '5139',
    title: 'SR. SOC DESIGN VERIFICATION ENGINEERS',
    detailUrl: 'https://www.mettlesemi.com/jobs/sr-soc-design-verification-engineers/',
    categories: ['Design', 'Verification'],
    experienceLine: "Bachelor's / Master's degree in Electrical Engineering or Computer Science with 7-10 years of relevant experience.",
    requiredSkills: [
      'Verilog / System Verilog based verification experience at Subsystem and Full chip level.',
      'Experience in UVM/OVM based methodology Development.',
    ],
  },
  {
    roleId: '5138',
    title: 'LEAD SOC DESIGN VERIFICATION/EMULATION ENGINEERS',
    detailUrl: 'https://www.mettlesemi.com/jobs/lead-soc-design-verification-emulation-engineers/',
    categories: ['Design', 'Emulation', 'Verification'],
    experienceLine: "Bachelor's / Master's degree in Electrical Engineering or Computer Science with 6+ years of relevant experience.",
    requiredSkills: [
      'Experience with SOC bot flow, clocking and platform bring up in Emlators or Silicon Desired',
      'Experience in UVM/OVM based methodology Development.',
    ],
  },
  {
    roleId: '5137',
    title: 'VALIDATION ENGINEERS',
    detailUrl: 'https://www.mettlesemi.com/jobs/validation-engineers/',
    categories: ['Validation'],
    experienceLine: '5-10 years experience in Silicon or Protocol Validation',
    requiredSkills: [
      'Strong skills in scripting, debug tools, and hands-on lab validation',
      'Expertise with DRAM, ARM, security protocols, and controller testing',
    ],
  },
  {
    roleId: '5136',
    title: 'SIGNAL AND POWER INTEGRITY (SIPI) ENGINEER',
    detailUrl: 'https://www.mettlesemi.com/jobs/signal-and-power-integrity-sipi-engineer/',
    categories: ['Design'],
    experienceLine: "Bachelor's or Master's in Electrical Engineering with 5+ years of experience in SI/PI analysis.",
    requiredSkills: [
      'Hands-on expertise in board-level and package-level SI/PI analysis.',
      'Familiarity with HyperLynx or equivalent SI/PI tools.',
    ],
  },
  {
    roleId: '5135',
    title: 'FPGA Design & ASIC Prototyping Engineer',
    detailUrl: 'https://www.mettlesemi.com/jobs/fpga-design-asic-prototyping-engineer/',
    categories: ['Design'],
    experienceLine: '4+ years of experience in FPGA design and ASIC prototyping.',
    requiredSkills: [
      'Experience with Xilinx or Intel FPGA flows.',
      'Strong knowledge of RTL design, synthesis, and timing closure.',
    ],
  },
  {
    roleId: '5134',
    title: 'EMBEDDED SOFTWARE ENGINEERS',
    detailUrl: 'https://www.mettlesemi.com/jobs/embedded-software-engineers/',
    categories: ['Embedded'],
    experienceLine: '3+ years of experience in embedded software development.',
    requiredSkills: [
      'Strong C/C++ programming for embedded platforms.',
      'Experience with Linux device drivers and board bring-up.',
    ],
  },
  {
    roleId: '5132',
    title: 'Validation and Embedded Engineers',
    detailUrl: 'https://www.mettlesemi.com/jobs/validation-and-embedded-engineers/',
    categories: ['Validation'],
    experienceLine: '3-8 years experience in validation and embedded engineering.',
    requiredSkills: [
      'Experience with silicon bring-up, lab validation, and scripting.',
      'Exposure to embedded firmware or driver development.',
    ],
  },
]

const loadMettlesemiModule = async () => import('./script.js')

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Mettlesemi Home - Mettlesemi</title>
    <link rel="canonical" href="https://www.mettlesemi.com/" />
    <meta property="og:site_name" content="Mettlesemi" />
  </head>
  <body>
    <h1>Productize Your Ideas!</h1>
    <nav>
      <a href="https://www.mettlesemi.com/careers/">Careers</a>
    </nav>
    <footer>
      <a href="mailto:info@mettlesemi.com">info@mettlesemi.com</a>
      <div>Mettlesemi Systems and Technologies Private Limited,Bangalore. Karnataka, India.</div>
      <div>© 2025. Mettlesemi Systems and Technologies Private Limited. All Rights Reserved.</div>
    </footer>
  </body>
</html>
`

const SITEMAP_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://www.mettlesemi.com/page-sitemap.xml</loc></sitemap>
  <sitemap><loc>https://www.mettlesemi.com/awsm_job_openings-sitemap.xml</loc></sitemap>
</sitemapindex>
`

const JOBS_SITEMAP_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${EXPECTED_PUBLIC_OPENINGS.map((opening) => `<url><loc>${opening.detailUrl}</loc></url>`).join('\n')}
</urlset>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers - Mettlesemi</title>
    <link rel="canonical" href="https://www.mettlesemi.com/careers/" />
  </head>
  <body>
    <h2><strong>Empowering Talent. Building the Future of Electronics.</strong></h2>
    <p>Explore opportunities to learn, lead, and make a difference.</p>
    <div class="awsm-job-wrap">
      <div class="awsm-filter-wrap">
        <form action="https://www.mettlesemi.com/wp-admin/admin-ajax.php" method="POST">
          <input type="hidden" name="action" value="jobfilter" />
        </form>
      </div>
      <div class="awsm-job-listings awsm-row awsm-grid-col-2" data-listings="12">
        ${EXPECTED_PUBLIC_OPENINGS.map((opening) => `
          <div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-${opening.roleId}">
            <a href="${opening.detailUrl}" class="awsm-job-item">
              <div class="awsm-grid-left-col">
                <h2 class="awsm-job-post-title">${opening.title.replace('&', '&#038;')}</h2>
              </div>
              <div class="awsm-grid-right-col">
                <div class="awsm-job-specification-wrapper">
                  <div class="awsm-job-specification-item awsm-job-specification-job-category">
                    ${opening.categories.map((category) => `<span class="awsm-job-specification-term">${category}</span>`).join(' ')}
                  </div>
                  <div class="awsm-job-specification-item awsm-job-specification-job-location">
                    <span class="awsm-job-specification-term">Bangalore</span>
                  </div>
                </div>
                <div class="awsm-job-more-container"><span class="awsm-job-more">More Details</span></div>
              </div>
            </a>
          </div>
        `).join('\n')}
      </div>
    </div>
    <footer>
      <a href="mailto:info@mettlesemi.com">info@mettlesemi.com</a>
      <div>Mettlesemi Systems and Technologies Private Limited,Bangalore. Karnataka, India.</div>
    </footer>
  </body>
</html>
`

const MISSING_ROUTE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Page not found - Mettlesemi</title>
  </head>
  <body>
    <h1>Page not found</h1>
    <p>The page you are looking for could not be found.</p>
  </body>
</html>
`

const createDetailHtml = (opening) => `
<!doctype html>
<html lang="en-US">
  <head>
    <title>${opening.title.replace('&', '&amp;')} - Mettlesemi</title>
    <link rel="canonical" href="${opening.detailUrl}" />
  </head>
  <body>
    <div class="awsm-job-content">
      <h1 class="awsm-jobs-single-title">${opening.title.replace('&', '&#038;')}</h1>
      <div class="awsm-job-specifications-container">
        <div class="awsm-job-specification-item awsm-job-specification-job-category">
          <span class="awsm-job-specification-label"><strong>Job Category: </strong></span>
          ${opening.categories.map((category) => `<span class="awsm-job-specification-term">${category}</span>`).join(' ')}
        </div>
        <div class="awsm-job-specification-item awsm-job-specification-job-type">
          <span class="awsm-job-specification-label"><strong>Job Type: </strong></span>
          <span class="awsm-job-specification-term">Full Time</span>
        </div>
        <div class="awsm-job-specification-item awsm-job-specification-job-location">
          <span class="awsm-job-specification-label"><strong>Job Location: </strong></span>
          <span class="awsm-job-specification-term">Bangalore</span>
        </div>
      </div>
      <div class="awsm-job-entry-content entry-content">
        <p>Mettlesemi Systems and Technologies Pvt Ltd, based in Bengaluru, specializes in embedded systems and silicon solutions.</p>
        <h3>Requirements</h3>
        <ul>
          <li>${opening.experienceLine}</li>
          ${opening.requiredSkills.map((skill) => `<li>${skill}</li>`).join('')}
        </ul>
      </div><!-- .awsm-job-entry-content -->
    </div><!-- .awsm-job-content -->
    <div class="awsm-job-form">
      <div class="awsm-job-form-inner">
        <h2>Apply for this position</h2>
        <form id="awsm-application-form" class="awsm-application-form">
          <label for="awsm-applicant-name">Full Name <span class="awsm-job-form-error">*</span></label>
          <input id="awsm-applicant-name" class="awsm-job-form-control" />
          <label for="awsm-applicant-email">Email <span class="awsm-job-form-error">*</span></label>
          <input id="awsm-applicant-email" class="awsm-job-form-control" />
          <label for="awsm-applicant-phone">Phone <span class="awsm-job-form-error">*</span></label>
          <input id="awsm-applicant-phone" class="awsm-job-form-control" />
          <label for="awsm-cover-letter">Cover Letter <span class="awsm-job-form-error">*</span></label>
          <textarea id="awsm-cover-letter" class="awsm-job-form-control"></textarea>
          <label for="awsm-application-file">Upload CV/Resume <span class="awsm-job-form-error">*</span></label>
          <input id="awsm-application-file" class="awsm-job-form-control" />
        </form>
      </div>
    </div>
  </body>
</html>
`

test('Mettlesemi scraper recognizes the verified homepage, sitemaps, careers page, and missing-route shell', async () => {
  const mettlesemi = await loadMettlesemiModule()

  assert.equal(mettlesemi.SOURCE, SOURCE)
  assert.equal(mettlesemi.COMPANY, COMPANY)
  assert.equal(mettlesemi.HOMEPAGE_URL, HOMEPAGE_URL)
  assert.equal(mettlesemi.CAREERS_URL, CAREERS_URL)
  assert.equal(mettlesemi.CAREERS_ALIAS_URL, CAREERS_ALIAS_URL)
  assert.equal(mettlesemi.SITEMAP_URL, SITEMAP_URL)
  assert.equal(mettlesemi.JOBS_SITEMAP_URL, JOBS_SITEMAP_URL)
  assert.deepEqual(mettlesemi.MISSING_ROUTE_URLS, MISSING_ROUTE_URLS)
  assert.equal(mettlesemi.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(mettlesemi.hasVerifiedSitemapSignal(SITEMAP_XML), true)
  assert.equal(mettlesemi.hasVerifiedJobsSitemapSignal(JOBS_SITEMAP_XML), true)
  assert.equal(mettlesemi.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(
    mettlesemi.isVerifiedCareersAlias({ status: 200, url: CAREERS_URL, html: CAREERS_HTML }),
    true,
  )
  assert.equal(mettlesemi.isVerifiedMissingRoute({ status: 404, html: MISSING_ROUTE_HTML }), true)
})

test('Mettlesemi scraper extracts the verified visible role cards and inline-apply detail metadata', async () => {
  const mettlesemi = await loadMettlesemiModule()

  assert.deepEqual(
    mettlesemi.extractCurrentRoleCards(CAREERS_HTML),
    EXPECTED_PUBLIC_OPENINGS.map(({ roleId, title, detailUrl }) => ({ roleId, title, detailUrl })),
  )

  const detail = mettlesemi.extractDetailPage({
    title: EXPECTED_PUBLIC_OPENINGS[3].title,
    detailUrl: EXPECTED_PUBLIC_OPENINGS[3].detailUrl,
    html: createDetailHtml(EXPECTED_PUBLIC_OPENINGS[3]),
  })

  assert.deepEqual(detail, {
    title: 'LEAD SOC DESIGN VERIFICATION/EMULATION ENGINEERS',
    department: 'Design, Emulation, Verification',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    employmentType: 'Full Time',
    applyUrl: 'https://www.mettlesemi.com/jobs/lead-soc-design-verification-emulation-engineers/',
    experienceRequired: '6+ years',
    requiredSkills: [
      EXPECTED_PUBLIC_OPENINGS[3].experienceLine,
      ...EXPECTED_PUBLIC_OPENINGS[3].requiredSkills,
    ],
    jobDescription: [
      'Mettlesemi Systems and Technologies Pvt Ltd, based in Bengaluru, specializes in embedded systems and silicon solutions.',
      'Requirements',
      EXPECTED_PUBLIC_OPENINGS[3].experienceLine,
      ...EXPECTED_PUBLIC_OPENINGS[3].requiredSkills,
    ].join('\n'),
  })
})

test('Mettlesemi scraper run() validates the verified first-party surface and returns nine current jobs', async () => {
  const mettlesemi = await loadMettlesemiModule()
  const fetchCounts = new Map()

  const fetchPage = async (url) => {
    fetchCounts.set(url, (fetchCounts.get(url) || 0) + 1)

    if (url === HOMEPAGE_URL) return { status: 200, url, html: HOMEPAGE_HTML }
    if (url === SITEMAP_URL) return { status: 200, url, html: SITEMAP_XML }
    if (url === JOBS_SITEMAP_URL) return { status: 200, url, html: JOBS_SITEMAP_XML }
    if (url === CAREERS_URL) return { status: 200, url, html: CAREERS_HTML }
    if (url === CAREERS_ALIAS_URL) return { status: 200, url: CAREERS_URL, html: CAREERS_HTML }
    if (MISSING_ROUTE_URLS.includes(url)) return { status: 404, url, html: MISSING_ROUTE_HTML }

    const opening = EXPECTED_PUBLIC_OPENINGS.find((item) => item.detailUrl === url)
    if (opening) return { status: 200, url, html: createDetailHtml(opening) }

    throw new Error(`Unexpected URL ${url}`)
  }

  const jobs = await mettlesemi.createMettlesemiScraper({ now: () => '2026-07-11T02:30:00.000Z' }).run({ fetchPage })

  assert.equal(jobs.length, 9)
  assert.deepEqual(
    jobs[0],
    {
      title: 'SENIOR CHIP DESIGN ENGINEER',
      company: COMPANY,
      department: 'Design',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'mettlesemi-5141',
      requisitionId: '5141',
      sourceUrl: 'https://www.mettlesemi.com/jobs/senior-chip-design-engineer/',
      applyUrl: 'https://www.mettlesemi.com/jobs/senior-chip-design-engineer/',
      employmentType: 'Full Time',
      experienceRequired: '6+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        '6+ years of experience in chip design.',
        'Proficiency in Verilog/System Verilog.',
        'Experience with successful tape-outs of complex, high-volume SoCs in advanced design nodes.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        'Mettlesemi Systems and Technologies Pvt Ltd, based in Bengaluru, specializes in embedded systems and silicon solutions.',
        'Requirements',
        '6+ years of experience in chip design.',
        'Proficiency in Verilog/System Verilog.',
        'Experience with successful tape-outs of complex, high-volume SoCs in advanced design nodes.',
      ].join('\n'),
      remoteStatus: 'On-site',
      source: SOURCE,
      link: 'https://www.mettlesemi.com/jobs/senior-chip-design-engineer/',
      scrapedAt: '2026-07-11T02:30:00.000Z',
      companyCareerPage: CAREERS_URL,
      companyDomain: 'mettlesemi.com',
      atsPlatform: 'official-company-careers',
    },
  )
  assert.equal(fetchCounts.get(HOMEPAGE_URL), 1)
  assert.equal(fetchCounts.get(SITEMAP_URL), 1)
  assert.equal(fetchCounts.get(JOBS_SITEMAP_URL), 1)
  assert.equal(fetchCounts.get(CAREERS_URL), 1)
  assert.equal(fetchCounts.get(CAREERS_ALIAS_URL), 1)
  assert.equal(MISSING_ROUTE_URLS.every((url) => fetchCounts.get(url) === 1), true)
  assert.equal(EXPECTED_PUBLIC_OPENINGS.every((opening) => fetchCounts.get(opening.detailUrl) === 1), true)
})

test('Mettlesemi scraper fails closed when the verified public role cards drift', async () => {
  const mettlesemi = await loadMettlesemiModule()
  const driftedCareersHtml = CAREERS_HTML.replace(
    'Validation and Embedded Engineers',
    'Validation and Firmware Engineers',
  )

  await assert.rejects(
    mettlesemi.createMettlesemiScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) return { status: 200, url, html: HOMEPAGE_HTML }
        if (url === SITEMAP_URL) return { status: 200, url, html: SITEMAP_XML }
        if (url === JOBS_SITEMAP_URL) return { status: 200, url, html: JOBS_SITEMAP_XML }
        if (url === CAREERS_URL) return { status: 200, url, html: driftedCareersHtml }
        if (url === CAREERS_ALIAS_URL) return { status: 200, url: CAREERS_URL, html: driftedCareersHtml }
        if (MISSING_ROUTE_URLS.includes(url)) return { status: 404, url, html: MISSING_ROUTE_HTML }

        const opening = EXPECTED_PUBLIC_OPENINGS.find((item) => item.detailUrl === url)
        if (opening) return { status: 200, url, html: createDetailHtml(opening) }

        throw new Error(`Unexpected URL ${url}`)
      },
    }),
    /detail page no longer matches|current public openings changed materially/i,
  )
})
