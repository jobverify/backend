export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://bel-india.in/ is the live official Bharat Electronics Limited homepage and links the first-party recruitment surface at https://bel-india.in/job-notifications/. The Job Notifications page states that all recruitments at Bharat Electronics Limited are advertised only on the official BEL website, publishes live recruitment cards with BEL-hosted advertisement PDFs, and currently exposes active public openings including Advertisement for the post of Havildar (Security) on Permanent Basis for BEL Pune with last date 31-07-2026 and official jobapply.in handoff https://jobapply.in/BEL2026PuneHavildarSecurity/, plus Recruitment of Senior Engineer on Fixed Tenure Basis for Project Sites in Madhya Pradesh with last date 16-07-2026 and BEL-hosted application form PDF https://bel-india.in/wp-content/uploads/2026/06/BIO-DATA-FORM.pdf. The paginated URL https://bel-india.in/job-notifications/page/2/ is also live and currently renders the same Job Notifications layout, so the scraper deduplicates repeated results and filters out expired notices.'

export const BHARAT_ELECTRONICS_CATALOG = {
  source: 'bharatelectronics',
  companyName: 'Bharat Electronics',
  adapter: 'script',
  modulePath: '../../scraper/bharatelectronics/script.js',
  companyCareerPage: 'https://bel-india.in/job-notifications/',
  homepageUrl: 'https://bel-india.in/',
  pageTwoUrl: 'https://bel-india.in/job-notifications/page/2/',
  sampleOnlineApplyUrl: 'https://jobapply.in/BEL2026PuneHavildarSecurity/',
  sampleApplicationFormUrl: 'https://bel-india.in/wp-content/uploads/2026/06/BIO-DATA-FORM.pdf',
  companyDomain: 'bel-india.in',
  atsPlatform: 'first-party-recruitment-notices-plus-jobapply-handoff',
  countryFilter: 'India',
  paginationStrategy: 'job-notifications-root-plus-page-number-dedupe-stop',
  extractionStrategy:
    'official-homepage+official-job-notifications-listings+active-date-filter+jobapply-and-pdf-application-handoffs',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default BHARAT_ELECTRONICS_CATALOG

