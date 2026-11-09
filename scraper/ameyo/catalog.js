import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AMEYO_CATALOG = {
  source: 'ameyo',
  companyName: 'Ameyo',
  adapter: 'script',
  companyCareerPage: 'https://exotel.com/about-us/careers/',
  companyDomain: 'ameyo.com',
  atsPlatform: 'recruiterbox',
  countryFilter: 'India',
  paginationStrategy: 'verified-exotel-branded-homepage-or-verified-homepage-522-outage-plus-upstream-recruiterbox-openings-json',
  extractionStrategy: 'verified-exotel-branded-homepage-or-verified-homepage-522-outage+verified-exotel-careers-page+recruiterbox-openings-json',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  homepageUrl: 'https://www.ameyo.com/',
  officialCareersHandoffUrl: 'https://exotel.com/careers/',
  upstreamCareersCanonicalUrl: 'https://exotel.com/about-us/careers/',
  openingsApiUrl: 'https://app.recruiterbox.com/widget/2176/openings/',
  verifiedUpstreamJobUrl: 'https://app.recruiterbox.com/widget/2176/opening/708128/',
  verifiedCareers404Urls: [
    'https://www.ameyo.com/careers/',
    'https://www.ameyo.com/jobs/',
  ],
  upstreamCompanyName: 'Exotel Techcom Pvt Ltd',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://www.ameyo.com/ is reachable again and prominently brands Ameyo XTRM by Exotel, but its old https://exotel.com/careers/ navigation link is absent. The canonical Exotel careers page at https://exotel.com/about-us/careers/ still exposes Recruiterbox widget 2176. The public feed at https://app.recruiterbox.com/widget/2176/openings/ returns 31 India roles, including https://app.recruiterbox.com/widget/2176/opening/708128/.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AMEYO_CATALOG
