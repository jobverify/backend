import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career</title>
  </head>
  <body>
    <h2>Experience a workplace where Innovation meets Passion!</h2>
    <p>Innovapptive is a pioneer in connected worker solutions, delivering AI-powered, mobile-first tools.</p>
    <p>Email Us : info@innovapptive.com</p>
    <footer>© 2026 Innovapptive. All Rights Reserved.</footer>
  </body>
</html>
`

const boardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Innovapptive - Career Page</title>
    <meta property="og:description" content="Explore open job opportunities at Innovapptive.">
  </head>
  <body>
    <a href="/learn-more">View Our Website</a>
    <h2>Current Openings</h2>
    <ul>
      <li class="list-group-item">
        <h3><a href="/apply/vUAKsHV9hX/Program-Manager">Program Manager</a></h3>
        <div>Remote</div>
        <div>Professional Services</div>
      </li>
      <li class="list-group-item">
        <h3><a href="/apply/s1UhWrT4FC/Associate-Solution-Consultant-EAM">Associate Solution Consultant - EAM</a></h3>
        <div>Hyderabad, Telangana, India</div>
        <div>Professional Services</div>
      </li>
      <li class="list-group-item">
        <h3><a href="/apply/DJaFt2RfVX/Senior-Engineer-IOS">Senior Engineer - iOS</a></h3>
        <div>Hyderabad, Telangana, India</div>
        <div>Products & Innovation</div>
      </li>
    </ul>
  </body>
</html>
`

const remoteAustraliaDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Program Manager - Innovapptive - Career Page</title>
  </head>
  <body>
    <h2>Program Manager</h2>
    <div>Remote</div>
    <div>Full Time</div>
    <div>Professional Services</div>
    <p>Location: Remote Australia</p>
    <p>Employment Type: Full-Time; Salaried</p>
  </body>
</html>
`

const associateDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Associate Solution Consultant - EAM - Innovapptive - Career Page</title>
  </head>
  <body>
    <h2>Associate Solution Consultant - EAM</h2>
    <div>Hyderabad, Telangana, India</div>
    <div>Full Time</div>
    <div>Professional Services</div>
    <p>Location: Hyderabad, India</p>
    <p>Employment Type: Full-Time; Salaried</p>
    <p>The Opportunity</p>
    <p>Provide structured support to Solution Consultants in requirement gathering, workshops, and solution design activities.</p>
  </body>
</html>
`

const seniorIosDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Senior Engineer - iOS - Innovapptive - Career Page</title>
  </head>
  <body>
    <h2>Senior Engineer - iOS</h2>
    <div>Hyderabad, Telangana, India</div>
    <div>Full Time</div>
    <div>Products & Innovation</div>
    <p>Location: Hyderabad, India</p>
    <p>Employment Type: Full-Time; Salaried</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/innovapptive/script.js')
  } catch {
    assert.fail('Expected Innovapptive scraper module at ../../scraper/innovapptive/script.js')
  }
}

