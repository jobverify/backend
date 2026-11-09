import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_SURFACE_HTML = `
  <html>
    <body>
      <main>
        <section>
          <h1>Build the Future of Hiring with Zwayam</h1>
          <p>
            At Zwayam, we're revolutionizing recruitment with AI, data, and
            automation. If you're passionate about innovation and solving
            real-world challenges, we want you on our team.
          </p>
          <a href="https://careers.infoedge.com/infoedge/jobslist">Explore Jobs</a>
          <p>
            You will be redirected to Info Edge's Careers page (Zwayam's parent
            company).
          </p>
          <p>opendoors@zwayam.com</p>
        </section>
      </main>
    </body>
  </html>
`

const loadZwayamModule = async () => {
  try {
    return await import('../../scraper/zwayam/script.js')
  } catch {
    assert.fail('Expected Zwayam scraper module at ../../scraper/zwayam/script.js')
  }
}











// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('zwayam', 'workbookBatch06Zwayam')
