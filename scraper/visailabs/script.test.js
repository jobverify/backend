import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Edge AI and Computer Vision Product Development Experts- Home</title>
  </head>
  <body>
    <main>
      <a href="https://visailabs.com/careers/">Careers</a>
      <a href="https://hrmax.myadrenalin.com/CandidateMAX/">Emp Login</a>
      <h1>Building Physical AI Solutions with Advanced Computer Vision</h1>
      <p>Envision the next-gen AI tech with us!</p>
      <p>Join VisAI Labs.</p>
      <a href="https://visailabs.com/careers/">Apply Now!</a>
      <section>
        <h2>Who we are</h2>
        <p>VisAI Labs, founded in 2018, provides AI-enabled computer vision solutions for real-world industry operations.</p>
      </section>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Enriching every vision sensor with actionable insights</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Build the next-gen tech with us!</p>
      <h2>Positions and Eligibility:</h2>

      <section class="career-opening">
        <h3>JOB ID: VisAI- 001</h3>
        <p>Position: Computer Vision Engineer Trainee</p>
        <p>Location: Chennai</p>
        <p>Experience: Freshers</p>
        <p>Education Qualification: B.E/B.Tech: EEE, ECE, CS, IT; B.Sc./BCA/M.Sc./MCA: Computer science or equivalent field.</p>
        <h4>Skillsets:</h4>
        <ul>
          <li>Programming Knowledge in C and C++ Language</li>
          <li>Good Knowledge in OpenCV</li>
          <li>Excellent Problem-solving and Analysing skills</li>
          <li>Knowledge in Data structures and Algorithms</li>
          <li>Knowledge in Image Processing concepts</li>
          <li>Must be an independent role player</li>
          <li>Willingness to work in a small multi-disciplinary team</li>
          <li>Work in a team to accomplish a goal</li>
        </ul>
        <a href="https://hrmax.myadrenalin.com/CandidateMAX/">Apply Now</a>
      </section>

      <section class="career-opening">
        <h3>JOB ID: VisAI- 002</h3>
        <p>Position: QA Analyst Trainee</p>
        <p>Location: Chennai</p>
        <p>Experience: Freshers</p>
        <p>Education Qualification: B.E/B.Tech: EEE, ECE, CS, IT; B.Sc/BCA/M.Sc/MCA: Computer science or equivalent field</p>
        <h4>Skillsets:</h4>
        <ul>
          <li>Knowledge in Agile methodology.</li>
          <li>Excellent communication skills.</li>
          <li>Knowledge in Security Testing and JMeter</li>
          <li>knowledge in writing Test case and Test scenario</li>
          <li>Knowledge in Automation (Selenium with java cucumber framework).</li>
          <li>knowledge in Web applications, API, and Mobile Testing</li>
          <li>Must be an independent role player</li>
          <li>Willingness to work in a small multi-disciplinary team</li>
        </ul>
        <a href="https://hrmax.myadrenalin.com/CandidateMAX/">Apply Now</a>
      </section>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact - Visai Labs</title>
  </head>
  <body>
    <main>
      <h2>Get in touch</h2>
      <p>VisAI Labs is the premier edge AI and computer vision product development firm.</p>
      <h3>Development Centre:</h3>
      <p>Unit 55 and 56, SDF-1, MEPZ SEZ, Tambaram, Chennai - 600 045, India</p>
      <h3>For Enquiries:</h3>
      <p>Career Opportunities: careers@visailabs.com</p>
      <p>Product: sales@visailabs.com</p>
    </main>
  </body>
