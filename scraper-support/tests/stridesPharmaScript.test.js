import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Join the Strides Team</title>
  </head>
  <body>
    <main>
      <h1>Join Us and Grow with Strides</h1>
      <a href="https://portal.arcolab.com/careerportal/">View current openings</a>
    </main>
  </body>
</html>
`

const PORTAL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Portal</title>
  </head>
  <body>
    <main>
      <p>Build your future with Us</p>
      <p>Welcome to the Careers Centre for strides.</p>
      <ul>
        <li>Strides Pharma Science Limited (Formerly Strides Shasun Limited)</li>
      </ul>
      <a href="https://portal.arcolab.com/careerportal/main.aspx?loc=002">Check Application Status</a>
      <script>
        var MAIN = {
          company: "Strides"
        };
      </script>
      <script src="js/Communicator.js"></script>
    </main>
  </body>
</html>
`

const LISTING_XML = `
<NewDataSet>
  <Table6>
    <JobId>a66d00745ea2e2</JobId>
    <designation>Executive.</designation>
    <title>Executive - Manufacturing Science &amp; Technology</title>
    <department>Manufacturing Science &amp; Technology (MS&amp;T)</department>
    <experience>2 - 3 Years</experience>
    <employee_type>Permanent</employee_type>
    <total_positions>3</total_positions>
    <company>Strides</company>
    <location_city>Bangalore,Bangalore</location_city>
    <Joblocation>Chandapura, Bangalore, Karnataka, India (INGR),Strides Chandapura, Bangalore, Karnataka, India (SE_ML)</Joblocation>
    <createdDate>0</createdDate>
    <jobdesc_txt />
  </Table6>
  <Table6>
    <JobId>5ed88fd569d1d</JobId>
    <designation>Executive.</designation>
    <title>Executive.</title>
    <department>Quality Control</department>
    <experience>1 - 3 Years</experience>
    <employee_type>Permanent</employee_type>
    <total_positions>1</total_positions>
    <company>Strides</company>
    <location_city>Pondicherry</location_city>
    <Joblocation>Strides-Pondicherry-Formulation, Pondicherry, Pondicherry, India (PO_COMM)</Joblocation>
    <createdDate>0</createdDate>
    <jobdesc_txt />
  </Table6>
  <Table6>
    <JobId>ignoreme</JobId>
    <designation>Associate</designation>
    <title>Associate Software Engineer</title>
    <department>Engineering</department>
    <experience>1 - 2 Years</experience>
    <employee_type>Permanent</employee_type>
    <total_positions>1</total_positions>
    <company>ArcoLab</company>
    <location_city>Bangalore</location_city>
    <Joblocation>Bangalore, Karnataka, India</Joblocation>
    <createdDate>0</createdDate>
    <jobdesc_txt />
  </Table6>
</NewDataSet>
`

const LISTING_RESPONSE = {
  d: {
    Returnvalues: LISTING_XML,
    SuccessOrFailure: 'Success',
  },
}

const DETAIL_RESPONSE_1 = {
  d: {
    Returnvalues: `
<NewDataSet>
  <Table>
    <JobId>a66d00745ea2e2</JobId>
    <company>STRIDES PHARMA SCIENCE LTD</company>
    <department>Manufacturing Science &amp; Technology (MS&amp;T)</department>
    <designation>Executive.</designation>
    <employee_type>Permanent</employee_type>
    <experience>2 - 3 Years</experience>
    <location_city>Bangalore,Bangalore</location_city>
    <title>Executive - Manufacturing Science &amp; Technology</title>
    <total_positions>3</total_positions>
    <description>&lt;p&gt;Location: Chandapura&lt;/p&gt;&lt;p&gt;Qualification: BPharma/MPharma&lt;/p&gt;&lt;p&gt;Key Responsibilities&lt;/p&gt;&lt;p&gt;Execution of Exhibit, Trial &amp;amp; Validation batches.&lt;/p&gt;</description>
  </Table>
</NewDataSet>
`,
    SuccessOrFailure: 'Success',
  },
}

