import assert from 'node:assert/strict'
import test from 'node:test'

import {
  INDIA_SEARCH_URL,
  buildSearchUrl,
  createAoSmithScraper,
  pageIndicatesIndiaFalsePositive,
} from '../../scraper/aosmith/script.js'

test('pageIndicatesIndiaFalsePositive recognizes the archived India keyword false-positive flow on A. O. Smith careers', () => {
  const html = `
    <html>
      <head><title>India - A. O. Smith Corporation Jobs</title></head>
      <body>
        <label>Showing 1 to 10 of 10 Jobs</label>
        <ul id="job-tile-list">
          <li class="job-tile" data-url="/job/Ashland-City-Production-Operator-TN-37015/1325760900/">
            <a class="jobTitle-link" href="/job/Ashland-City-Production-Operator-TN-37015/1325760900/">Production Operator</a>
          </li>
          <li class="job-tile" data-url="/job/Appleton-Warehouse-Supervisor-WI-54914/1404030000/">
            <a class="jobTitle-link" href="/job/Appleton-Warehouse-Supervisor-WI-54914/1404030000/">Warehouse Supervisor</a>
          </li>
        </ul>
      </body>
    </html>
  `

  assert.equal(buildSearchUrl(), INDIA_SEARCH_URL)
  assert.equal(pageIndicatesIndiaFalsePositive(html), true)
  assert.equal(
    pageIndicatesIndiaFalsePositive(`
      <html>
        <head><title>India - A. O. Smith Corporation Jobs</title></head>
        <body>
          <label>Showing 1 to 1 of 1 Jobs</label>
          <ul id="job-tile-list">
            <li class="job-tile" data-url="/job/Bangalore-Engineer-India/123/">
              <a class="jobTitle-link" href="/job/Bangalore-Engineer-India/123/">Engineer</a>
              <span>Bangalore, Karnataka, India</span>
            </li>
          </ul>
        </body>
      </html>
    `),
    false,
  )
})

test('current reader refuses text-only old India signal instead of treating it as completed native inventory', async () => {
  let called=false;
  await assert.rejects(createAoSmithScraper().run({fetchText:async()=>{called=true;return '<main>Archived India signal</main>'}}),/original HTTP fetchPage required/i);
  assert.equal(called,false);
});
test('unexpected original HTML is rejected instead of becoming an empty native inventory',async()=>{
  await assert.rejects(createAoSmithScraper().run({fetchPage:async url=>({url,status:200,headers:{},bodyBase64:Buffer.from('<main>Unexpected careers experience</main>').toString('base64')})}),/public tile initializer|published pagination client/i);
});
