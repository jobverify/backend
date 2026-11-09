import assert from 'node:assert/strict'
import test from 'node:test'

const loadRubrikModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const careersHtml = String.raw`
<!DOCTYPE html>
<html>
  <head>
    <title>Careers at Rubrik | Discover The Power of You</title>
    <meta
      name="description"
      content="Explore cybersecurity and AI careers at Rubrik. Come do the best work of your life at a company securing and accelerating the world's AI transformation."
    />
  </head>
  <body>
    <h1>Together, we're unstoppable.</h1>
    <a class="departments_grid__new-link btn-link" href="/company/careers/departments/people">View Openings</a>
    <a class="departments_grid__new-link btn-link" href="/company/careers/departments/product">View Openings</a>
  </body>
</html>
`

const careersHtmlWithoutTogetherCopy = careersHtml.replace(
  "<h1>Together, we're unstoppable.</h1>",
  '<h1>Discover The Power of You</h1>',
)

const peopleDepartmentHtml = String.raw`
<!DOCTYPE html>
<html>
  <body>
    <h2>Show positions for</h2>
    <h4>Bangalore, India Office</h4>
    <a href="/company/careers/departments/job.2333116">Senior People Partner - APAC</a>
    <h4>Palo Alto, CA HQ Office</h4>
    <a href="/company/careers/departments/job.5555555">Senior People Partner, GTM</a>
  </body>
</html>
`

const productDepartmentHtml = String.raw`
<!DOCTYPE html>
<html>
  <body>
    <h2>The Team</h2>
    <h4>Bangalore, India Office</h4>
    <a href="/company/careers/departments/job.7540806">Staff Product Manager-Cloud Data Protection</a>
  </body>
</html>
`

const peopleIndiaJobHtml = String.raw`
<!DOCTYPE html>
<html>
  <body>
    <h2>Job Summary</h2>
    <h1>Senior People Partner - APAC</h1>
    <p>Location: Bangalore, India Office</p>
    <h3>About the Role</h3>
    <p>Partner with APAC leaders and drive people strategy.</p>
    <h3>Required Skills & Experience</h3>
    <ul>
      <li>10+ years of HRBP experience</li>
      <li>Experience with India employment law</li>
    </ul>
    <h3>Apply For This Job</h3>
  </body>
</html>
`

const peopleUsJobHtml = String.raw`
<!DOCTYPE html>
<html>
  <body>
    <h2>Job Summary</h2>
    <h1>Senior People Partner, GTM</h1>
    <p>Location: Palo Alto, CA HQ Office</p>
    <h3>About the Role</h3>
    <p>Support GTM leaders in California.</p>
    <h3>Apply For This Job</h3>
  </body>
</html>
`

const productIndiaJobHtml = String.raw`
<!DOCTYPE html>
<html>
  <body>
    <h1>Staff Product Manager, Cloud Data Protection</h1>
    <p>Bangalore, India Office</p>
    <p>Location: Bangalore, India</p>
    <p>Lead roadmap and execution for cloud data protection.</p>
    <h3>Experience you'll need:</h3>
    <ul>
      <li>8+ years of product management experience</li>
      <li>Cloud security experience</li>
    </ul>
    <h3>Why Join Us?</h3>
  </body>
</html>
`

