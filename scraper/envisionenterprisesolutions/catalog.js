import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ENVISION_ENTERPRISE_SOLUTIONS_CATALOG = {
  source: 'envisionenterprisesolutions',
  companyName: 'Envision Enterprise Solutions',
  officialBrandName: 'Envision Enterprise Solutions',
  adapter: 'script',
  homepageUrl: 'https://www.envisionesl.com/',
  contactPageUrl: 'https://www.envisionesl.com/about-us/contact-us',
  sitemapUrl: 'https://www.envisionesl.com/sitemap.xml',
  companyCareerPage: 'https://www.envisionesl.com/about-us/join-us',
  atsPlatform: 'official-company-careers-form-handoff',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-contact-page-plus-join-us-form-validation',
  extractionStrategy:
    'verified-homepage+verified-contact-jobs-career-handoff+verified-join-us-zoho-form-without-public-openings+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'envisionesl.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.envisionesl.com/ remained the live exact-name first-party Envision homepage, that https://www.envisionesl.com/about-us/contact-us explicitly routed Jobs/Career traffic to https://www.envisionesl.com/about-us/join-us, and that the join-us page embedded only the Zoho form https://forms.zohopublic.com/envisionmiddleeast/form/EnvisionCareers/formperma/Ybf-DNkQfm6gr6T7PtjR6MPNZkJxuGmDs6sX_Lum8jc without public job cards or detail pages. No trustworthy public openings were enumerable on the verified date, so this provider stays fail-closed.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'envisionenterprisesolutions/jobs.json',
}

export default ENVISION_ENTERPRISE_SOLUTIONS_CATALOG
