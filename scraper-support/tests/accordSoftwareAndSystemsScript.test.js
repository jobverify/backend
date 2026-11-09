import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T12:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore Career Opportunities | Accord Software & Systems Pvt Ltd</title>
  </head>
  <body>
    <main>
      <h1>Careers at Accord</h1>
      <p>Creating cutting-edge technology is a way of life at Accord.</p>

      <section class="opening">
        <h2>Lead Production Engineer</h2>
        <p>Full Time - Lead Production Engineer</p>
        <h5>Education Qualification</h5>
        <p>BE/B.Tech - EEE / ECE</p>
        <h5>Years of experience</h5>
        <p>9 - 11 Years</p>
        <h5>Work Location</h5>
        <p>Bangalore</p>
        <h5>No. of Position</h5>
        <p>1</p>
        <h5>Key skills/JD</h5>
        <ul>
          <li>Electronics manufacturing and PCB assembly experience.</li>
          <li>Develop and manage comprehensive production schedules.</li>
          <li>Collaborate with cross-functional teams for seamless execution.</li>
        </ul>
        <a href="https://www.accord-soft.com/career-form.php">Apply Now</a>
      </section>

      <section class="opening">
        <h2>Systems Engineer FPGA</h2>
        <p>Full Time - Systems Engineer FPGA</p>
        <h5>Education Qualification</h5>
        <p>BE/B.Tech - EEE / ECE</p>
        <h5>Years of experience</h5>
        <p>2 - 3 Years</p>
        <h5>Work Location</h5>
        <p>Bangalore</p>
        <h5>No. of Position</h5>
        <p>1</p>
        <h5>Key skills/JD</h5>
        <ul>
          <li>FPGA Development using VHDL or Verilog.</li>
          <li>Signal Processing for DSP blocks such as FIR/IIR filters.</li>
          <li>Hardware bring-up with oscilloscopes and logic analyzers.</li>
        </ul>
        <a href="https://www.accord-soft.com/career-form.php">Apply Now</a>
      </section>
    </main>
  </body>
</html>
`

const currentCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore Career Opportunities | Accord Software &amp; Systems Pvt Ltd</title>
    <meta name="description" content="Discover rewarding careers at Accord Soft. Join a dynamic team of experts and grow your skills in cutting-edge technology solutions." />
  </head>
  <body>
    <p>Full Time - Embedded Software Engineer</p>
    <p>Full Time - Systems Engineer FPGA</p>
    <a href="career-form.php">Apply Now</a>
  </body>
</html>
`

const applyFormHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Join Us</h1>
      <h3>Submit Your Resume</h3>
      <p>Accord Software & Systems Pvt Ltd</p>
      <p>resumes@accord-soft.com</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/accordsoftwaresystems/script.js')
  } catch {
    assert.fail('Expected Accord Software & Systems scraper module at ../../scraper/accordsoftwaresystems/script.js')
  }
}

test('Accord Software & Systems helpers stay pinned to the verified first-party careers page contract', async () => {
  const accord = await loadModule()

  assert.equal(accord.SOURCE, 'accordsoftwaresystems')
  assert.equal(accord.COMPANY, 'Accord Software & Systems')
  assert.equal(accord.CAREERS_URL, 'https://www.accord-soft.com/career.php')
  assert.equal(accord.APPLY_FORM_URL, 'https://www.accord-soft.com/career-form.php')
  assert.equal(accord.VERIFIED_ON, '2026-09-03')
  assert.equal(accord.normalizeAccordLocation('Banagalore'), 'Bangalore')
  assert.equal(accord.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(accord.hasOfficialCareersSignal(currentCareersPageHtml), true)
  assert.equal(accord.hasOfficialApplyFormSignal(applyFormHtml), true)
  assert.deepEqual(
    accord.extractJobCards(careersPageHtml),
    [
      {
        title: 'Lead Production Engineer',
        employmentType: 'Full Time',
        educationQualification: 'BE/B.Tech - EEE / ECE',
        experienceRequired: '9 - 11 Years',
        location: 'Bangalore',
        openings: '1',
        applyUrl: 'https://www.accord-soft.com/career-form.php',
        keySkills: [
          'Electronics manufacturing and PCB assembly experience.',
          'Develop and manage comprehensive production schedules.',
          'Collaborate with cross-functional teams for seamless execution.',
        ],
      },
      {
        title: 'Systems Engineer FPGA',
        employmentType: 'Full Time',
        educationQualification: 'BE/B.Tech - EEE / ECE',
        experienceRequired: '2 - 3 Years',
        location: 'Bangalore',
        openings: '1',
        applyUrl: 'https://www.accord-soft.com/career-form.php',
        keySkills: [
          'FPGA Development using VHDL or Verilog.',
          'Signal Processing for DSP blocks such as FIR/IIR filters.',
          'Hardware bring-up with oscilloscopes and logic analyzers.',
        ],
      },
    ],
  )
})

test('Accord Software & Systems run validates the careers page and returns normalized jobs', async () => {
  const accord = await loadModule()
  const requestedUrls = []

  const jobs = await accord.createAccordSoftwareAndSystemsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === accord.CAREERS_URL) return careersPageHtml
      if (url === accord.APPLY_FORM_URL) return applyFormHtml
      throw new Error(`Unexpected Accord URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    accord.CAREERS_URL,
    accord.APPLY_FORM_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.jobId, job.employmentType, job.companyCareerPage, job.companyDomain, job.atsPlatform]),
    [
      [
        'Lead Production Engineer',
        'Bangalore, India',
        'lead-production-engineer-bangalore',
        'Full Time',
        'https://www.accord-soft.com/career.php',
        'accord-soft.com',
        'official-company-careers',
      ],
      [
        'Systems Engineer FPGA',
        'Bangalore, India',
        'systems-engineer-fpga-bangalore',
        'Full Time',
        'https://www.accord-soft.com/career.php',
        'accord-soft.com',
        'official-company-careers',
      ],
    ],
  )
})

test('Accord Software & Systems fails closed when the verified careers identity or apply form drifts', async () => {
  const accord = await loadModule()

  await assert.rejects(
    accord.createAccordSoftwareAndSystemsScraper().run({
      fetchText: async (url) => {
        if (url === accord.CAREERS_URL) return '<html><body><h1>Jobs</h1></body></html>'
        if (url === accord.APPLY_FORM_URL) return applyFormHtml
        throw new Error(`Unexpected Accord URL: ${url}`)
      },
    }),
    /verified Accord careers page/i,
  )

  await assert.rejects(
    accord.createAccordSoftwareAndSystemsScraper().run({
      fetchText: async (url) => {
        if (url === accord.CAREERS_URL) return careersPageHtml
        if (url === accord.APPLY_FORM_URL) return '<html><body>Unexpected</body></html>'
        throw new Error(`Unexpected Accord URL: ${url}`)
      },
    }),
    /verified Accord apply form/i,
  )
})