test('Rubrik validates the verified official careers page and extracts department/job links', async () => {
  const rubrik = await loadRubrikModule()
  assert.ok(rubrik, 'Expected Rubrik scraper module at ./script.js')

  assert.equal(rubrik.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(
    rubrik.extractDepartmentLinks(careersHtml),
    [
      { name: 'People', url: 'https://www.rubrik.com/company/careers/departments/people' },
      { name: 'Product', url: 'https://www.rubrik.com/company/careers/departments/product' },
    ],
  )
  assert.deepEqual(
    rubrik.extractJobLinks(peopleDepartmentHtml),
    [
      { title: 'Senior People Partner - APAC', url: 'https://www.rubrik.com/company/careers/departments/job.2333116' },
      { title: 'Senior People Partner, GTM', url: 'https://www.rubrik.com/company/careers/departments/job.5555555' },
    ],
  )
})

test('Rubrik accepts the current careers page shape when department links remain but the old hero copy is gone', async () => {
  const rubrik = await loadRubrikModule()
  assert.ok(rubrik, 'Expected Rubrik scraper module at ./script.js')

  assert.equal(rubrik.hasOfficialCareersSignal(careersHtmlWithoutTogetherCopy), true)
  assert.deepEqual(
    rubrik.extractDepartmentLinks(careersHtmlWithoutTogetherCopy),
    [
      { name: 'People', url: 'https://www.rubrik.com/company/careers/departments/people' },
      { name: 'Product', url: 'https://www.rubrik.com/company/careers/departments/product' },
    ],
  )
})

test('Rubrik normalizes an India job detail page into a job record', async () => {
  const rubrik = await loadRubrikModule()
  assert.ok(rubrik, 'Expected Rubrik scraper module at ./script.js')

  assert.deepEqual(
    rubrik.extractJobFromHtml({
      html: peopleIndiaJobHtml,
      department: 'People',
      jobUrl: 'https://www.rubrik.com/company/careers/departments/job.2333116',
      now: () => '2026-08-08T17:45:00.000Z',
    }),
    {
      jobId: '2333116',
      title: 'Senior People Partner - APAC',
      company: 'Rubrik',
      department: 'People',
      location: 'Bangalore, India Office',
      city: 'Bangalore',
      country: 'India',
      sourceUrl: 'https://www.rubrik.com/company/careers/departments/job.2333116',
      applyUrl: 'https://www.rubrik.com/company/careers/departments/job.2333116',
      employmentType: null,
      experienceRequired: '10+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        '10+ years of HRBP experience',
        'Experience with India employment law',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Partner with APAC leaders and drive people strategy.',
      remoteStatus: 'On-site',
      source: 'rubrik',
      link: 'https://www.rubrik.com/company/careers/departments/job.2333116',
      scrapedAt: '2026-08-08T17:45:00.000Z',
    },
  )
})

test('Rubrik runs through first-party browser-free HTML surfaces and keeps only India jobs', async () => {
  const rubrik = await loadRubrikModule()
  assert.ok(rubrik, 'Expected Rubrik scraper module at ./script.js')

  const requests = []

  const jobs = await rubrik.createRubrikScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === rubrik.CAREERS_URL) return careersHtml
      if (url === 'https://www.rubrik.com/company/careers/departments/people') return peopleDepartmentHtml
      if (url === 'https://www.rubrik.com/company/careers/departments/product') return productDepartmentHtml
      if (url === 'https://www.rubrik.com/company/careers/departments/job.2333116') return peopleIndiaJobHtml
      if (url === 'https://www.rubrik.com/company/careers/departments/job.5555555') return peopleUsJobHtml
      if (url === 'https://www.rubrik.com/company/careers/departments/job.7540806') return productIndiaJobHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-08T17:45:00.000Z',
  })

  assert.deepEqual(
    [...requests].sort(),
    [
      'https://www.rubrik.com/company/careers',
      'https://www.rubrik.com/company/careers/departments/people',
      'https://www.rubrik.com/company/careers/departments/job.2333116',
      'https://www.rubrik.com/company/careers/departments/job.5555555',
      'https://www.rubrik.com/company/careers/departments/product',
      'https://www.rubrik.com/company/careers/departments/job.7540806',
    ].sort(),
  )
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Senior People Partner - APAC',
      'Staff Product Manager, Cloud Data Protection',
    ],
  )
  assert.equal(jobs[1].department, 'Product')
  assert.deepEqual(jobs[1].requiredSkills, [
    '8+ years of product management experience',
    'Cloud security experience',
  ])
  assert.equal(jobs[1].jobDescription, 'Lead roadmap and execution for cloud data protection.')
})
