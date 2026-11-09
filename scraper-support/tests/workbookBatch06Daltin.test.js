import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_SURFACE_HTML = `
  <html>
    <body>
      <main>
        <a href="https://www.linkedin.com/company/daltinedugroup/">Linkedin</a>
        <h3>Who we are.</h3>
        <p>
          Daltin Edu Group is on a mission to empower global education. This means
          simplifying study abroad journeys, fostering international collaboration,
          and creating opportunities for students, universities, and partners worldwide.
        </p>
        <h3>Our values.</h3>
        <p>Finding simple solutions for complex problems.</p>
        <p>Growing with pace. Grow Daltin Group, grow yourself.</p>
        <p>Being a team of champions, keep it fun.</p>
        <h3>Benefits &amp; Perks</h3>
        <p>Health &amp; Retirement</p>
        <p>Flexible Time-off &amp; Company Closures</p>
        <p>Learning &amp; Development</p>
        <h3>Our ride so far.</h3>
        <p>100 + Members</p>
        <p>500 + Colleges</p>
        <h3>Ready for a ride on the wild side?</h3>
        <p>Join our movement!</p>
        <h2>Looking to participate in Global Education revolution? Connect with us!</h2>
        <p>Ready to take the next step in your global education journey?</p>
        <p>info@daltinedugroup.com</p>
      </main>
    </body>
  </html>
`

const CURRENT_OFFICIAL_SURFACE_HTML = `
  <html>
    <body>
      <main>
        <a href="https://www.linkedin.com/company/daltinedugroup/">Linkedin</a>
        <h1>Who We Are</h1>
        <p>
          Daltin Edu Group is on a mission to empower global education. This means
          simplifying study abroad journeys, fostering international collaboration,
          and creating opportunities for students, universities, and partners worldwide.
        </p>
        <h3>Our values.</h3>
        <p>Finding simple solutions for complex problems.</p>
        <p>Growing with pace. Grow Daltin Group, grow yourself.</p>
        <p>Being a team of champions, keep it fun.</p>
        <p>Taking responsibility with our purpose driven mission in mind.</p>
        <h3>Benefits &#038; Perks</h3>
        <p>Health &#038; Retirement</p>
        <p>Flexible Time-off &#038; Company Closures</p>
        <p>Learning &#038; Development</p>
        <h3>Our ride so far</h3>
        <p>100 + Members</p>
        <p>500 + Colleges</p>
        <p>Join our movement!</p>
        <h2>Looking to participate in Global Education revolution? Connect with us!</h2>
        <p>info@daltinedugroup.com</p>
      </main>
      <script>
        t.src=e,t.defer=!0,s.head.appendChild(t)
      </script>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/daltin/script.js')
  } catch {
    assert.fail('Expected Daltin scraper module at ../../scraper/daltin/script.js')
  }
}















// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('daltin', 'workbookBatch06Daltin')