const DETAIL_RESPONSE_2 = {
  d: {
    Returnvalues: `
<NewDataSet>
  <Table>
    <JobId>5ed88fd569d1d</JobId>
    <company>STRIDES PHARMA SCIENCE LTD</company>
    <department>Quality Control</department>
    <designation>Executive.</designation>
    <employee_type>Permanent</employee_type>
    <experience>1 - 3 Years</experience>
    <location_city>Pondicherry</location_city>
    <title>Executive.</title>
    <total_positions>1</total_positions>
    <description>&lt;p&gt;Location: Pondicherry&lt;/p&gt;&lt;p&gt;Qualification: BSc Chemistry&lt;/p&gt;&lt;p&gt;Perform routine QC analysis.&lt;/p&gt;</description>
  </Table>
</NewDataSet>
`,
    SuccessOrFailure: 'Success',
  },
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/stridespharma/script.js')
  } catch {
    assert.fail('Expected Strides Pharma scraper module at ../../scraper/stridespharma/script.js')
  }
}

test('Strides Pharma helpers pin the verified first-party careers handoff and portal service contract', async () => {
  const stridesPharma = await loadScriptModule()

  assert.equal(stridesPharma.SOURCE, 'stridespharma')
  assert.equal(stridesPharma.COMPANY_NAME, 'Strides Pharma')
  assert.equal(stridesPharma.OFFICIAL_BRAND_NAME, 'Strides Pharma Science Limited')
  assert.equal(stridesPharma.CAREERS_URL, 'https://www.strides.com/careers')
  assert.equal(stridesPharma.OFFICIAL_CAREERS_HANDOFF_URL, 'https://portal.arcolab.com/careerportal/')
  assert.equal(
    stridesPharma.PORTAL_JOBS_SERVICE_URL,
    'https://portal.arcolab.com/careerportal/ServiceHandler.svc/GenericMethod',
  )
  assert.equal(stridesPharma.PORTAL_COMPANY_TOKEN, 'Strides')
  assert.equal(stridesPharma.LISTING_KEY, '300000100001')
  assert.equal(stridesPharma.DETAIL_KEY, '300000100003')
  assert.equal(stridesPharma.VERIFIED_ON, '2026-07-17')
  assert.equal(stridesPharma.hasOfficialCareersPageSignal(CAREERS_HTML), true)
  assert.equal(stridesPharma.hasOfficialPortalSignal(PORTAL_HTML), true)
  assert.equal(
    stridesPharma.extractPortalServiceUrl(PORTAL_HTML, stridesPharma.OFFICIAL_CAREERS_HANDOFF_URL),
    'https://portal.arcolab.com/careerportal/ServiceHandler.svc/GenericMethod',
  )
  assert.equal(
    stridesPharma.buildServiceRequestBody({
      key: stridesPharma.LISTING_KEY,
      params: { company: stridesPharma.PORTAL_COMPANY_TOKEN },
    }),
    '{"Inputparams":"<data><ctrl><kv>300000100001</kv><bh>V</bh></ctrl><data><param><company>Strides</company></param></data></data>"}',
  )
  assert.equal(
    stridesPharma.buildApplyUrl('a66d00745ea2e2'),
    'https://portal.arcolab.com/careerportal/main.aspx?loc=a66d00745ea2e2&type=direct',
  )
})

test('Strides Pharma extracts current job rows and detail payloads from the public XML service', async () => {
  const stridesPharma = await loadScriptModule()

  const listings = stridesPharma.extractListings(LISTING_RESPONSE.d.Returnvalues)
  assert.equal(listings.length, 2)
  assert.deepEqual(listings[0], {
    jobId: 'a66d00745ea2e2',
    title: 'Executive - Manufacturing Science & Technology',
    designation: 'Executive.',
    department: 'Manufacturing Science & Technology (MS&T)',
    experience: '2 - 3 Years',
    employmentType: 'Permanent',
    totalPositions: '3',
    locationCity: 'Bangalore,Bangalore',
    locationLabel: 'Bangalore, India',
    companyToken: 'Strides',
  })

  const detail = stridesPharma.extractJobDetail(DETAIL_RESPONSE_1.d.Returnvalues)
  assert.deepEqual(detail, {
    jobId: 'a66d00745ea2e2',
    officialCompanyName: 'STRIDES PHARMA SCIENCE LTD',
    title: 'Executive - Manufacturing Science & Technology',
    designation: 'Executive.',
    department: 'Manufacturing Science & Technology (MS&T)',
    employmentType: 'Permanent',
    experience: '2 - 3 Years',
    locationCity: 'Bangalore,Bangalore',
    minimumQualification: 'BPharma/MPharma',
    jobDescription: 'Location: Chandapura Qualification: BPharma/MPharma Key Responsibilities Execution of Exhibit, Trial & Validation batches.',
  })
})

