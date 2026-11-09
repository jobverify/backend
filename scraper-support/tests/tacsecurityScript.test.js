import assert from 'node:assert/strict'
import test from 'node:test'

const loadTacSecurityModule = async () => {
  try {
    return await import('../../scraper/tacsecurity/script.js')
  } catch {
    assert.fail('Expected TAC Security scraper module at ../../scraper/tacsecurity/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | TAC Security</title>
  </head>
  <body>
    <main>
      <h1>We’re adding to our team of talented, passionate people who want to shape the future of product design tools.</h1>
      <h2>Open Positions</h2>
      <h2>Cyber Security Engineer</h2>
      <p>Chandigarh/ Pune, India</p>
      <h2>Business Analyst</h2>
      <p>Pune, India</p>
      <h2>Corporate Communication Manager</h2>
      <p>New York/USA</p>
      <h2>Channel Sales Manager</h2>
      <p>Mumbai/India</p>
      <h2>Talent Acquisition Specialist</h2>
      <p>Pune/India</p>
      <h2>Web Developer</h2>
      <p>Pune/India</p>
      <h2>PHP Developer</h2>
      <p>Pune/India</p>
      <h2>Sales Director</h2>
      <p>San Francisco/USA</p>
      <h2>Technical PreSales Manager</h2>
      <p>Mumbai/India</p>
      <h2>Product Manager</h2>
      <p>Mumbai/ Pune, India</p>
      <h2>Product Marketing Manager</h2>
      <p>Pune/India</p>
      <h2>Channel Sales Manager – USA</h2>
      <p>San Francisco – (Remote)</p>
      <h2>Key Account Manager</h2>
      <p>Pune/India</p>
      <h2>Channel Sales Manager – ANZ</h2>
      <p>Australia/India – (Remote)</p>
      <h2>Product Engineer</h2>
      <p>Chandigarh/India – (Remote)</p>
      <h2>Channel Sales Manager – APJ</h2>
      <p>Singapore/India – (Remote)</p>
      <h2>Machine Learning Engineer</h2>
      <p>Bangalore, India</p>
      <h2>About TAC.</h2>
      <p>TAC Security is a global pioneer in risk and vulnerability management.</p>
    </main>
  </body>
</html>
`

test('extractOpenPositions keeps only India-linked TAC Security roles from the verified official careers surface', async () => {
  const tacsecurity = await loadTacSecurityModule()

  assert.equal(tacsecurity.CAREERS_URL, 'https://tacsecurity.com/careers/')
  assert.equal(tacsecurity.hasOfficialCareersSurface(careersHtml), true)

  const jobs = tacsecurity.extractOpenPositions(careersHtml)

  assert.equal(jobs.length, 14)
  assert.deepEqual(jobs[0], {
    title: 'Cyber Security Engineer',
    company: 'TAC Security',
    department: null,
    location: 'Chandigarh/ Pune, India',
    city: 'Chandigarh',
    country: 'India',
    jobId: 'tacsecurity-cyber-security-engineer',
    requisitionId: 'tacsecurity-cyber-security-engineer',
    sourceUrl: 'https://tacsecurity.com/careers/',
    applyUrl: 'https://tacsecurity.com/careers/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Official TAC Security careers page opening listed at Chandigarh/ Pune, India.',
  })

  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Cyber Security Engineer',
      'Business Analyst',
      'Channel Sales Manager',
      'Talent Acquisition Specialist',
      'Web Developer',
      'PHP Developer',
      'Technical PreSales Manager',
      'Product Manager',
      'Product Marketing Manager',
      'Key Account Manager',
      'Channel Sales Manager – ANZ',
      'Product Engineer',
      'Channel Sales Manager – APJ',
      'Machine Learning Engineer',
    ],
  )
  assert.equal(jobs.find((job) => job.title === 'Channel Sales Manager – ANZ')?.city, null)
  assert.equal(jobs.find((job) => job.title === 'Product Engineer')?.city, 'Chandigarh')
  assert.equal(jobs.find((job) => job.title === 'Machine Learning Engineer')?.city, 'Bangalore')
})

test('run fetches the TAC Security careers page and decorates the extracted jobs with runner metadata', async () => {
  const tacsecurity = await loadTacSecurityModule()
  const requestedUrls = []

  const jobs = await tacsecurity.createTacSecurityScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://tacsecurity.com/careers/'])
  assert.equal(jobs.length, 14)
  assert.equal(jobs[0].source, 'tacsecurity')
  assert.equal(jobs[0].link, 'https://tacsecurity.com/careers/')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
