import assert from 'node:assert/strict'
import test from 'node:test'

import {
  INDIA_SEARCH_URL,
  RSS_URL,
  CAREER_PAGE_URL,
  JOBS_URL,
  buildApplyUrl,
  buildDetailUrl,
  buildJob,
  buildSearchUrl,
  getRunnerMetadata,
  normalizeListings,
} from '../../scraper/volvo/script.js'

test('pins the Volvo Group scraper to the verified India SuccessFactors surfaces', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.volvogroup.com/en/careers.html')
  assert.equal(JOBS_URL, 'https://jobs.volvogroup.com/en')
  assert.equal(INDIA_SEARCH_URL, 'https://jobs.volvogroup.com/search/?q=&locationsearch=India')
  assert.equal(RSS_URL, 'https://jobs.volvogroup.com/services/rss/job/?locale=en_US&keywords=(India)')
  assert.equal(buildSearchUrl(), INDIA_SEARCH_URL)
})

test('keeps India Volvo Group listings and drops listings outside India', () => {
  const listings = normalizeListings([
    {
      title: 'Senior Engineer',
      location: 'Bangalore, Karnataka, India',
      jobId: '123456',
      slug: 'senior-engineer',
    },
    {
      title: 'Product Manager',
      location: 'Gothenburg, Sweden',
      jobId: '987654',
      slug: 'product-manager',
    },
  ])

  assert.deepEqual(listings, [{
    title: 'Senior Engineer',
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    jobId: '123456',
    slug: 'senior-engineer',
  }])
})

test('builds Volvo Group detail, apply, and shared job URLs from listing data', () => {
  const listing = {
    title: 'Senior Engineer',
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    jobId: '123456',
    slug: 'senior-engineer',
  }

  assert.equal(buildDetailUrl(listing), 'https://jobs.volvogroup.com/job/senior-engineer/123456/')
  assert.equal(buildApplyUrl(listing), 'https://jobs.volvogroup.com/talentcommunity/apply/123456/?locale=en_US')
  assert.deepEqual(buildJob(listing), {
    ...listing,
    company: 'Volvo Group',
    source: 'volvo',
    country: 'India',
    sourceUrl: 'https://jobs.volvogroup.com/job/senior-engineer/123456/',
    applyUrl: 'https://jobs.volvogroup.com/talentcommunity/apply/123456/?locale=en_US',
    link: 'https://jobs.volvogroup.com/talentcommunity/apply/123456/?locale=en_US',
  })
})

test('returns runner metadata with unknown current totals and held full-source scope',()=>{
 const meta=getRunnerMetadata();assert.equal(meta.name,'volvo');assert.equal(meta.dryRunFile,'jobs.json');assert.equal(meta.provider.source,'volvo');assert.equal(meta.provider.companyCareerPage,CAREER_PAGE_URL);assert.equal(meta.provider.baseUrl,JOBS_URL);assert.equal(meta.provider.adapter,'script');assert.equal(meta.provider.atsPlatform,'successfactors-public-native-get');assert.equal(meta.provider.verifiedPublicJobCount,null);assert.equal(meta.provider.sourceScopeComplete,false);assert.equal(meta.provider.lifecycleCleanupAllowed,false);assert.equal(meta.provider.zeroResultPolicy,'coverage-gap');
});
