import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  "Verified on Friday, August 7, 2026 that https://www.dream11.com/ is still the live Dream11 homepage, that it still shows a first-party Careers entry plus Sporta Technologies Private Limited footer/legal copy, and that https://www.dream11.com/careers, https://www.dream11.com/careers/, https://www.dream11.com/jobs, and https://www.dream11.com/join-us still resolve back to the Dream11 homepage while https://www.dream11.com/about-us/careers remains a first-party 404 route. Verified that https://www.dreamsports.group/careers still redirects to https://www.dreamsports.group/lifeatdreamsports, whose canonical still points at https://www.dreamsports.group/careers and whose current public content is a Dream Sports brand-and-culture page headed 'Game On. Build Big.' and 'LIFE AT DREAM SPORTS' with benefits and culture copy but no trustworthy public jobs board or application links. Verified that likely alternate parent jobs routes including https://www.dreamsports.group/jobs, https://www.dreamsports.group/openings, https://www.dreamsports.group/careers/jobs, https://www.dreamsports.group/careers/openings, https://www.dreamsports.group/lifeatdreamsports/jobs, https://www.dreamsports.group/lifeatdreamsports/openings, and https://www.dreamsports.group/lifeatdreamsports/careers return 404 on the verified date, so there is still no trustworthy public jobs surface attributable to Dream11 right now."

export const DREAM11_CATALOG = {
  source: 'dream11',
  companyName: 'Dream11',
  officialBrandName: 'Dream11',
  parentCompanyName: 'Dream Sports',
  adapter: 'script',
  homepageUrl: 'https://www.dream11.com/',
  companyCareerPage: 'https://www.dreamsports.group/careers',
  parentCareersLandingUrl: 'https://www.dreamsports.group/lifeatdreamsports',
  linkedCareersUrl: 'https://www.dreamsports.group/careers/',
  parentCompanyDomain: 'dreamsports.group',
  companyDomain: 'dream11.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-dream11-homepage-plus-parent-dream-sports-careers-handoff',
  extractionStrategy:
    'verified-dream11-homepage+verified-dream11-direct-careers-routes-return-home-or-404+verified-parent-dream-sports-careers-redirect+verified-parent-careers-brand-page-without-public-jobs+verified-alternate-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-07',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'dream11/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DREAM11_CATALOG
