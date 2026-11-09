import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_SURFACE_HTML = `
  <html>
    <head>
      <title>Career | Crownit</title>
    </head>
    <body>
      <main>
        <div class="about-title">careers</div>
        <p>
          <span class="lookingfor">Looking for career opportunities with us?</span>
          Ours is a team honed by hard work, dedication and sheer will to become a champion.
          We do not shy away from work tirelessly to inch closer to the future that we have envisioned for ourselves.
          We are always on the lookout for like-minded individuals with strong work ethics and a passion to create something.
          If our vision moves you too, come and join our awe-inspiring team.
        </p>
        <app-contactus career="2" source="career">
          <div class="button-container button- contactus-hide">
            <button class="contact-btn">Apply for job</button>
          </div>
        </app-contactus>
        <p class="life-at-caption">
          Now you can earn Crowns when you refer your friends for our open positions!
          Send us your friend's resume at
          <a href="mailto:hr@crownit.in" target="_blank">hr@crownit.in</a>
          and earn 5,000 Crowns* (worth Rs 2,500) on their successful appointment!
        </p>
        <a href="/en/about-us">About Us</a>
        <a href="/en/contact-us">Contact Us</a>
        <a href="https://blog.crownit.in/">Blog</a>
      </main>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/crownit/script.js')
  } catch {
    assert.fail('Expected Crownit scraper module at ../../scraper/crownit/script.js')
  }
}













// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('crownit', 'workbookBatch06Crownit')
