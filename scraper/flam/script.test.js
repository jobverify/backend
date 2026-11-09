import assert from 'node:assert/strict'
import test from 'node:test'

const loadFlamModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected FLAM scraper module at ./script.js')
  }
}

const listingsHtml = `
<!doctype html>
<html>
  <body>
    <h1>Join us in revolutionizing the world of AI !</h1>
    <h4>Open Roles</h4>
    <a href="/careers/listing/IT-Systems-Network-Engineer">
      <span>Technology</span>
      <span>IT Systems &amp; Network Engineer</span>
      <span>Bengaluru</span>
      <span>Apply</span>
    </a>
    <a href="/careers/listing/Chief-of-Staff">
      <span>Founders Office</span>
      <span>Chief of Staff</span>
      <span>San Francisco</span>
      <span>Apply</span>
    </a>
    <a href="/careers/listing/Manager-Advertising-Sales">
      <span>India Sales</span>
      <span>Manager - Advertising Sales</span>
      <span>Bengaluru, Mumbai, New Delhi</span>
      <span>Apply</span>
    </a>
  </body>
</html>
`

const itSystemsDetailHtml = `
<!doctype html>
<html>
  <body>
    <h3>IT Systems &amp; Network Engineer</h3>
    <p>Flam is building AI Infrastructure for Brands in Immersive Advertising.</p>
    <p>Job Summary:</p>
    <p>Own enterprise IT, identity, and endpoint operations.</p>
    <p>Qualifications:</p>
    <ul>
      <li>Bachelor's degree in Computer Science or a related field.</li>
      <li>5+ years of experience managing enterprise IT.</li>
    </ul>
    <p>Skills:</p>
    <ul>
      <li>Okta</li>
      <li>Jamf</li>
      <li>Google Workspace</li>
    </ul>
    <p>Preferred Skills:</p>
    <ul>
      <li>Startup experience</li>
      <li>Zero trust networking</li>
    </ul>
    <ul>
      <li>Technology</li>
      <li>Bengaluru</li>
    </ul>
    <a href="https://forms.gle/flam-it-systems">Apply Now</a>
  </body>
</html>
`

const indiaSalesDetailHtml = `
<!doctype html>
<html>
  <body>
    <h3>Manager - Advertising Sales</h3>
    <p>Flam builds AI-native content for brands and enterprises.</p>
    <p>Responsibilities:</p>
    <ul>
      <li>Own regional revenue growth across India.</li>
      <li>Partner with agencies and enterprise brands.</li>
    </ul>
    <p>Qualifications:</p>
    <ul>
      <li>6+ years in advertising sales.</li>
    </ul>
    <ul>
      <li>India Sales</li>
      <li>Bengaluru, Mumbai, New Delhi</li>
    </ul>
    <a href="https://forms.gle/flam-sales">Apply Now</a>
  </body>
</html>
`

test('extractRoleCards parses first-party FLAM listings and keeps location-rich role metadata', async () => {
  const flam = await loadFlamModule()

  assert.equal(flam.SOURCE, 'flam')
  assert.equal(flam.COMPANY, 'FLAM')
  assert.equal(flam.CAREERS_URL, 'https://flamapp.ai/careers')
  assert.equal(flam.SEARCH_URL, 'https://flamapp.ai/careers/search')

  const roles = flam.extractRoleCards(listingsHtml)

  assert.deepEqual(roles, [
    {
      department: 'Technology',
      title: 'IT Systems & Network Engineer',
      location: 'Bengaluru',
      detailPath: '/careers/listing/IT-Systems-Network-Engineer',
      detailUrl: 'https://flamapp.ai/careers/listing/IT-Systems-Network-Engineer',
      jobId: 'IT-Systems-Network-Engineer',
    },
    {
      department: 'Founders Office',
      title: 'Chief of Staff',
      location: 'San Francisco',
      detailPath: '/careers/listing/Chief-of-Staff',
      detailUrl: 'https://flamapp.ai/careers/listing/Chief-of-Staff',
      jobId: 'Chief-of-Staff',
    },
    {
      department: 'India Sales',
      title: 'Manager - Advertising Sales',
      location: 'Bengaluru, Mumbai, New Delhi',
      detailPath: '/careers/listing/Manager-Advertising-Sales',
      detailUrl: 'https://flamapp.ai/careers/listing/Manager-Advertising-Sales',
      jobId: 'Manager-Advertising-Sales',
    },
  ])
})

test('extractJobDetail parses FLAM job detail pages including apply link, qualifications, skills, and description', async () => {
  const flam = await loadFlamModule()

  const detail = flam.extractJobDetail(itSystemsDetailHtml, {
    detailUrl: 'https://flamapp.ai/careers/listing/IT-Systems-Network-Engineer',
    title: 'IT Systems & Network Engineer',
    department: 'Technology',
    location: 'Bengaluru',
    jobId: 'IT-Systems-Network-Engineer',
  })

  assert.deepEqual(detail, {
    title: 'IT Systems & Network Engineer',
    company: 'FLAM',
    department: 'Technology',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'IT-Systems-Network-Engineer',
    requisitionId: 'IT-Systems-Network-Engineer',
    sourceUrl: 'https://flamapp.ai/careers/listing/IT-Systems-Network-Engineer',
    applyUrl: 'https://forms.gle/flam-it-systems',
    employmentType: null,
    experienceRequired: '5+ years of experience managing enterprise IT.',
    minimumQualification: "Bachelor's degree in Computer Science or a related field.",
    preferredQualification: 'Startup experience Zero trust networking',
    requiredSkills: [
      'Okta',
      'Jamf',
      'Google Workspace',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: "Flam is building AI Infrastructure for Brands in Immersive Advertising. Job Summary: Own enterprise IT, identity, and endpoint operations. Qualifications: Bachelor's degree in Computer Science or a related field. 5+ years of experience managing enterprise IT. Skills: Okta Jamf Google Workspace Preferred Skills: Startup experience Zero trust networking Technology Bengaluru Apply Now",
    remoteStatus: 'On-site',
  })
})

test('run follows the FLAM first-party listings surface, filters to India roles, and decorates output', async () => {
  const flam = await loadFlamModule()
  const requestedUrls = []

  const jobs = await flam.createFlamScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === flam.SEARCH_URL) {
        return listingsHtml
      }

      if (url === 'https://flamapp.ai/careers/listing/IT-Systems-Network-Engineer') {
        return itSystemsDetailHtml
      }

      if (url === 'https://flamapp.ai/careers/listing/Manager-Advertising-Sales') {
        return indiaSalesDetailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    flam.SEARCH_URL,
    'https://flamapp.ai/careers/listing/IT-Systems-Network-Engineer',
    'https://flamapp.ai/careers/listing/Manager-Advertising-Sales',
  ])

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'flam')
  assert.equal(jobs[0].link, 'https://forms.gle/flam-it-systems')
  assert.equal(jobs[0].company, 'FLAM')
  assert.equal(jobs[1].city, 'Bengaluru')
  assert.equal(jobs[1].location, 'Bengaluru, Mumbai, New Delhi, India')
  assert.equal(jobs[1].applyUrl, 'https://forms.gle/flam-sales')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
