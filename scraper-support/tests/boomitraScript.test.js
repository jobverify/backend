import assert from 'node:assert/strict'
import test from 'node:test'

const loadBoomitra = async () => import('../../scraper/boomitra/script.js')

const careersHtml = `
<!doctype html>
<html><head>
  <title>Boomitra</title>
  <link rel="canonical" href="https://boomitra.com/careers/" />
</head><body>
  <h1>Careers at Boomitra</h1>
  <p>See job openings</p>
  <p>Explore our open roles</p>
  <h2>Full Stack Developer (Bangalore, India)</h2>
  <a href="https://boomitra.com/wp-content/uploads/2025/04/Full-Stack-Developer.pdf">Learn more and apply</a>
  <p>To apply, email careers@boomitra.com</p>
</body></html>`

test('Boomitra maps the exact verified first-party role', async () => {
  const boomitra = await loadBoomitra()
  assert.equal(boomitra.hasVerifiedCareersPageSignal(careersHtml), true)
  assert.deepEqual(boomitra.extractSearchResults(careersHtml)[0], {
    title: 'Full Stack Developer',
    company: 'Boomitra',
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    state: null,
    country: 'India',
    jobId: 'full-stack-developer-2025-04',
    requisitionId: null,
    sourceUrl: boomitra.ROLE_URL,
    applyUrl: 'mailto:careers@boomitra.com',
    employmentType: null,
    experienceRequired: '2-4 years',
    minimumQualification: "Bachelor's or Master's Degree in Computer Science or Engineering",
    preferredQualification: null,
    requiredSkills: ['Node.js', 'Express.js', 'JavaScript', 'TypeScript', 'React.js', 'Next.js'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Full Stack Developer (Bangalore, India) Learn more and apply To apply, email careers@boomitra.com',
  })
})

test('Boomitra fails closed when the exact first-party surface drifts', async () => {
  const boomitra = await loadBoomitra()
  await assert.rejects(
    boomitra.createBoomitraScraper().run({ fetchText: async () => careersHtml.replace('Boomitra', 'Different Company') }),
    /verified first-party careers page/i,
  )
  assert.equal(
    boomitra.hasVerifiedCareersPageSignal(careersHtml.replace('Full Stack Developer', 'Product Manager')),
    false,
  )
})
