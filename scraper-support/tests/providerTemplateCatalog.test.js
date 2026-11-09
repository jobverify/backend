import assert from 'node:assert/strict'
import test from 'node:test'

import { expandApiPortalProviderTemplate } from '../providers/apiPortalTemplates.js'
import { getScraperCatalog } from '../providers/index.js'

test('expandApiPortalProviderTemplate hydrates lever providers from a compact template definition', () => {
  const provider = expandApiPortalProviderTemplate({
    source: 'bazaarvoice',
    companyName: 'Bazaarvoice',
    companyCareerPage: 'https://www.bazaarvoice.com/company/careers/',
    atsPlatform: 'lever',
    template: 'lever',
    templateOptions: {
      boardToken: 'bazaarvoice',
      locationPattern: 'india|bengaluru|bangalore|hyderabad',
    },
  })

  assert.equal(provider.template, 'lever')
  assert.equal(provider.config.discovery.listingApiUrl, 'https://api.lever.co/v0/postings/bazaarvoice')
  assert.equal(provider.config.request.query.mode, 'json')
  assert.equal(provider.config.mapping.title, 'text')
  assert.deepEqual(provider.config.mapping.location, { strategy: 'lever-location' })
  assert.deepEqual(provider.config.mapping.country, { strategy: 'lever-country' })
  assert.deepEqual(provider.config.mapping.jobDescription, { strategy: 'lever-description' })
  assert.equal(provider.config.resultFilter.include[0].pattern, 'india|bengaluru|bangalore|hyderabad')
})

test('expandApiPortalProviderTemplate hydrates Atlassian providers from the first-party careers listings feed', () => {
  const provider = expandApiPortalProviderTemplate({
    source: 'atlassian',
    companyName: 'Atlassian',
    companyCareerPage: 'https://www.atlassian.com/company/careers/all-jobs',
    atsPlatform: 'icims',
    template: 'atlassian',
    templateOptions: {
      locationPattern: 'india|bengaluru|bangalore|pune|hyderabad|remote - india',
    },
  })

  assert.equal(provider.template, 'atlassian')
  assert.equal(provider.config.discovery.listingApiUrl, 'https://www.atlassian.com/endpoint/careers/listings')
  assert.equal(provider.config.request.method, 'GET')
  assert.equal(provider.config.request.headers.Accept, 'application/json, text/plain, */*')
  assert.equal(provider.config.mapping.title, 'title')
  assert.equal(provider.config.mapping.location, 'locations.0')
  assert.equal(provider.config.mapping.applyUrl, 'applyUrl')
  assert.equal(
    provider.config.mapping.sourceUrl.template,
    'https://www.atlassian.com/company/careers/details/{{jobId}}',
  )
  assert.equal(
    provider.config.resultFilter.include[0].pattern,
    'india|bengaluru|bangalore|pune|hyderabad|remote - india',
  )
})

test('expandApiPortalProviderTemplate hydrates eightfold providers from a compact template definition', () => {
  const provider = expandApiPortalProviderTemplate({
    source: 'paypal',
    companyName: 'PayPal',
    companyCareerPage: 'https://careers.pypl.com/home/',
    atsPlatform: 'eightfold',
    template: 'eightfold',
    templateOptions: {
      host: 'paypal.eightfold.ai',
      domain: 'paypal.com',
      locationPattern: 'india|bengaluru|bangalore|chennai|mumbai|hyderabad|pune|remote',
    },
  })

  assert.equal(provider.template, 'eightfold')
  assert.equal(provider.config.discovery.listingApiUrl, 'https://paypal.eightfold.ai/api/pcsx/search')
  assert.equal(provider.config.request.query.domain, 'paypal.com')
  assert.equal(provider.config.request.headers.Accept, 'application/json, text/plain, */*')
  assert.match(provider.config.request.headers['User-Agent'], /Mozilla\/5\.0/)
  assert.equal(
    provider.config.request.headers.Referer,
    'https://paypal.eightfold.ai/careers?domain=paypal.com',
  )
  assert.equal(provider.config.request.headers.Origin, 'https://paypal.eightfold.ai')
  assert.equal(provider.config.mapping.title, 'name')
  assert.equal(provider.config.mapping.location, 'locations.0')
  assert.equal(provider.config.detail.enabled, true)
  assert.deepEqual(provider.config.detail.headers, provider.config.request.headers)
  assert.equal(
    provider.config.detail.urlTemplate,
    'https://paypal.eightfold.ai/api/pcsx/position_details?position_id={{jobId}}&domain=paypal.com&hl=en',
  )
  assert.equal(
    provider.config.resultFilter.include[0].pattern,
    'india|bengaluru|bangalore|chennai|mumbai|hyderabad|pune|remote',
  )
})

