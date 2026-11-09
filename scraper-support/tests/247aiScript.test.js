import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AJAX_URL,
  CAREER_PAGE_URL,
  buildAjaxRequestBody,
  buildSearchUrl,
  create247AiScraper,
  extractPageConfig,
  extractSearchResults,
} from '../../scraper/247ai/script.js'

const pageHtml = `
<div
  id="ymc-smart-filter-container-1"
  data-params='{"cpt":"career","tax":"area-of-interest","terms":"209,210","filter_id":"42238","target_id":"1","page":"1","page_id":"42554","per_page":"10"}'>
</div>
<script>
var _smart_filter_object = {"ajax_url":"https://www.247.ai/wp-admin/admin-ajax.php","nonce":"3766217669","current_page":"1","path":"https://www.247.ai/wp-content/plugins/ymc-smart-filter/"}
</script>
`

test('extractPageConfig parses the 24 7.ai smart-filter config from the jobs page', () => {
  const config = extractPageConfig(pageHtml)

  assert.deepEqual(config, {
    ajaxUrl: AJAX_URL,
    nonce: '3766217669',
    params: {
      cpt: 'career',
      tax: 'area-of-interest',
      terms: '209,210',
      filter_id: '42238',
      target_id: '1',
      page: '1',
      page_id: '42554',
      per_page: '10',
    },
  })
})

test('extractSearchResults parses 24 7.ai AJAX cards into India job records', () => {
  const jobs = extractSearchResults({
    data: `
      <article class="ymc-post-layout1 post-45009 post-item ">
        <header class="title">
          <a class="media-link " data-postid="45009" target=_self href="https://www.247.ai/career/staff-devops-engineer/">Staff Devops Engineer</a>
        </header>
        <div class="excerpt">Bangalore, India | Hybrid | Experience: 5+ years</div>
        <div class="read-more">
          <a class="btn btn-read-more " data-postid="45009" target=_self href="https://www.247.ai/career/staff-devops-engineer/">Apply Now</a>
        </div>
      </article>
      <article class="ymc-post-layout1 post-45010 post-item ">
        <header class="title">
          <a class="media-link " data-postid="45010" target=_self href="https://www.247.ai/career/customer-success-manager/">Customer Success Manager</a>
        </header>
        <div class="excerpt">Austin, Texas, United States | Full-time | Experience: 8+ years</div>
        <div class="read-more">
          <a class="btn btn-read-more " data-postid="45010" target=_self href="https://www.247.ai/career/customer-success-manager/">Apply Now</a>
        </div>
      </article>
    `,
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Staff Devops Engineer',
    company: '[24]7.ai',
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '45009',
    requisitionId: '45009',
    sourceUrl: 'https://www.247.ai/career/staff-devops-engineer/',
    applyUrl: 'https://www.247.ai/career/staff-devops-engineer/',
    employmentType: null,
    experienceRequired: '5+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Bangalore, India | Hybrid | Experience: 5+ years',
    remoteStatus: 'Hybrid',
  })
})

test('run fetches the 24 7.ai jobs page and AJAX listing payload, then decorates jobs', async () => {
  const requested = []
  const scraper = create247AiScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requested.push({ type: 'page', url })
      return pageHtml
    },
    fetchJson: async (url, body) => {
      requested.push({ type: 'ajax', url, body })
      return {
        data: `
          <article class="ymc-post-layout1 post-45009 post-item ">
            <header class="title">
              <a class="media-link " data-postid="45009" target=_self href="https://www.247.ai/career/staff-devops-engineer/">Staff Devops Engineer</a>
            </header>
            <div class="excerpt">Bangalore, India | Hybrid | Experience: 5+ years</div>
            <div class="read-more">
              <a class="btn btn-read-more " data-postid="45009" target=_self href="https://www.247.ai/career/staff-devops-engineer/">Apply Now</a>
            </div>
          </article>
        `,
      }
    },
  })

  assert.equal(buildSearchUrl(), CAREER_PAGE_URL)
  assert.deepEqual(requested, [
    { type: 'page', url: CAREER_PAGE_URL },
    {
      type: 'ajax',
      url: AJAX_URL,
      body: buildAjaxRequestBody({
        nonce: '3766217669',
        paged: 1,
        params: {
          cpt: 'career',
          tax: 'area-of-interest',
          terms: '209,210',
          filter_id: '42238',
          target_id: '1',
          page: '1',
          page_id: '42554',
          per_page: '10',
        },
      }),
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, '247ai')
  assert.equal(jobs[0].link, 'https://www.247.ai/career/staff-devops-engineer/')
  assert.equal(jobs[0].scrapedAt, jobs[0].scrapedAt)
})