test('Innovapptive helpers stay pinned to the verified careers handoff and mixed-region ApplyToJob board from Sunday, August 2, 2026', async () => {
  const innovapptive = await loadModule()

  assert.equal(innovapptive.SOURCE, 'innovapptive')
  assert.equal(innovapptive.COMPANY, 'Innovapptive')
  assert.equal(innovapptive.CAREERS_URL, 'https://www.innovapptive.com/company/careers')
  assert.equal(innovapptive.BOARD_URL, 'https://innovapptive.applytojob.com/apply')
  assert.equal(innovapptive.VERIFIED_ON, '2026-08-02')
  assert.equal(innovapptive.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(innovapptive.hasOfficialCareersSignal('<main>Careers</main>'), false)
  assert.equal(innovapptive.hasVerifiedBoardSignal(boardHtml), true)
  assert.equal(innovapptive.hasVerifiedBoardSignal('<main>No board</main>'), false)
  assert.deepEqual(innovapptive.extractBoardJobs(boardHtml), [
    {
      title: 'Program Manager',
      company: 'Innovapptive',
      department: 'Professional Services',
      location: 'Remote',
      city: null,
      country: null,
      jobId: 'vUAKsHV9hX',
      requisitionId: 'vUAKsHV9hX',
      sourceUrl: 'https://innovapptive.applytojob.com/apply/vUAKsHV9hX/Program-Manager',
      applyUrl: 'https://innovapptive.applytojob.com/apply/vUAKsHV9hX/Program-Manager',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Remote',
    },
    {
      title: 'Associate Solution Consultant - EAM',
      company: 'Innovapptive',
      department: 'Professional Services',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: 's1UhWrT4FC',
      requisitionId: 's1UhWrT4FC',
      sourceUrl: 'https://innovapptive.applytojob.com/apply/s1UhWrT4FC/Associate-Solution-Consultant-EAM',
      applyUrl: 'https://innovapptive.applytojob.com/apply/s1UhWrT4FC/Associate-Solution-Consultant-EAM',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Senior Engineer - iOS',
      company: 'Innovapptive',
      department: 'Products & Innovation',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: 'DJaFt2RfVX',
      requisitionId: 'DJaFt2RfVX',
      sourceUrl: 'https://innovapptive.applytojob.com/apply/DJaFt2RfVX/Senior-Engineer-IOS',
      applyUrl: 'https://innovapptive.applytojob.com/apply/DJaFt2RfVX/Senior-Engineer-IOS',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])

  assert.deepEqual(innovapptive.extractJobDetailFields(remoteAustraliaDetailHtml), {
    location: 'Remote Australia',
    employmentType: 'Full-Time; Salaried',
    jobDescription: null,
  })

  assert.equal(innovapptive.extractJobDetailFields(associateDetailHtml).location, 'Hyderabad, India')
  assert.equal(innovapptive.extractJobDetailFields(associateDetailHtml).employmentType, 'Full-Time; Salaried')
  assert.match(
    innovapptive.extractJobDetailFields(associateDetailHtml).jobDescription ?? '',
    /Provide structured support to Solution Consultants/i,
  )
})

test('Innovapptive run validates both verified surfaces, checks detail pages, and skips non-India remote roles', async () => {
  const innovapptive = await loadModule()
  const requestedUrls = []

  const jobs = await innovapptive.createInnovapptiveScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === innovapptive.CAREERS_URL) return officialCareersHtml
      if (url === innovapptive.BOARD_URL) return boardHtml
      if (url === 'https://innovapptive.applytojob.com/apply/vUAKsHV9hX/Program-Manager') return remoteAustraliaDetailHtml
      if (url === 'https://innovapptive.applytojob.com/apply/s1UhWrT4FC/Associate-Solution-Consultant-EAM') return associateDetailHtml
      if (url === 'https://innovapptive.applytojob.com/apply/DJaFt2RfVX/Senior-Engineer-IOS') return seniorIosDetailHtml
      throw new Error(`Unexpected Innovapptive URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    innovapptive.CAREERS_URL,
    innovapptive.BOARD_URL,
    'https://innovapptive.applytojob.com/apply/vUAKsHV9hX/Program-Manager',
    'https://innovapptive.applytojob.com/apply/s1UhWrT4FC/Associate-Solution-Consultant-EAM',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'innovapptive')
  assert.equal(
    jobs[0].link,
    'https://innovapptive.applytojob.com/apply/s1UhWrT4FC/Associate-Solution-Consultant-EAM',
  )
  assert.equal(jobs[0].location, 'Hyderabad, India')
  assert.equal(jobs[0].employmentType, 'Full-Time; Salaried')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Innovapptive run fails closed when the verified official page or board drifts', async () => {
  const innovapptive = await loadModule()

  await assert.rejects(
    innovapptive.createInnovapptiveScraper().run({
      fetchText: async (url) => (url === innovapptive.CAREERS_URL ? '<html><body>Careers</body></html>' : boardHtml),
    }),
    /official Innovapptive careers page/i,
  )

  await assert.rejects(
    innovapptive.createInnovapptiveScraper().run({
      fetchText: async (url) => (url === innovapptive.CAREERS_URL ? officialCareersHtml : '<html><body>Jobs</body></html>'),
    }),
    /verified Innovapptive ApplyToJob board/i,
  )
})