test('Strides Pharma run validates the first-party surfaces, uses the public XML service, and decorates active jobs', async () => {
  const stridesPharma = await loadScriptModule()
  const requestedTexts = []
  const requestedBodies = []

  const jobs = await stridesPharma.createStridesPharmaScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === stridesPharma.CAREERS_URL) return CAREERS_HTML
      if (url === stridesPharma.OFFICIAL_CAREERS_HANDOFF_URL) return PORTAL_HTML
      throw new Error(`Unexpected Strides Pharma text URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requestedBodies.push({
        url,
        body: options.body,
      })

      const payload = JSON.parse(options.body)
      if (payload.Inputparams.includes('<kv>300000100001</kv>')) return LISTING_RESPONSE
      if (payload.Inputparams.includes('<JobId>a66d00745ea2e2</JobId>')) return DETAIL_RESPONSE_1
      if (payload.Inputparams.includes('<JobId>5ed88fd569d1d</JobId>')) return DETAIL_RESPONSE_2
      throw new Error(`Unexpected Strides Pharma payload: ${options.body}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedTexts, [
    stridesPharma.CAREERS_URL,
    stridesPharma.OFFICIAL_CAREERS_HANDOFF_URL,
  ])
  assert.deepEqual(
    requestedBodies.map((item) => item.url),
    [
      stridesPharma.PORTAL_JOBS_SERVICE_URL,
      stridesPharma.PORTAL_JOBS_SERVICE_URL,
      stridesPharma.PORTAL_JOBS_SERVICE_URL,
    ],
  )
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Executive - Manufacturing Science & Technology',
    company: 'Strides Pharma',
    department: 'Manufacturing Science & Technology (MS&T)',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'a66d00745ea2e2',
    requisitionId: 'a66d00745ea2e2',
    sourceUrl: 'https://portal.arcolab.com/careerportal/',
    applyUrl: 'https://portal.arcolab.com/careerportal/main.aspx?loc=a66d00745ea2e2&type=direct',
    employmentType: 'Permanent',
    experienceRequired: '2 - 3 Years',
    minimumQualification: 'BPharma/MPharma',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Location: Chandapura Qualification: BPharma/MPharma Key Responsibilities Execution of Exhibit, Trial & Validation batches.',
    source: 'stridespharma',
    link: 'https://portal.arcolab.com/careerportal/main.aspx?loc=a66d00745ea2e2&type=direct',
    scrapedAt: FIXED_SCRAPED_AT,
  })
  assert.equal(jobs[1].title, 'Executive.')
  assert.equal(jobs[1].location, 'Pondicherry, India')
  assert.equal(jobs[1].minimumQualification, 'BSc Chemistry')
})

test('Strides Pharma fails closed when the careers page, portal shell, or public XML job feed drifts materially', async () => {
  const stridesPharma = await loadScriptModule()

  await assert.rejects(
    stridesPharma.createStridesPharmaScraper().run({
      fetchText: async (url) => {
        if (url === stridesPharma.CAREERS_URL) {
          return CAREERS_HTML.replace(
            'https://portal.arcolab.com/careerportal/',
            'https://jobs.example.com/strides',
          )
        }
        return PORTAL_HTML
      },
      fetchJson: async () => LISTING_RESPONSE,
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    stridesPharma.createStridesPharmaScraper().run({
      fetchText: async (url) => {
        if (url === stridesPharma.CAREERS_URL) return CAREERS_HTML
        return PORTAL_HTML.replace('company: "Strides"', 'company: "Different"')
      },
      fetchJson: async () => LISTING_RESPONSE,
    }),
    /verified career portal/i,
  )

  await assert.rejects(
    stridesPharma.createStridesPharmaScraper().run({
      fetchText: async (url) => {
        if (url === stridesPharma.CAREERS_URL) return CAREERS_HTML
        return PORTAL_HTML
      },
      fetchJson: async (url, options = {}) => {
        const payload = JSON.parse(options.body)
        if (payload.Inputparams.includes('<kv>300000100001</kv>')) {
          return { d: { Returnvalues: '<NewDataSet />', SuccessOrFailure: 'Success' } }
        }
        return DETAIL_RESPONSE_1
      },
    }),
    /returned no current strides jobs/i,
  )
})
