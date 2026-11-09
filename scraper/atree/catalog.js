import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_JOB_DETAIL_URLS = [
  'https://www.atree.org/career/executive-assistant-2/',
  'https://www.atree.org/career/jrf-anrf/',
  'https://www.atree.org/career/doctoral-researcher-position-ueb/',
]

export const VERIFIED_APPLY_URLS = [
  'https://forms.gle/y2nuF4BbwMEf9bky6',
  'https://mail.google.com/mail/?view=cm&fs=1&to=ashish.kumar@atree.org&cc=radhika.reddy@atree.org&su=Application%20for%20JRF%20%E2%80%93%20Reconstream',
  'https://docs.google.com/forms/d/e/1FAIpQLSdXL1QPZ8w4m0n8B9FUg00THXYjmDQ0M9zSyQdPdMvBc2p-mQ/viewform?usp=sharing&ouid=107152544725028953630',
]

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.atree.org/ is the live first-party homepage for Ashoka Trust for Research in Ecology and the Environment (ATREE), that the homepage exposes a first-party Work With Us handoff to https://www.atree.org/careers/, that https://www.atree.org/wp-sitemap.xml publishes the first-party career post sitemap at https://www.atree.org/wp-sitemap-posts-career-1.xml, and that the current public careers listing exposes exactly three first-party roles: Executive Assistant at https://www.atree.org/career/executive-assistant-2/, Junior Research Fellow (JRF) Position in an Anusandhan National Research Foundation (ANRF)-Funded Project at https://www.atree.org/career/jrf-anrf/, and Doctoral Researcher Position: Urban Ecology and Biodiversity at https://www.atree.org/career/doctoral-researcher-position-ueb/. The verified detail pages preserve mixed public apply handoffs to https://forms.gle/y2nuF4BbwMEf9bky6, a mail.google.com compose URL for the JRF role, and a docs.google.com application form for the doctoral researcher role. During live checks, https://www.atree.org/career/ redirected to the same first-party careers page, while https://www.atree.org/jobs/ and https://www.atree.org/openings/ returned first-party 404 pages.'

export const ATREE_CATALOG = {
  source: 'atree',
  companyName: 'Atree',
  officialBrandName: 'Ashoka Trust for Research in Ecology and the Environment (ATREE)',
  adapter: 'script',
  homepageUrl: 'https://www.atree.org/',
  getInvolvedUrl: 'https://www.atree.org/get-involved/',
  companyCareerPage: 'https://www.atree.org/careers/',
  legacyCareerPageUrl: 'https://www.atree.org/career/',
  workWithUsUrl: 'https://www.atree.org/work-with-us/',
  sitemapUrl: 'https://www.atree.org/wp-sitemap.xml',
  careerPostSitemapUrl: 'https://www.atree.org/wp-sitemap-posts-career-1.xml',
  checkedMissingRouteUrls: [
    'https://www.atree.org/jobs/',
    'https://www.atree.org/openings/',
  ],
  verifiedJobDetailUrls: VERIFIED_JOB_DETAIL_URLS,
  verifiedApplyUrls: VERIFIED_APPLY_URLS,
  companyDomain: 'atree.org',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-list-plus-first-party-detail-pages',
  extractionStrategy:
    'verified-homepage+verified-careers-list+verified-wp-sitemap+verified-career-post-sitemap+verified-career-route-redirect+verified-missing-routes+first-party-detail-pages+mixed-public-apply-handoffs',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'atree/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ATREE_CATALOG
