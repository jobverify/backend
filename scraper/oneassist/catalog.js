import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ONE_ASSIST_CATALOG = {
  source: 'oneassist',
  companyName: 'OneAssist',
  officialBrandName: 'OneAssist',
  adapter: 'script',
  homepageUrl: 'https://oneassist.in/',
  companyCareerPage:
    'https://careers.oneassist.in/?utm_source=website&utm_medium=website_footer&utm_campaign=footer',
  officialCareersPageUrl:
    'https://careers.oneassist.in/?utm_source=website&utm_medium=website_footer&utm_campaign=footer',
  companyDomain: 'oneassist.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'official-homepage-footer-handoff-plus-broken-first-party-careers-subdomain-validation',
  extractionStrategy:
    'verified-official-homepage-footer-link+verified-broken-first-party-careers-subdomain-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that the official OneAssist homepage at https://oneassist.in/ links its Careers footer entry to the exact first-party URL https://careers.oneassist.in/?utm_source=website&utm_medium=website_footer&utm_campaign=footer. The linked careers subdomain currently serves a WordPress error surface stating "Active domain connection for this domain not found", and a standard Node fetch against that URL currently fails with ERR_TLS_CERT_ALTNAME_INVALID because careers.oneassist.in does not match the presented wordpress.com certificate alt names. There is no trustworthy public jobs surface on the exact-name OneAssist domains, so this provider is pinned as a fail-closed sentinel that returns no jobs until a trustworthy first-party careers surface reappears.',
  dryRunFile: 'oneassist/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ONE_ASSIST_CATALOG
