import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Lotus Wireless | Build Engineering Systems</title>
  </head>
  <body>
    <h1>Work At LWT</h1>
    <p>Apply at careers@lotuswireless.com</p>
    <h2>Current Openings</h2>
    <a>
      <div data-framer-name="Senior Embedded Systems Engineer" data-framer-component-type="RichTextContainer">
        <p>Senior Embedded Systems Engineer</p>
      </div>
      <div data-framer-name="Full Time Employment" data-framer-component-type="RichTextContainer">
        <p>Full Time Employment</p>
      </div>
      <div data-framer-name="BANGALORE, INDIA" data-framer-component-type="RichTextContainer">
        <p>bangalore, INDIA</p>
      </div>
      <div data-framer-name="ENGINEERING" data-framer-component-type="RichTextContainer">
        <p>ENGINEERING</p>
      </div>
    </a>
    <a>
      <div data-framer-name="Senior Embedded Systems Engineer" data-framer-component-type="RichTextContainer">
        <p>Senior Embedded Systems Engineer</p>
      </div>
      <div data-framer-name="Full Time Employment" data-framer-component-type="RichTextContainer">
        <p>Full Time Employment</p>
      </div>
      <div data-framer-name="BANGALORE, INDIA" data-framer-component-type="RichTextContainer">
        <p>bangalore, INDIA</p>
      </div>
      <div data-framer-name="ENGINEERING" data-framer-component-type="RichTextContainer">
        <p>ENGINEERING</p>
      </div>
    </a>
    <h3>Why Join LWT</h3>
    <p>Engineering-Led Environment</p>
    <p>Work on Real-World Impact</p>
    <h3>Our Work Culture</h3>
  </body>
</html>
`

test('Lotus Wireless recognizes the current careers page and deduplicates visible opening cards', async () => {
  const lotus = await loadModule()

  assert.equal(lotus.CAREERS_URL, 'https://lotuswireless.com/careers-page')
  assert.equal(lotus.hasOfficialCareersSignal(careersHtml), true)

  const openings = lotus.extractOpeningCards(careersHtml)
  assert.equal(openings.length, 1)
  assert.deepEqual(openings[0], {
    title: 'Senior Embedded Systems Engineer',
    employmentType: 'Full-time',
    location: 'Bangalore, India',
    city: 'Bangalore',
    department: 'Engineering',
  })
})

test('Lotus Wireless extracts visible first-party openings with email apply handoff', async () => {
  const lotus = await loadModule()

  const jobs = await lotus.createLotusWirelessTechnologiesScraper().run({
    fetchText: async (url) => {
      assert.equal(url, lotus.CAREERS_URL)
      return careersHtml
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Embedded Systems Engineer')
  assert.equal(jobs[0].location, 'Bangalore, India')
  assert.equal(jobs[0].applyUrl, 'mailto:careers@lotuswireless.com')
  assert.equal(jobs[0].sourceUrl, lotus.CAREERS_URL)
})
