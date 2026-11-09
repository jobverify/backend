import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://aris.in/ is the live first-party ArisInfra homepage, that it links Careers to the first-party page https://aris.in/pages/careers, that https://arisinfra.com/sitemap.xml advertises https://arisinfra.com/pages/careers which resolves to the same live careers surface, and that the first-party careers page embeds window.khConfig plus https://arisinfra.keka.com/careers/api/embedjobs/js/cb2bd48a-dacd-45a9-9b06-df3dc4065912. Live verification on July 15, 2026 confirmed https://arisinfra.keka.com/careers/api/organization/default/careerportalinfo and https://arisinfra.keka.com/careers/api/embedjobs/default/active/cb2bd48a-dacd-45a9-9b06-df3dc4065912 returning the public Aris careers portal with 8 active public India vacancies.'

export const ARISINFRA_CATALOG = {
  source: 'arisinfra',
  companyName: 'ArisInfra',
  officialBrandName: 'Arisinfra Solutions Limited',
  adapter: 'script',
  homepageUrl: 'https://aris.in/',
  companyCareerPage: 'https://aris.in/pages/careers',
  sitemapUrl: 'https://arisinfra.com/sitemap.xml',
  careerPortalInfoUrl: 'https://arisinfra.keka.com/careers/api/organization/default/careerportalinfo',
  expectedKekaDomain: 'https://arisinfra.keka.com/careers/',
  expectedIdentifier: 'cb2bd48a-dacd-45a9-9b06-df3dc4065912',
  companyDomain: 'aris.in',
  atsPlatform: 'keka-embed-api',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-plus-single-keka-active-jobs-endpoint',
  extractionStrategy:
    'verified-official-homepage+verified-first-party-careers-page+inline-window-khConfig+keka-careerportalinfo+active-keka-embed-api+jobdetails+applyjob',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'arisinfra/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ARISINFRA_CATALOG
