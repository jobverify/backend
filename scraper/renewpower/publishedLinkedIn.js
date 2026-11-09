import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js';

export const CORPORATE_CAREERS_URL = 'https://www.renew.com/growth-opportunities';
export const BRAND_ALIAS_URL = 'https://www.renew.com/events/renew-unveils-new-brand-identity-as-it-reinforces-leadership-in-providing-decarbonisation-solutions';
export const LINKEDIN_PROFILE_URL = 'https://in.linkedin.com/company/renew';
export const LINKEDIN_LISTING_URL = 'https://www.linkedin.com/jobs/renew-jobs-worldwide?f_C=2563081';
const COUNTRY_CODES = new Set('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' '));
const error = message => Object.assign(new Error('ReNew published LinkedIn contract: '+message), { failureKind: 'surface_drift_or_fail_closed', abortRetries: true });
const decode = value => {
  let text = String(value ?? '');
  for (let i=0;i<3;i++) text=text.replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&apos;|&#39;|&rsquo;|&lsquo;/gi,"'").replace(/&nbsp;/gi,' ').replace(/&ndash;/gi,'–').replace(/&mdash;/gi,'—');
  return text;
};
const text = value => decode(value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const attrs = tag => Object.fromEntries([...String(tag).matchAll(/\b([a-z][\w-]*)\s*=\s*["']([^"']*)["']/gi)].map(m=>[m[1].toLowerCase(),decode(m[2])]));
// Remove inactive HTML first. Numeric metadata is usable only in an active code
// element; an outer commented code wrapper is discarded.
const publishedHtml = value => String(value ?? '').replace(/<!--[\s\S]*?-->|<code\b([^>]*)>([\s\S]*?)<\/code>/gi, (token,attributes,body) => {
  if(token.startsWith('<!--'))return '';
  if(attrs(attributes).id==='decoratedJobPostingId'){
    const id=body.match(/^\s*<!--"(\d+)"-->\s*$/)?.[1];
    return id ? '<code id="decoratedJobPostingId">"'+id+'"</code>' : '<code id="decoratedJobPostingId"></code>';
  }
  return token.replace(/<!--[\s\S]*?-->/g,'');
});
const canonical = html => [...html.matchAll(/<link\b[^>]*>/gi)].map(m=>attrs(m[0])).find(a=>a.rel==='canonical')?.href;
const anchors = html => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(m=>({...attrs(m[1]),text:text(m[2])}));
const employerUrl = value => { try {const u=new URL(value);return u.protocol==='https:'&&['in.linkedin.com','www.linkedin.com'].includes(u.hostname)&&!u.username&&!u.password&&u.pathname==='/company/renew';}catch{return false} };
const schemas = html => [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap(m=>{
  let j;try{j=JSON.parse(m[1])}catch{throw error('malformed native JSON schema')}
  return Array.isArray(j)?j:j?.['@graph']||[j];
});
const regionDisplayNames = new Intl.DisplayNames(['en'], { type: 'region' });
const foreignCountryNames = [...COUNTRY_CODES].filter(code=>code!=='IN').map(code=>regionDisplayNames.of(code)).concat(['UK','USA','US','Turkey']);
const escapePattern = value => value.replace(/[.*+?^\${}()|[\]\\]/g, token=>'\\'+token);
const workplaceName = value => text(value).toLowerCase().replace(/\bgurgaon\b/g,'gurugram').replace(/^greater (.+) area$/,'$1');
const verifyExplicitJdWorkplace = (description,location,address) => {
  const lines=decode(description).replace(/<!--[\s\S]*?-->/g,'').replace(/<(?:br\b[^>]*|\/(?:p|div|li))>/gi,'\n').replace(/<[^>]*>/g,' ').split('\n').map(text);
  const places=[address.addressLocality,...location.split(',').filter(part=>part.trim()!=='India')].map(workplaceName);
  for(const line of lines){
    const match=line.match(/^(?:(?:Job|Work)\s+)?Location\s*[:\-–]\s*(.+)$/i);if(!match)continue;
    let label=workplaceName(match[1].split(/\s+(?:Experience|Function|Employment Type|Education|Designation)\s*[:\-–]/i)[0]);
    // The native Runija role declares M.P. in its JD and Madhya Pradesh in
    // its India card. Preserve both raw locations; this alias only matches
    // a nonempty site in that same verified state.
    const mp=label.match(/^(.+?),\s*m(?:\.\s*p\.|p)(?:,\s*india)?$/);
    if(mp&&/[a-z]/.test(mp[1])&&places.includes('madhya pradesh'))label=mp[1]+', madhya pradesh';
    if(foreignCountryNames.some(country=>new RegExp('(?:^|[^a-z])'+escapePattern(country.toLowerCase())+'(?:$|[^a-z])','i').test(label))
      ||(label!=='india'&&!places.some(place=>new RegExp('(?:^|[^a-z])'+escapePattern(place)+'(?:$|[^a-z])','i').test(label))))throw error('explicit JD workplace conflicts with the verified native India workplace');
  }
};
const safeJobUrl = (value,id) => {
  try{const u=new URL(decode(value));if(u.protocol!=='https:'||!['in.linkedin.com','www.linkedin.com'].includes(u.hostname)||u.username||u.password||u.hash||!u.pathname.startsWith('/jobs/view/')||!u.pathname.endsWith('-'+id))throw error('foreign or inconsistent published job URL');u.search='';return u.href;}catch(e){if(e.failureKind)throw e;throw error('invalid published job URL')}
};
const allowedRequest = url => [CORPORATE_CAREERS_URL,BRAND_ALIAS_URL,LINKEDIN_PROFILE_URL,LINKEDIN_LISTING_URL].includes(url)
  || /^https:\/\/(?:in|www)\.linkedin\.com\/jobs\/view\/[^/?#]+-\d+$/.test(url);
export const fetchPublishedReNewText = async (url,{signal}={}) => {
  signal?.throwIfAborted();
  if(!allowedRequest(url))throw error('request left the verified employer/publication routes');
  const r=await fetch(url,{redirect:'error',headers:{Accept:'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'},signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(15000)])});
  if(!r.ok)throw Object.assign(new Error('HTTP '+r.status+' for '+url),{status:r.status,abortRetries:true});
  if(r.url!==url)throw error('redirect changed the current published authority');
  const body=await r.text();signal?.throwIfAborted();if(body.length>2_000_000)throw error('unbounded public response');return body;
};
export const verifyReNewAuthority = (authority,alias,profile) => {
  authority=publishedHtml(authority);alias=publishedHtml(alias);profile=publishedHtml(profile);
  if(!/<title>\s*Growth Opportunities \| Work With Us \| ReNew\s*<\/title>/i.test(authority)||!anchors(authority).some(a=>employerUrl(a.href)))throw error('current corporate careers page no longer publishes this employer');
  if(!/ReNew Power[^.]{0,500}rebrand[^.]{0,500}ReNew/i.test(text(alias)))throw error('first-party ReNew Power brand alias is not verified');
  const org=schemas(profile).filter(j=>j?.['@type']==='Organization');
  if(canonical(profile)!==LINKEDIN_PROFILE_URL||org.length!==1||org[0].name!=='ReNew'||!employerUrl(org[0].url))throw error('native company profile identity changed');
  let domain;try{domain=new URL(org[0].sameAs).hostname.replace(/^www\./,'')}catch{throw error('native company profile has no verified employer domain')}
  if(domain!=='renew.com')throw error('native employer website is foreign');
  const links=anchors(profile).filter(a=>{try{const u=new URL(a.href);return u.protocol==='https:'&&u.hostname==='www.linkedin.com'&&u.pathname==='/jobs/renew-jobs-worldwide'&&u.searchParams.get('f_C')==='2563081'}catch{return false}});
  if(!links.length)throw error('native company2563081 no longer publishes the pinned jobs feed');
};
export const readReNewLinkedInCards = html => {
  html=publishedHtml(html);
  if(canonical(html)!=='https://www.linkedin.com/jobs/renew-jobs-worldwide')throw error('current company feed canonical changed');
  const countText=html.match(/<span\b[^>]*class=["'][^"']*\bresults-context-header__job-count\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1];
  const total=Number(text(countText));if(!/^\d+$/.test(text(countText))||!Number.isSafeInteger(total)||total<0||total>200)throw error('native public subset count is missing or unbounded');
  const lists=[...html.matchAll(/<ul\b[^>]*class=["'][^"']*\bjobs-search__results-list\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi)];
  if(lists.length!==1)throw error('native company feed has no unique role list');
  const starts=[...lists[0][1].matchAll(/<div\b[^>]*data-entity-urn=["']urn:li:jobPosting:(\d+)["'][^>]*>/gi)];
  if(starts.length!==total||!/see-more-jobs__viewed-all/.test(html))throw error('native public subset is truncated; all advertised cards are required');
  const seen=new Set();return starts.map((m,i)=>{
    const block=lists[0][1].slice(m.index,starts[i+1]?.index??lists[0][1].length),id=m[1],numeric=Number(id);
    if(!Number.isSafeInteger(numeric)||numeric<=0||seen.has(String(numeric)))throw error('duplicate or unsafe native job identity');seen.add(String(numeric));
    const aa=anchors(block),jobLink=aa.find(a=>/\bbase-card__full-link\b/.test(a.class||'')),orgLink=aa.find(a=>a['data-tracking-control-name']==='public_jobs_jserp-result_job-search-card-subtitle');
    const title=text(block.match(/<h3\b[^>]*class=["'][^"']*\bbase-search-card__title\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1]),location=text(block.match(/<span\b[^>]*class=["'][^"']*\bjob-search-card__location\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]);
    const postingDate=block.match(/<time\b[^>]*datetime=["'](\d{4}-\d{2}-\d{2})["']/i)?.[1];
    if(!title||!location||!postingDate||!Number.isFinite(Date.parse(postingDate))||!orgLink||orgLink.text!=='ReNew'||!employerUrl(orgLink.href))throw error('malformed or foreign-employer native card');
    return{id:String(numeric),title,location,postingDate,sourceUrl:safeJobUrl(jobLink?.href,id)};
  });
};
export const readReNewLinkedInDetail = (html,card,checkedAt) => {
  html=publishedHtml(html);
  const title=text(html.match(/<h1\b[^>]*class=["'][^"']*\btop-card-layout__title\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]),location=text(html.match(/<span\b[^>]*class=["'][^"']*\btopcard__flavor--bullet\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]);
  const org=anchors(html).find(a=>a['data-tracking-control-name']==='public_jobs_topcard-org-name'),decorated=html.match(/<code\b[^>]*id=["']decoratedJobPostingId["'][^>]*>\s*"(\d+)"\s*<\/code>/)?.[1];
  if(canonical(html)!==card.sourceUrl||String(Number(decorated))!==card.id||title!==card.title||location!==card.location||org?.text!=='ReNew'||!employerUrl(org?.href))throw error('native detail identity, employer, or location disagrees with its published card');
  const all=schemas(html),jobs=all.filter(j=>j?.['@type']==='JobPosting');
  if(/No longer accepting applications|closed-job__flavor--closed/.test(html)){if(jobs.length>1)throw error('ambiguous closed native job schema');return null;}
  if(jobs.length!==1)throw error('active native JobPosting schema is missing or ambiguous');
  const job=jobs[0],address=job.jobLocation?.address;
  if(text(job.title)!==title||job.hiringOrganization?.name!=='ReNew'||!employerUrl(job.hiringOrganization?.sameAs))throw error('native hiringOrganization or title conflicts with the company card');
  const country=address?.addressCountry;
  if(!COUNTRY_CODES.has(country)||!address.addressLocality)throw error('native workplace country is unknown or missing');
  if([job.country,job.jobLocation?.country].some(v=>v!=null&&v!==country))throw error('contradictory direct and native workplace country');
  if(country!=='IN'){
    if(/,\s*India$/i.test(location))throw error('foreign native country conflicts with India card');
    return null;
  }
  const indianRegions=new Set('Andhra Pradesh|Arunachal Pradesh|Assam|Bihar|Chhattisgarh|Goa|Gujarat|Haryana|Himachal Pradesh|Jharkhand|Karnataka|Kerala|Madhya Pradesh|Maharashtra|Manipur|Meghalaya|Mizoram|Nagaland|Odisha|Punjab|Rajasthan|Sikkim|Tamil Nadu|Telangana|Tripura|Uttar Pradesh|Uttarakhand|West Bengal|Andaman and Nicobar Islands|Chandigarh|Dadra and Nagar Haveli and Daman and Diu|Delhi|Jammu and Kashmir|Ladakh|Lakshadweep|Puducherry'.split('|'));
  const parts=location.split(',').map(v=>v.trim()),locality=text(address.addressLocality);
  if(parts[0]!==locality||(parts.length>1&&(parts.at(-1)!=='India'||parts.length>3||(parts.length===3&&!indianRegions.has(parts[1]))))
    ||(address.addressRegion!=null&&(!indianRegions.has(address.addressRegion)||parts[1]!==address.addressRegion)))throw error('India schema conflicts with a foreign or unknown visible workplace');
  const posted=Date.parse(job.datePosted),closes=Date.parse(job.validThrough),at=Date.parse(checkedAt);
  if(!Number.isFinite(posted)||!Number.isFinite(closes)||!Number.isFinite(at)||posted>at||closes<=posted||job.datePosted.slice(0,10)!==card.postingDate)throw error('native job lifecycle is missing or contradictory');
  if(closes<=at)return null;
  const buttons=[...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)];
  if(!buttons.some(m=>(attrs(m[1])['data-modal']==='job-details-topcard-apply-modal'||['public_jobs_apply-link-simple_onsite','public_jobs_apply-link-onsite'].includes(attrs(m[1])['data-tracking-control-name']))&&/^Apply(?:\s|$)/.test(text(m[2]))))throw error('native active application control is missing');
  const description=text(job.description),visible=text(html.match(/<div\b[^>]*class=["'][^"']*\bshow-more-less-html__markup\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]);
  if(description.length<300||description!==visible)throw error('native full description is missing or conflicts with visible content');
  verifyExplicitJdWorkplace(job.description,location,address);
  return{jobId:card.id,requisitionId:job.identifier?.value||null,title,location,city:address.addressLocality,country:'India',sourceUrl:card.sourceUrl,applyUrl:card.sourceUrl,link:card.sourceUrl,employmentType:job.employmentType||null,jobDescription:description,postingDate:new Date(posted).toISOString(),closingDate:new Date(closes).toISOString(),department:null,requiredSkills:[],minimumQualification:null,preferredQualification:null,experienceRequired:null,sourceListingComplete:false,scrapedAt:checkedAt};
};
const unavailable = e => !(e instanceof SyntaxError)&&(/^(?:HTTP (?:403|408|429|500|502|503|504)\b)/.test(e?.message||'')||e?.name==='TimeoutError'||['ECONNRESET','ETIMEDOUT','EAI_AGAIN'].includes(e?.cause?.code));
export const runPublishedReNewPartial = async({fetchPublishedText=fetchPublishedReNewText,signal,now=()=>new Date().toISOString(),maxJobs=null,maxPages=null,source='renewpower',company='ReNew Power'}={})=>{
  for(const cap of [maxJobs,maxPages])if(cap!=null&&(!Number.isSafeInteger(cap)||cap<1))throw error('caller limit must be a positive integer');
  let requests=0;const read=async url=>{signal?.throwIfAborted();requests++;const html=await fetchPublishedText(url,{signal});signal?.throwIfAborted();return html;};
  const authority=await read(CORPORATE_CAREERS_URL),alias=await read(BRAND_ALIAS_URL),profile=await read(LINKEDIN_PROFILE_URL);verifyReNewAuthority(authority,alias,profile);
  const cards=readReNewLinkedInCards(await read(LINKEDIN_LISTING_URL)),checkedAt=now(),jobs=[];let denied=false,capped=false;
  for(const card of cards){
    let html;try{html=await read(card.sourceUrl)}catch(e){signal?.throwIfAborted();if(!unavailable(e))throw e;denied=true;break;}
    const job=readReNewLinkedInDetail(html,card,checkedAt);if(job)jobs.push({...job,source,company});
    if(maxJobs&&jobs.length>=maxJobs){capped=cards.at(-1)!==card;break;}
  }
  let snapshot;let snapshotUnavailable=false;
  try{snapshot=await read(LINKEDIN_LISTING_URL)}catch(e){signal?.throwIfAborted();if(!(denied&&!capped&&jobs.length>0&&unavailable(e)))throw e;snapshotUnavailable=true;}
  if(!snapshotUnavailable&&JSON.stringify(readReNewLinkedInCards(snapshot))!==JSON.stringify(cards))throw error('current company public subset changed during traversal');
  if(!jobs.length)throw error('no currently verified substantive India jobs; the primary inventory remains inaccessible');
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:LINKEDIN_LISTING_URL,firstParty:true,listingComplete:false,pagesFetched:requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:checkedAt,reason:'Employer-published LinkedIn subset only; primary careers.renew.com inventory is unenumerated (expired certificate verified on 2026-10-09) and employer inventory totals are unknown.'+(denied?' Native details became unavailable; verified rows retained.':'')+(snapshotUnavailable?' final-snapshot-unavailable.':'')+(capped?' Caller job limit reached.':'')});
};
