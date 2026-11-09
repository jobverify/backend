import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const AVASOFT_CATALOG = {
  source: 'avasoft', companyName: 'AVASOFT', officialBrandName: 'AVASOFT', adapter: 'script', modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://avasoft.com/career/', companyDomain: 'avasoft.com', atsPlatform: 'official-company-careers',
  countryFilter: 'India', parser: 'custom-script', normalizationProfile: 'engineering-default', zeroResultPolicy: 'evidence-required',
  paginationStrategy: "native-visible-cards+verified-loading-client+closing-full-details+final-post-detail-cards",
  extractionStrategy: 'native-employer-and-wordpress-page-identity+complete-role-sections+explicit-India-country',
  applicationStrategy: 'role-declared-contact-page+verified-career-enquiry',
  verifiedOn: null, verifiedAt: null, verifiedPublicPostingCount: null, verifiedIndiaRoleCount: null,
  verifiedPublicJobCount: null, verifiedIndiaJobCount: null, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
  verifiedSurfaceSummary: "The configured Avasoft board retains strict employer/card/full public criteria/country/original-date checks. Closing public application/detail reads now precede a final native card traversal. Responsive-hidden cards at all active breakpoints remain unpublished observations and never become active vacancies or India-zero proof. Configured-board completeness can qualify independently of unknown company-wide totals; lifecycle cleanup stays false. Unknown native job publication dates remain unknown; original WordPress document dates and class years are retained separately.",
}
export default AVASOFT_CATALOG
