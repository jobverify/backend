export const KAPIVA_CATALOG = {
  source: 'kapiva',
  companyName: 'Kapiva',
  officialBrandName: 'Kapiva',
  adapter: 'script',
  modulePath: '../../scraper/kapiva/script.js',
  dryRunFile: 'kapiva/jobs.json',
  homepageUrl: 'https://kapiva.in/',
  aboutPageUrl: 'https://kapiva.in/about-us/',
  contactPageUrl: 'https://kapiva.in/contact-us/',
  companyCareerPage: 'https://kapiva.in/contact-us/',
  companyDomain: 'kapiva.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-about-plus-contact-route-validation',
  extractionStrategy:
    'verified-homepage+verified-about-page+verified-contact-page-without-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-08',
  verifiedSurfaceSummary:
    "Verified on Thursday, October 8, 2026 that https://kapiva.in/, https://kapiva.in/about-us/, and https://kapiva.in/contact-us/ are live first-party Kapiva surfaces. The About page now presents science-backed Ayurveda and seed-to-batch verification with a canonical Kapiva URL and Adret Retail legal identity. The contact page still exposes careers@kapiva.in under \"For openings and collaboration\" through Cloudflare-protected email markup. These routes and the official static sitemap expose no trustworthy public job listings or ATS handoff, and /careers/, /career/, and /jobs/ return branded 404 pages; this remains a non-listing sentinel rather than a verified count of zero company vacancies.",
}

export default KAPIVA_CATALOG

