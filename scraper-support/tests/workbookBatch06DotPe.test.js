import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_SURFACE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>DotPe</title>
    </head>
    <body>
      <main>
        <section class="top-banner-section">
          <p>Work at Dotpe</p>
          <h1>Build something exciting.</h1>
          <p>We are looking for passionate folks like you to reimagine the future of commerce in India</p>
          <a href="#" class="get-started-btn">View Open Roles</a>
        </section>

        <section class="see-openings-sec">
          <p>Help us transform commerce for millions of merchants.</p>
          <a href="#" class="see-openings-btn">See Openings</a>
        </section>

        <section class="hiring-section">
          <h1>We’re hiring</h1>
          <h2>innovators, boundary-pushers, problem solvers, forward thinkers</h2>
          <form class="form-inline">
            <input type="text" class="form-control" placeholder="Search Jobs, Enter Keyword">
            <button type="submit" class="btn btn-primary request-callback-btn">Search all Jobs</button>
          </form>
        </section>

        <section class="culture">
          <h2>Value that we seek in our people and cultivate in our culture.</h2>
          <h3>AWESOMENESS IN THEIR DNA</h3>
          <h3>CUSTOMER OBSESSION</h3>
          <h3>A FUNNY BONE</h3>
        </section>
      </main>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/dotpe/script.js')
  } catch {
    assert.fail('Expected DotPe scraper module at ../../scraper/dotpe/script.js')
  }
}











// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('dotpe', 'workbookBatch06DotPe')
