import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.epaylater.in/ is the live first-party ePayLater homepage, https://www.epaylater.in/careers.html is the live first-party careers page, and that careers page embeds the public Keka jobs surface rooted at https://epaylater.keka.com/careers/api/embedjobs/62503ac7-49d5-4c4c-98da-fb6b738d32f4. Live verification on July 15, 2026 confirmed https://epaylater.keka.com/careers/api/organization/default/careerportalinfo and https://epaylater.keka.com/careers/api/embedjobs/default/active/62503ac7-49d5-4c4c-98da-fb6b738d32f4 returning the public ePayLater careers portal with 13 active public India vacancies.'

export const EPAYLATER_CATALOG = {
  source: 'epaylater',
  companyName: 'ePayLater',
  officialBrandName: 'ePayLater',
  adapter: 'script',
  homepageUrl: 'https://www.epaylater.in/',
  companyCareerPage: 'https://www.epaylater.in/careers.html',
  careerPortalInfoUrl: 'https://epaylater.keka.com/careers/api/organization/default/careerportalinfo',
  expectedKekaDomain: 'https://epaylater.keka.com/careers/',
  expectedIdentifier: '62503ac7-49d5-4c4c-98da-fb6b738d32f4',
  companyDomain: 'epaylater.in',
  atsPlatform: 'keka-embed-api',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-plus-single-keka-active-jobs-endpoint',
  extractionStrategy:
    'verified-first-party-homepage+verified-first-party-careers-page+embedded-keka-iframe+careerportalinfo+active-keka-embed-api+jobdetails+applyjob',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'epaylater/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default EPAYLATER_CATALOG
