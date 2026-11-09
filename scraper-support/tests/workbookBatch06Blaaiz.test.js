import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_SURFACE_HTML = `
  <html>
    <body>
      <main>
        <p>Fraudsters don't sleep, neither do we. We lock the doors before fraud walks in.</p>
        <h1>About Us</h1>
        <h2>Global Financial Infrastructure</h2>
        <h3>Vision</h3>
        <p>
          To become Africa's financial infrastructure layer connecting businesses,
          institutions, currencies, and economies across borders.
        </p>
        <h3>Mission</h3>
        <p>
          To provide regulated payments, custody, and settlement infrastructure
          needed to move value across any corridor, in any currency, at institutional
          grade.
        </p>
        <h3>Our Story</h3>
        <h2>Solving Problems Markets Won't Solve</h2>
        <p>Enabling Mobility and Prosperity Through Cross-Border Infrastructure</p>
        <p>
          Blaaiz is a financial powerhouse for cross-border infrastructure,
          operating the systems through which value moves between markets.
        </p>
        <p>support@blaaiz.com</p>
        <p>sales@blaaiz.com</p>
        <a href="https://app.blaaiz.com/auth/create-account">Get Started</a>
      </main>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/blaaiz/script.js')
  } catch {
    assert.fail('Expected Blaaiz scraper module at ../../scraper/blaaiz/script.js')
  }
}














// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('blaaiz', 'workbookBatch06Blaaiz')
