import { createFirstPartyHTMLScraper } from '../../scraper-support/shared/firstPartyHtmlJobs.js';
import { CONFIG } from './parser.js';
import { nativePostingJobs } from '../../scraper-support/shared/nativeJobPosting.js';
export function projectJobs(result) {
  return nativePostingJobs(result, CONFIG).map(job => {
    const india = job.nativeCountryAddresses.filter(address => address.country === 'India');
    if (india.some(address => /[,;]/.test(address.raw.addressLocality || ''))) {
      job.city = null;
      job.locations = [...new Set(india.flatMap(address => address.raw.addressLocality.split(/[,;]/).map(city => city.trim() + ', India')))];
      job.nativeLocationProjection = 'Explicit source-listed locality components; raw grouped address/postal fields preserved without assigning postal codes to cities.';
    }
    return job;
  });
}
const scraper = createFirstPartyHTMLScraper({ ...CONFIG, projectJobs });
export const collect = scraper.collect;
export const runNative = scraper.run;
