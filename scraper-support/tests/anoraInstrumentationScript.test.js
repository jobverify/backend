import assert from 'node:assert/strict'
import test from 'node:test'

const LISTING_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Discover opportunities</h2>
    <a href="https://anoralabs.com/applyforjob.html">DFT Lead Engineer Banglore</a>
    <a href="https://anoralabs.com/applyforjobmd.html">Mechanical Design Engineer Chennai</a>
    <a href="https://anorasolutions.com/applyforjobpd.html">Product Development Engineer Bangalore</a>
    <a href="/applyforjobsl.html">Application Software Lead Engineer Chennai</a>
  </body>
</html>
`

const DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Application Software Lead Engineer</h2>
    <p>Chennai</p>
    <h3>Summary</h3>
    <p>The Software Lead/Engineer will be responsible for developing device drivers for Electrical and Electronic bench/rack equipment along with Hardware design engineers.</p>
    <h3>Key Qualifications</h3>
    <ul>
      <li>Bachelor's/Master's degree in Electronics/Electrical/Instrumentation/Computer Science Engineering.</li>
      <li>Good experience in object-oriented programming languages like Python/Java/C++/C# etc.</li>
      <li>5+ years of work experience in Application SW Design.</li>
    </ul>
    <h3>Responsibilities</h3>
    <ul>
      <li>Interacting with customers, requirement gathering and SW planning.</li>
      <li>Developing device drivers for Electrical and Electronic bench/rack equipment.</li>
    </ul>
    <h3>Additional Requirements</h3>
    <ul>
      <li>Strong analytical and problem-solving skills.</li>
      <li>Good communication skills.</li>
    </ul>
    <label>Add your attachment</label>
  </body>
</html>
`

const REACT_SHELL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Anora Website</title>
    <script defer src="/static/js/main.a1b2c3d4.js"></script>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