test('expandApiPortalProviderTemplate hydrates dover providers from a compact template definition', () => {
  const provider = expandApiPortalProviderTemplate({
    source: 'volopay',
    companyName: 'Volopay',
    companyCareerPage: 'https://app.dover.com/dover/careers/ebed3959-fa8a-4719-b143-0730e1223ec8',
    atsPlatform: 'dover',
    template: 'dover',
    templateOptions: {
      clientUuid: 'ebed3959-fa8a-4719-b143-0730e1223ec8',
      applySlug: 'volopay',
      locationPattern: 'india|mumbai|bangalore|bengaluru',
    },
  })

  assert.equal(provider.template, 'dover')
  assert.equal(
    provider.config.discovery.listingApiUrl,
    'https://app.dover.com/api/v1/careers-page/ebed3959-fa8a-4719-b143-0730e1223ec8/jobs',
  )
  assert.equal(provider.config.request.method, 'GET')
  assert.equal(provider.config.pagination.strategy, 'single-page')
  assert.deepEqual(provider.config.mapping.title, ['title', 'name'])
  assert.deepEqual(provider.config.mapping.location, [
    {
      path: 'locations',
      valuePath: '0.name',
    },
    'location',
  ])
  assert.equal(
    provider.config.detail.urlTemplate,
    'https://app.dover.com/api/v1/inbound/application-portal-job/{{jobId}}',
  )
  assert.equal(
    provider.config.resultFilter.include[0].pattern,
    'india|mumbai|bangalore|bengaluru',
  )
})

test('getScraperCatalog includes compact template-backed apiPortal providers', () => {
  const catalog = getScraperCatalog()
  const atlassian = catalog.find((provider) => provider.source === 'atlassian')
  const paypal = catalog.find((provider) => provider.source === 'paypal')
  const ericsson = catalog.find((provider) => provider.source === 'ericsson')

  assert.ok(atlassian)
  assert.equal(atlassian.adapter, 'apiPortal')
  assert.equal(atlassian.atsPlatform, 'icims')
  assert.match(atlassian.companyCareerPage, /atlassian\.com\/company\/careers\/all-jobs/i)
  assert.equal(atlassian.companyDomain, 'atlassian.com')
  assert.match(atlassian.config.discovery.listingApiUrl, /atlassian\.com\/endpoint\/careers\/listings/i)

  assert.ok(paypal)
  assert.equal(paypal.adapter, 'apiPortal')
  assert.equal(paypal.atsPlatform, 'eightfold')
  assert.match(paypal.companyCareerPage, /careers\.pypl\.com\/home/i)
  assert.equal(paypal.companyDomain, 'careers.pypl.com')
  assert.match(paypal.config.discovery.listingApiUrl, /paypal\.eightfold\.ai\/api\/pcsx\/search/i)

  assert.ok(ericsson)
  assert.equal(ericsson.adapter, 'apiPortal')
  assert.equal(ericsson.atsPlatform, 'eightfold')
  assert.match(ericsson.companyCareerPage, /jobs\.ericsson\.com\/careers/i)
  assert.equal(ericsson.companyDomain, 'jobs.ericsson.com')
  assert.match(ericsson.config.discovery.listingApiUrl, /jobs\.ericsson\.com\/api\/pcsx\/search/i)
})
