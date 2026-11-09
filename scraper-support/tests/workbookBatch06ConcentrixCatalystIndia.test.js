import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_LINKEDIN_COMPANY_HTML = `
  <html>
    <body>
      <main>
        <h1>Concentrix Catalyst</h1>
        <p>IT Services and IT Consulting</p>
        <a href="https://www.linkedin.com/jobs/concentrix-catalyst-jobs">See jobs</a>
        <p>Website https://catalyst.concentrix.com/</p>
        <p>Bangalore, 560078, IN</p>
        <p>Chennai, IN</p>
        <p>Hyderabad, IN</p>
      </main>
    </body>
  </html>
`

const VERIFIED_PARENT_INDIA_HTML = `
  <html>
    <body>
      <main>
        <h1>India</h1>
        <p>
          Here at Concentrix India, we are supporting forward-thinking brands with
          their AI, automation, and data driven CX needs.
        </p>
        <h2>Join Our Team</h2>
        <p>Experience the power of a game-changing career.</p>
        <a href="https://jobs.concentrix.com/">Join Us</a>
        <p>15 locations across India</p>
        <p>Human centered. Tech-powered. Intelligence-fueled.</p>
      </main>
    </body>
  </html>
`

const VERIFIED_LINKEDIN_JOBS_HTML = `
  <html>
    <body>
      <main>
        <p>Concentrix Catalyst in India</p>
        <p>
          <span>Get notified about new Concentrix Catalyst jobs in India</span><span>.</span>
        </p>
        <p>Sign in to create job alert</p>
        <h1>1,000+ Concentrix Catalyst Jobs in India</h1>
        <article>
          <h3>Microsoft Dynamic CRM</h3>
          <h4><a href="https://www.linkedin.com/company/concentrix/">Concentrix</a></h4>
          <p>Hyderabad, Telangana, India</p>
        </article>
      </main>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/concentrixcatalystindia/script.js')
  } catch {
    assert.fail(
      'Expected Concentrix Catalyst India scraper module at ../../scraper/concentrixcatalystindia/script.js',
    )
  }
}

const loadCatalog = async () => {
  try {
    return (await import('../../scraper/concentrixcatalystindia/catalog.js')).default
  } catch {
    assert.fail(
      'Expected Concentrix Catalyst India catalog module at ../../scraper/concentrixcatalystindia/catalog.js',
    )
  }
}











// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('concentrixcatalystindia', 'workbookBatch06ConcentrixCatalystIndia')
