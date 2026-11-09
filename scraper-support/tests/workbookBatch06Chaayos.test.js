import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_SURFACE_HTML = `
  <html>
    <head>
      <title>careers - Chaayos</title>
    </head>
    <body>
      <main>
        <h2>Our Mission</h2>
        <p>
          Our mission is to help ease these seemingly endless pressures of modern
          existence using a traditional recipe for Relaxation i.e. Chai and Snacks
          that go along with it.
        </p>
        <p>
          Sunshine Teahouse Private Limited known as 'Chaayos' was formed with
          the vision to create a unique tea experience for the consumers of India.
        </p>
        <p>Share resume on hr@chaayos.com</p>
        <a href="https://chaayos.com/pages/our-story">Our Story</a>
      </main>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/chaayos/script.js')
  } catch {
    assert.fail('Expected Chaayos scraper module at ../../scraper/chaayos/script.js')
  }
}











// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('chaayos', 'workbookBatch06Chaayos')
