import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Thence Digital</title>
  </head>
  <body>
    <a href="https://thence.digital/blogs">Blogs</a>
    <a href="https://thence.digital/contact-us">Contact Us</a>
    <a href="https://thence.digital/careers">Careers</a>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <h1>Solve for Change, Craft a better you.</h1>
    <a href="#section-contact-us-form">Apply Now</a>
    <form id="job-application-form">
      <select id="jaf-select_role" name="Select-role">
        <option value="-">Select role</option>
        <option value="Product Data Analyst">Product Data Analyst</option>
        <option value="UI Tester">UI Tester</option>
      </select>
      <input name="Current-CTC-LPA-INR" />
      <input id="jaf-experience" name="Relevant-years-of-experience" placeholder="Relevant years of experience" />
      <select name="How-did-you-know-about-this-opportunity">
        <option value="Linked In - Job Posting">Linked In - Job Posting</option>
        <option value="Thence Website">Thence Website</option>
      </select>
    </form>
  </body>
</html>
`

test('Thence recognizes the official homepage, careers handoff, and current role selector surface', async () => {
  const thence = await loadModule()

  assert.equal(thence.SOURCE, 'thence')
  assert.equal(thence.COMPANY, 'Thence Private Limited')
  assert.equal(thence.HOMEPAGE_URL, 'https://thence.co')
  assert.equal(thence.CAREERS_URL, 'https://thence.digital/careers')
  assert.equal(thence.APPLY_URL, 'https://thence.digital/careers#section-contact-us-form')
  assert.equal(thence.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(thence.extractCareersUrlFromHomepage(homepageHtml), thence.CAREERS_URL)
  assert.equal(thence.hasOfficialCareersSignal(careersHtml), true)
  const jobs = thence.extractOpenRoles(careersHtml)

  assert.deepEqual(jobs.map((job) => job.title), [
    'Product Data Analyst',
    'UI Tester',
  ])
  assert.equal(jobs[0].experienceRequired, null)
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
})

test('Thence run returns the public role list from the official careers page', async () => {
  const thence = await loadModule()

  const requestedUrls = []
  const jobs = await thence.createThenceScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === thence.HOMEPAGE_URL) return homepageHtml
      if (url === thence.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    thence.HOMEPAGE_URL,
    thence.CAREERS_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'thence')
  assert.equal(jobs[0].link, thence.APPLY_URL)
  assert.equal(jobs[0].experienceRequired, null)
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
})

test('Thence returns [] when its verified homepage retains only the retired careers route', async () => {
  const thence = await loadModule()

  const jobs = await thence.createThenceScraper().run({
    fetchText: async (url) => {
      if (url === thence.HOMEPAGE_URL) return homepageHtml
      if (url === thence.CAREERS_URL) {
        throw new Error(`HTTP 404 for ${thence.CAREERS_URL}`)
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
