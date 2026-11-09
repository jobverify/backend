import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_SURFACE_HTML = `
  <html>
    <body>
      <main>
        <section>
          <h1>Join the ZestMoney team!</h1>
          <p>
            We are building the world's most loved &amp; most accessible financial brand!
          </p>
          <a href="https://careers-zestmoney.icims.com/">SEE JOB OPENINGS</a>
        </section>
        <section>
          <h2>Ready to make a difference?</h2>
          <p>
            We have built a credit disbursal system that is seamless and end-to-end automated.
          </p>
        </section>
        <section>
          <h2>Work with people who bring out the best in you</h2>
        </section>
        <section>
          <h2>At ZestMoney, we are...</h2>
          <p>Innovative. Transparent. Authentic. Responsive. Fair.</p>
        </section>
        <section>
          <h2>Perks and Benefits</h2>
          <p>E-learning allowance</p>
        </section>
      </main>
    </body>
  </html>
`

const loadZestMoneyModule = async () => {
  try {
    return await import('../../scraper/zestmoney/script.js')
  } catch {
    assert.fail('Expected ZestMoney scraper module at ../../scraper/zestmoney/script.js')
  }
}











// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('zestmoney', 'workbookBatch06ZestMoney')