`

const REACT_BUNDLE = `
(()=>{
  const qZ=[
    {id:1,title:"Assembly Manager",location:"Chennai",category:"Assembly",experienced:!0,years:"15",description:"Lead electronics assembly, production planning, quality systems, and people management.",requirements:["Lead day-to-day assembly operations.","Drive continuous improvement initiatives."],preferredSkills:""},
    {id:2,title:"Admin Manager",location:"Chennai",category:"HR",experienced:!0,years:"10",description:"Oversee administrative operations at the Chennai location.",requirements:["Manage statutory compliance.","Lead vendor management and cost control."],preferredSkills:""},
    {id:3,title:"SCM Head",location:"Chennai",category:"SCM",experienced:!0,years:"15",description:"Lead end-to-end supply chain operations for an export-oriented manufacturing unit.",requirements:["15+ years of supply chain experience.","Strong exposure to global supplier networks."],preferredSkills:""},
    {id:4,title:"Test Engineering Lead",location:"Bengaluru",category:"Testing",experienced:!0,years:"8",description:"Lead product test engineering programs.",requirements:["Build automated test strategies."],preferredSkills:"ATE experience"},
    {id:5,title:"US Sales Director",location:"Austin, USA",category:"Sales",experienced:!0,years:"12",description:"Lead regional sales operations.",requirements:["Build enterprise customer relationships."],preferredSkills:""}
  ];
  const findRole=e=>qZ.find(t=>t.id===Number(e));
  const routes=["/careers","/job-details/:id"];
  const apply=body=>fetch("/api/apply",{method:"POST",body});
  return {findRole,routes,apply,label:"APPLY FOR THIS ROLE"};
})();
`

const loadAnoraModule = async () => {
  try {
    return await import('../../scraper/anorainstrumentation/script.js')
  } catch {
    assert.fail('Expected Anora Instrumentation scraper module at ../../scraper/anorainstrumentation/script.js')
  }
}

test('hasOfficialCareersSignal validates the verified Anora careers surface', async () => {
  const anora = await loadAnoraModule()

  assert.equal(anora.hasOfficialCareersSignal(LISTING_HTML), true)
})

test('extractJobUrls keeps unique Anora apply-page links from the official careers page', async () => {
  const anora = await loadAnoraModule()

  assert.equal(anora.CAREERS_PAGE_URL, 'https://anoralabs.com/careers')
  assert.deepEqual(anora.extractJobUrls(LISTING_HTML), [
    'https://anoralabs.com/applyforjob.html',
    'https://anoralabs.com/applyforjobmd.html',
    'https://anoralabs.com/applyforjobpd.html',
    'https://anoralabs.com/applyforjobsl.html',
  ])
})

test('Anora extracts the current React jobs array without depending on its bundle hash or minified variable name', async () => {
  const anora = await loadAnoraModule()

  assert.equal(
    anora.extractReactBundleUrl(REACT_SHELL_HTML),
    'https://anoralabs.com/static/js/main.a1b2c3d4.js',
  )
  assert.deepEqual(
    anora.extractReactJobOpenings(REACT_BUNDLE).map((job) => [
      job.id,
      job.title,
      job.location,
      job.category,
      job.experienced,
    ]),
    [
      [1, 'Assembly Manager', 'Chennai', 'Assembly', true],
      [2, 'Admin Manager', 'Chennai', 'HR', true],
      [3, 'SCM Head', 'Chennai', 'SCM', true],
      [4, 'Test Engineering Lead', 'Bengaluru', 'Testing', true],
      [5, 'US Sales Director', 'Austin, USA', 'Sales', true],
    ],
  )
})

test('run maps every India role added to the React bundle and filters non-India roles', async () => {
  const anora = await loadAnoraModule()
  const requestedUrls = []

  const jobs = await anora.createAnoraInstrumentationScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === anora.CAREERS_PAGE_URL) return REACT_SHELL_HTML
      if (url === 'https://anoralabs.com/static/js/main.a1b2c3d4.js') return REACT_BUNDLE
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-09-12T18:30:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://anoralabs.com/careers',
    'https://anoralabs.com/static/js/main.a1b2c3d4.js',
  ])
  assert.deepEqual(jobs.map((job) => job.title), [
    'Assembly Manager',
    'Admin Manager',
    'SCM Head',
    'Test Engineering Lead',
  ])
  assert.deepEqual(jobs[0], {
    title: 'Assembly Manager',
    company: 'Anora Instrumentation Private Limited',
    department: 'Assembly',
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    jobId: 'anorainstrumentation-1',
    requisitionId: 'anorainstrumentation-1',
    sourceUrl: 'https://anoralabs.com/job-details/1',
    applyUrl: 'https://anoralabs.com/job-details/1',
    employmentType: 'Full-time',
    experienceRequired: '15 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Lead day-to-day assembly operations.',
      'Drive continuous improvement initiatives.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Lead electronics assembly, production planning, quality systems, and people management. Lead day-to-day assembly operations. Drive continuous improvement initiatives.',
    remoteStatus: 'On-site',
    source: 'anorainstrumentation',
    link: 'https://anoralabs.com/job-details/1',
    scrapedAt: '2026-09-12T18:30:00.000Z',
  })
  assert.equal(jobs[3].city, 'Bangalore')
})

test('Anora rejects malformed or executable React job data instead of returning an empty result', async () => {
  const anora = await loadAnoraModule()
  const malformedBundle = REACT_BUNDLE.replace(
    'requirements:["Lead day-to-day assembly operations.","Drive continuous improvement initiatives."]',
    'requirements:getRequirements()',
  )

  assert.throws(
    () => anora.extractReactJobOpenings(malformedBundle),
    /React careers bundle/i,
  )
  await assert.rejects(
    anora.createAnoraInstrumentationScraper().run({
      fetchText: async (url) => (
        url === anora.CAREERS_PAGE_URL ? REACT_SHELL_HTML : malformedBundle
      ),
    }),
    /React careers bundle/i,
  )
})

test('extractJobDetail maps Anora detail pages into scraper jobs', async () => {
  const anora = await loadAnoraModule()

  assert.deepEqual(
    anora.extractJobDetail(DETAIL_HTML, 'https://anoralabs.com/applyforjobsl.html'),
    {
      title: 'Application Software Lead Engineer',
      company: 'Anora Instrumentation Private Limited',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'anorainstrumentation-application-software-lead-engineer',
      requisitionId: 'anorainstrumentation-application-software-lead-engineer',
      sourceUrl: 'https://anoralabs.com/applyforjobsl.html',
      applyUrl: 'https://anoralabs.com/applyforjobsl.html',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: "Bachelor's/Master's degree in Electronics/Electrical/Instrumentation/Computer Science Engineering.",
      preferredQualification: null,
      requiredSkills: [
        "Bachelor's/Master's degree in Electronics/Electrical/Instrumentation/Computer Science Engineering.",
        'Good experience in object-oriented programming languages like Python/Java/C++/C# etc.',
        '5+ years of work experience in Application SW Design.',
        'Interacting with customers, requirement gathering and SW planning.',
        'Developing device drivers for Electrical and Electronic bench/rack equipment.',
        'Strong analytical and problem-solving skills.',
        'Good communication skills.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: "The Software Lead/Engineer will be responsible for developing device drivers for Electrical and Electronic bench/rack equipment along with Hardware design engineers. Bachelor's/Master's degree in Electronics/Electrical/Instrumentation/Computer Science Engineering. Good experience in object-oriented programming languages like Python/Java/C++/C# etc. 5+ years of work experience in Application SW Design. Interacting with customers, requirement gathering and SW planning. Developing device drivers for Electrical and Electronic bench/rack equipment. Strong analytical and problem-solving skills. Good communication skills.",
      remoteStatus: 'On-site',
    },
  )
})

test('run fetches Anora listing and detail pages and decorates runner fields', async () => {
  const anora = await loadAnoraModule()
  const requestedUrls = []

  const jobs = await anora.createAnoraInstrumentationScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === anora.CAREERS_PAGE_URL) return LISTING_HTML
      if (url === 'https://anoralabs.com/applyforjob.html') return DETAIL_HTML.replace(/Application Software Lead Engineer/g, 'DFT Lead Engineer').replace(/Chennai/g, 'Bangalore')
      if (url === 'https://anoralabs.com/applyforjobmd.html') return DETAIL_HTML.replace(/Application Software Lead Engineer/g, 'Mechanical Design Engineer')
      if (url === 'https://anoralabs.com/applyforjobpd.html') return DETAIL_HTML.replace(/Application Software Lead Engineer/g, 'Product Development Engineer').replace(/Chennai/g, 'Banglore')
      if (url === 'https://anoralabs.com/applyforjobsl.html') return DETAIL_HTML
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-09T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    anora.CAREERS_PAGE_URL,
    'https://anoralabs.com/applyforjob.html',
    'https://anoralabs.com/applyforjobmd.html',
    'https://anoralabs.com/applyforjobpd.html',
    'https://anoralabs.com/applyforjobsl.html',
  ])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'anorainstrumentation')
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-09T12:00:00.000Z')
})

test('run fails closed when the Anora careers surface changes', async () => {
  const anora = await loadAnoraModule()

  await assert.rejects(
    anora.createAnoraInstrumentationScraper().run({
      fetchText: async () => '<html><body>No opportunities here</body></html>',
    }),
    /verified Anora careers surface/i,
  )
})
