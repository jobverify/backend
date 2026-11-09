import { createFirstPartyHTMLScraper } from '../../scraper-support/shared/firstPartyHtmlJobs.js';
import { CONFIG } from './parser.js';
const scraper = createFirstPartyHTMLScraper(CONFIG);
export const collect = scraper.collect;
export const runNative = scraper.run;
