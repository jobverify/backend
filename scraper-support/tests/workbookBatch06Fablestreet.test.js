import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_SURFACE_HTML = `
  <html>
    <head>
      <title>About Us</title>
      <link rel="canonical" href="https://www.fablestreet.com/pages/about-us" />
    </head>
    <body>
      <main>
        <h1>About Us</h1>
        <p>How Are We Different</p>
        <p>At Fable Street we design for Indian curves</p>
        <p>You shouldn't have to fit into clothes</p>
        <p>Our Values</p>
        <h2>Find Your Best FIT</h2>
        <a href="https://www.fablestreet.com/">SHOP NOW</a>
        <section>
          <h3>CONTACT US</h3>
          <p>Ph No: 01143078400</p>
          <p>Fable Street Lifestyle Solutions Private Limited, Plot No. 335, Udyog Vihar, Phase IV, Gurugram, Haryana - 122002</p>
          <p>Timings: 09:30 AM to 06:30 PM, Mon to Sat</p>
          <p>For Info/Issues: care@fablestreet.com</p>
          <p>For Jobs: careers@fablestreet.com</p>
        </section>
      </main>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/fablestreet/script.js')
  } catch {
    assert.fail(
      'Expected Fablestreet scraper module at ../../scraper/fablestreet/script.js',
    )
  }
}











// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('fablestreet', 'workbookBatch06Fablestreet')
