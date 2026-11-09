export const provider = {
  source: 'volansys',
  companyName: 'Volansys Technologies',
  officialBrandName: 'VOLANSYS',
  adapter: 'script',
  modulePath: '../../scraper/volansys/script.js',
  homepageUrl: 'https://www.volansys.com/',
  companyCareerPage: 'https://www.volansys.com/be-vigilant/',
  parentCareersPage: 'https://recruitment.acldigital.com/Default.aspx',
  atsPlatform: 'generic-parent-company-careers-plus-blocked-official-domain',
  countryFilter: 'India',
  paginationStrategy: 'parent-careers-shell-plus-blocked-volansys-route-validation',
  extractionStrategy: 'verified-acl-digital-parent-careers+verified-volansys-routes-return-522+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'volansys.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that the official VOLANSYS route https://www.volansys.com/be-vigilant/ states all ACL Digital jobs are posted on https://recruitment.acldigital.com/Default.aspx, while direct VOLANSYS public job routes such as https://www.volansys.com/careers, https://www.volansys.com/jobs, and https://www.volansys.com/be-vigilant/ returned Cloudflare 522 responses during live checks. The reachable ACL Digital board is a generic parent-company careers surface, not a trustworthy VOLANSYS-specific public jobs source, so this provider remains fail-closed.',
  dryRunFile: 'volansys/jobs.json',
}

export default provider