</html>
`

test('VisAI Labs validates the verified homepage, careers page, and contact page and extracts first-party role sections', async () => {
  const visai = await loadModule()
  assert.ok(visai, 'VisAI Labs scraper module should load')

  assert.equal(visai.SOURCE, 'visailabs')
  assert.equal(visai.COMPANY, 'VisAI Labs')
  assert.equal(visai.HOMEPAGE_URL, 'https://visailabs.com/')
  assert.equal(visai.CAREERS_URL, 'https://visailabs.com/careers/')
  assert.equal(visai.CONTACT_URL, 'https://visailabs.com/contact/')
  assert.equal(visai.APPLY_URL, 'https://hrmax.myadrenalin.com/CandidateMAX/')
  assert.equal(visai.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(visai.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(visai.hasOfficialContactSignal(contactHtml), true)

  assert.deepEqual(visai.extractOpenings(careersHtml), [
    {
      title: 'Computer Vision Engineer Trainee',
      company: 'VisAI Labs',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'VisAI-001',
      requisitionId: 'VisAI-001',
      sourceUrl: 'https://visailabs.com/careers/',
      applyUrl: 'https://hrmax.myadrenalin.com/CandidateMAX/',
      employmentType: null,
      experienceRequired: 'Freshers',
      minimumQualification: 'B.E/B.Tech: EEE, ECE, CS, IT; B.Sc./BCA/M.Sc./MCA: Computer science or equivalent field.',
      preferredQualification: null,
      requiredSkills: [
        'Programming Knowledge in C and C++ Language',
        'Good Knowledge in OpenCV',
        'Excellent Problem-solving and Analysing skills',
        'Knowledge in Data structures and Algorithms',
        'Knowledge in Image Processing concepts',
        'Must be an independent role player',
        'Willingness to work in a small multi-disciplinary team',
        'Work in a team to accomplish a goal',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Location: Chennai | Experience: Freshers | Education Qualification: B.E/B.Tech: EEE, ECE, CS, IT; B.Sc./BCA/M.Sc./MCA: Computer science or equivalent field.',
    },
    {
      title: 'QA Analyst Trainee',
      company: 'VisAI Labs',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'VisAI-002',
      requisitionId: 'VisAI-002',
      sourceUrl: 'https://visailabs.com/careers/',
      applyUrl: 'https://hrmax.myadrenalin.com/CandidateMAX/',
      employmentType: null,
      experienceRequired: 'Freshers',
      minimumQualification: 'B.E/B.Tech: EEE, ECE, CS, IT; B.Sc/BCA/M.Sc/MCA: Computer science or equivalent field',
      preferredQualification: null,
      requiredSkills: [
        'Knowledge in Agile methodology.',
        'Excellent communication skills.',
        'Knowledge in Security Testing and JMeter',
        'knowledge in writing Test case and Test scenario',
        'Knowledge in Automation (Selenium with java cucumber framework).',
        'knowledge in Web applications, API, and Mobile Testing',
        'Must be an independent role player',
        'Willingness to work in a small multi-disciplinary team',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Location: Chennai | Experience: Freshers | Education Qualification: B.E/B.Tech: EEE, ECE, CS, IT; B.Sc/BCA/M.Sc/MCA: Computer science or equivalent field',
    },
  ])
})

test('VisAI Labs run validates the official first-party surfaces before returning decorated openings', async () => {
  const visai = await loadModule()
  assert.ok(visai, 'VisAI Labs scraper module should load')

  const requestedUrls = []
  const jobs = await visai.createVisAiLabsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === visai.HOMEPAGE_URL) return homepageHtml
      if (url === visai.CAREERS_URL) return careersHtml
      if (url === visai.CONTACT_URL) return contactHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-12T10:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://visailabs.com/',
    'https://visailabs.com/careers/',
    'https://visailabs.com/contact/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'visailabs')
  assert.equal(jobs[0].link, 'https://hrmax.myadrenalin.com/CandidateMAX/')
  assert.equal(jobs[0].scrapedAt, '2026-07-12T10:00:00.000Z')
})

test('VisAI Labs fails closed when the homepage, careers page, or contact page changes materially', async () => {
  const visai = await loadModule()
  assert.ok(visai, 'VisAI Labs scraper module should load')

  await assert.rejects(
    visai.createVisAiLabsScraper().run({
      fetchText: async (url) => {
        if (url === visai.HOMEPAGE_URL) return '<html><body><h1>Placeholder</h1></body></html>'
        if (url === visai.CAREERS_URL) return careersHtml
        if (url === visai.CONTACT_URL) return contactHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    visai.createVisAiLabsScraper().run({
      fetchText: async (url) => {
        if (url === visai.HOMEPAGE_URL) return homepageHtml
        if (url === visai.CAREERS_URL) return '<html><body><h1>Careers</h1></body></html>'
        if (url === visai.CONTACT_URL) return contactHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page/i,
  )

  await assert.rejects(
    visai.createVisAiLabsScraper().run({
      fetchText: async (url) => {
        if (url === visai.HOMEPAGE_URL) return homepageHtml
        if (url === visai.CAREERS_URL) return careersHtml
        if (url === visai.CONTACT_URL) return '<html><body><h2>Contact</h2></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /contact page/i,
  )
})
