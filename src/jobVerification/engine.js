import { fetchPublic } from './safeFetch.js';
import { readJobPage, suspiciousRequests } from './content.js';
import { atsIdentity, atsTenant, normalizeJobUrl, redactText, redactUrl, registrableDomain, sameVacancyUrl, tenantKey, verificationRequestUrl } from './urls.js';
import { isAggregateHiringSignalJob } from '../utils/jobListingEvidence.js';

const PHASES = ['destination', 'employer', 'vacancy', 'risk'];
const HTML_LIMIT = 2_000_000;
const SHARED_DOMAINS = new Set(['linkedin.com', 'indeed.com', 'greenhouse.io', 'lever.co', 'myworkdayjobs.com', 'ashbyhq.com', 'smartrecruiters.com', 'workable.com', 'jobverify.in']);
const normalizedName = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const successful = response => response?.status === 200;
const urlsOf = job => [job?.sourceUrl, job?.applyUrl, job?.sourceAvailability?.canonicalUrl].filter(Boolean);

function candidateFor(candidates, url, page, company, submittedUrl = url) {
  candidates = candidates.filter(job => !job.applicationUrlIsGeneric && !isAggregateHiringSignalJob(job));
  const submittedIdentity = atsIdentity(url);
  if (submittedIdentity) return candidates.find(job => urlsOf(job).some(known => sameVacancyUrl(known, url)))
    || candidates.find(job => urlsOf(job).some(known => tenantKey(atsIdentity(known)) === tenantKey(submittedIdentity)));
  if (atsTenant(url)) return undefined;
  const urls = [url, submittedUrl, ...page.links];
  return candidates.find(job => urlsOf(job).some(known => urls.some(value => sameVacancyUrl(known, value))))
    || candidates.find(job => page.roleIds.some(id => [job.jobId, job.requisitionId].filter(Boolean).map(String).includes(id))
      && normalizedName(company || page.company) === normalizedName(job.company));
}

function officialTarget(job, url, page) {
  const identity = atsIdentity(url);
  if (identity && urlsOf(job).some(known => tenantKey(atsIdentity(known)) === tenantKey(identity))) return url;
  return urlsOf(job).find(known => [url, ...page.links].some(value => sameVacancyUrl(known, value))) || job.sourceUrl || job.applyUrl;
}

async function employerRelationship(job, target, fetchPage, signal) {
  const domain = registrableDomain(job.companyDomain || '');
  if (!domain || SHARED_DOMAINS.has(domain)) return { bound: false, sourceUrl: redactUrl(target), detail: 'An independently associated employer domain is not available in the source records.' };
  const knownCareer = job.companyCareerPage;
  const start = knownCareer && registrableDomain(knownCareer) === domain ? knownCareer : `https://${domain}/`;
  let response = await fetchPage(start, { signal, maxBytes: HTML_LIMIT });
  if (!successful(response) || new URL(response.url).protocol !== 'https:' || registrableDomain(response.url) !== domain) return { bound: false, sourceUrl: redactUrl(start), detail: 'The employer career site could not be refreshed over HTTPS and associated with this destination.' };
  let page = readJobPage(response.body, response.url);
  if (page.blocked) return { bound: false, sourceUrl: redactUrl(start), detail: 'The employer site requires an interactive visit; its relationship to this posting is unconfirmed.' };
  if (registrableDomain(target) === domain) return { bound: true, sourceUrl: redactUrl(response.url), observedAt: response.observedAt,
    detail: `The recorded employer career site and vacancy are both on ${domain}.`, excerpt: page.text.slice(0, 300) };
  const targetIdentity = atsIdentity(target);
  const linksToTarget = links => links.some(link => targetIdentity ? tenantKey(atsTenant(link)) === tenantKey(targetIdentity) : sameVacancyUrl(link, target));
  if (!linksToTarget(page.links)) {
    const careers = page.links.find(link => registrableDomain(link) === domain && /\/(?:careers?|jobs|join-us|work-with-us)(?:[/?-]|$)/i.test(new URL(link).pathname));
    if (careers && careers !== response.url) {
      response = await fetchPage(careers, { signal, maxBytes: HTML_LIMIT });
      if (successful(response) && new URL(response.url).protocol === 'https:' && registrableDomain(response.url) === domain) page = readJobPage(response.body, response.url);
      else return { bound: false, sourceUrl: redactUrl(response.url), detail: 'The linked employer careers page could not be securely associated with the recorded domain.' };
    }
  }
  const bound = !page.blocked && linksToTarget(page.links);
  return { bound, sourceUrl: redactUrl(response.url), observedAt: response.observedAt,
    detail: bound ? `The employer's ${domain} website links to this ${targetIdentity?.provider || 'application'} destination.`
      : `No employer-to-posting link was found on the checked ${domain} career site. This is inconclusive.`,
    excerpt: bound ? page.links.filter(link => targetIdentity ? tenantKey(atsTenant(link)) === tenantKey(targetIdentity) : sameVacancyUrl(link, target)).join('\n') : page.text.slice(0, 300) };
}

async function currentVacancy(job, target, fetchPage, signal, existingResponse, now) {
  if (new URL(target).protocol !== 'https:') return { available: 'unknown', proven: false, sourceUrl: target, detail: 'An HTTP-only vacancy cannot provide authenticated official-source evidence. Check the employer directly for an HTTPS posting.' };
  const identity = atsIdentity(target);
  let response, data, page;
  if (identity) {
    const { provider, region, tenant, roleId } = identity;
    const api = provider === 'lever'
      ? `https://api${region === 'eu' ? '.eu' : ''}.lever.co/v0/postings/${encodeURIComponent(tenant)}/${encodeURIComponent(roleId)}`
      : `https://boards-api${region === 'eu' ? '.eu' : ''}.greenhouse.io/v1/boards/${encodeURIComponent(tenant)}/jobs/${encodeURIComponent(roleId)}`;
    response = await fetchPage(api, { signal, accept: 'application/json' });
    if (normalizeJobUrl(response.url) !== normalizeJobUrl(api)) return { available: 'unknown', proven: false, sourceUrl: response.url, detail: 'The vacancy endpoint redirected away from the expected provider, tenant, or role address. It cannot establish this vacancy.' };
    if ([404, 410].includes(response.status)) {
      const recorded = urlsOf(job).some(value => sameVacancyUrl(value, target));
      return { available: recorded ? 'closed' : 'unknown', proven: recorded, sourceUrl: api, observedAt: response.observedAt,
        detail: recorded ? 'The previously recorded role is no longer published by the official job endpoint.' : `Vacancy ${roleId} was not found at the ${provider} job API. It may be removed or the link may be incorrect; this does not prove fraud.` };
    }
    if (!successful(response)) return { available: 'unknown', proven: false, sourceUrl: api, detail: 'The official job endpoint could not be refreshed.' };
    try { data = JSON.parse(response.body); } catch { return { available: 'unknown', proven: false, sourceUrl: api, detail: 'The official endpoint did not return a readable vacancy.' }; }
    if (String(data.id) !== roleId) return { available: 'unknown', proven: false, sourceUrl: api, detail: 'The returned vacancy identifier does not match the requested role.' };
    return { available: 'open', proven: true, sourceUrl: api, observedAt: response.observedAt, title: data.text || data.title,
      text: readJobPage(data.descriptionPlain || data.description || data.content || '', api).text,
      detail: `The ${provider} job API currently publishes vacancy ${roleId} for job board ${tenant}.`, excerpt: `${data.text || data.title} · Requisition ${roleId}` };
  }
  response = existingResponse && (sameVacancyUrl(existingResponse.url, target) || existingResponse.redirects?.some(hop => sameVacancyUrl(hop.from, target))) ? existingResponse : await fetchPage(target, { signal, maxBytes: HTML_LIMIT });
  const sameAddress = sameVacancyUrl(response.url, target);
  if (!sameAddress && [404, 410].includes(response.status)) return { available: 'unknown', proven: false, sourceUrl: response.url, detail: 'The recorded vacancy redirected to a different address, which cannot establish its identity or availability.' };
  if ([404, 410].includes(response.status)) return { available: 'closed', proven: urlsOf(job).some(value => sameVacancyUrl(value, target)), sourceUrl: target, detail: 'The recorded role URL no longer publishes this vacancy (HTTP 404/410).' };
  if (!successful(response)) return { available: 'unknown', proven: false, sourceUrl: target, detail: 'The exact official vacancy could not be refreshed at its recorded address.' };
  page = readJobPage(response.body, response.url);
  const exactRecordedUrl = urlsOf(job).some(value => sameVacancyUrl(value, target));
  const recordedIds = [job.jobId, job.requisitionId].filter(Boolean).map(String);
  const matchedStructuredId = page.roleIds.find(id => recordedIds.includes(id));
  const idMatch = Boolean(matchedStructuredId);
  const titleMatches = normalizedName(page.title).includes(normalizedName(job.title)) && normalizedName(job.title).length > 5;
  const canonicalId = new URL(response.url).searchParams.get('gh_jid');
  const employerDomain = registrableDomain(job.companyDomain || '');
  const canonicalIdentity = employerDomain && new URL(response.url).protocol === 'https:' && registrableDomain(response.url) === employerDomain
    && titleMatches && (!canonicalId || recordedIds.includes(canonicalId))
    && (idMatch || !page.roleIds.length && canonicalId && new URL(response.url).pathname.split('/').includes(canonicalId));
  const proven = !page.blocked && page.text.length >= 60 && exactRecordedUrl && (sameAddress || canonicalIdentity) && (idMatch || !page.roleIds.length && titleMatches);
  const matchedId = matchedStructuredId || (recordedIds.includes(canonicalId) ? canonicalId : '');
  const expired = page.validThrough && Number.isFinite(Date.parse(page.validThrough)) && Date.parse(page.validThrough) < now().getTime();
  return { available: proven ? expired ? 'closed' : 'open' : 'unknown', proven, sourceUrl: response.url, observedAt: response.observedAt,
    officialUrl: response.url, title: page.title, detail: proven ? `The live page matches the recorded employer vacancy${!sameAddress ? ` after a same-employer redirect with matching vacancy ID ${matchedId}` : ' URL and vacancy details'}.${expired ? ` The employer-published expiration date is ${page.validThrough}.` : ''}` : 'The page did not establish the identity of the recorded vacancy.',
    excerpt: `${!sameAddress && proven ? `Matched vacancy ID: ${matchedId}\n` : ''}${page.text.slice(0, 420)}` };
}

export function summarizeReport(report) {
  const complete = report.evidence.filter(item => item.status === 'completed');
  const threat = complete.some(item => item.outcome === 'threat');
  const caution = complete.some(item => item.outcome === 'caution');
  report.risk = threat ? 'high' : caution ? 'caution' : 'unknown';
  report.verdict = threat ? 'high_risk' : report.sourceStatus === 'official' ? 'official' : report.sourceStatus === 'third_party' ? 'matching' : caution ? 'caution' : 'inconclusive';
  report.coverage = { completed: complete.length, unavailable: report.evidence.filter(item => item.status === 'unavailable').length, total: report.evidence.length };
  const priority = item => item.outcome === 'threat' && item.status === 'completed' ? 0 : item.outcome === 'caution' && item.status === 'completed' ? 1
    : item.id === 'vacancy' ? 2 : item.id === 'employer' ? 3 : item.id === 'suffix' ? 4 : item.status === 'unavailable' ? 5 : 6;
  report.reasons = [...report.evidence].sort((a, b) => priority(a) - priority(b))
    .slice(0, 3).map(item => ({ evidenceId: item.id, text: item.detail }));
  return report;
}

export async function investigateJob(input, { fetchPage = fetchPublic, findCandidates, checkRisk = async () => [], prepareSources, onProgress = async () => {}, signal, now = () => new Date() } = {}) {
  const url = verificationRequestUrl(input.url);
  const report = { status: 'running', phase: 'destination', verdict: 'inconclusive', sourceStatus: 'unconfirmed', availability: 'unknown',
    submittedUrl: redactUrl(url), finalUrl: null, officialUrl: null, title: '', company: '', evidence: [], reasons: [], completedPhases: [] };
  const add = (id, phase, title, detail, sourceUrl, { status = 'completed', outcome = 'neutral', excerpt, observedAt } = {}) => {
    const item = { id, phase, title: redactText(title, 150), status, outcome, detail: redactText(detail), sourceUrl: redactUrl(sourceUrl) || redactUrl(url), observedAt: observedAt || now().toISOString(),
      ...(excerpt ? { excerpt: redactText(excerpt) } : {}) };
    report.evidence = [...report.evidence.filter(value => value.id !== id), item];
  };
  let progress = Promise.resolve();
  const emit = async phase => {
    report.phase = phase;
    const snapshot = structuredClone(summarizeReport(report));
    progress = progress.then(() => onProgress(snapshot));
    await progress; signal?.throwIfAborted();
  };
  let page = readJobPage('', url), response, candidate, target;
  let apiPosting;
  let destinations = [url];
  let domainIdentityReady = true;
  try {
    if (prepareSources) {
      try { await prepareSources({ signal }); }
      catch { domainIdentityReady = false; add('suffix', 'employer', 'Domain identity data', 'The Public Suffix List is unavailable. Domain relationships cannot be confirmed.', 'https://publicsuffix.org/list/public_suffix_list.dat', { status: 'unavailable' }); }
    }
    await emit('destination');
    try {
      response = await fetchPage(url, { signal, maxBytes: HTML_LIMIT });
      destinations.push(...(response.redirects || []).flatMap(hop => [hop.from, hop.to]), response.url);
      report.finalUrl = redactUrl(response.url);
      page = readJobPage(response.body, response.url);
      add('destination', 'destination', 'Link destination', `The link resolves to ${new URL(response.url).hostname} (HTTP ${response.status}).`, response.url,
        { status: successful(response) && !page.blocked ? 'completed' : 'unavailable', excerpt: response.redirects?.map(hop => `${redactUrl(hop.from)} → ${redactUrl(hop.to)}`).join('\n') });
    } catch (error) { add('destination', 'destination', 'Link destination', error.message || 'The destination is unavailable.', url, { status: 'unavailable' }); }
    report.completedPhases.push('destination');
    await emit('employer');
    const candidates = await findCandidates({ urls: [url, report.finalUrl, ...page.links].filter(Boolean), roleIds: page.roleIds, company: input.company || page.company });
    const identityUrl = atsIdentity(url) ? url : report.finalUrl || url;
    candidate = candidateFor(candidates, identityUrl, page, input.company, url);
    const redirectedFromRole = atsIdentity(url) && report.finalUrl && !sameVacancyUrl(url, report.finalUrl);
    report.title = redactText((redirectedFromRole ? '' : page.title) || input.title, 200);
    report.company = redactText(page.company || input.company || candidate?.company, 200);
    if (candidate && !domainIdentityReady) add('employer', 'employer', 'Employer relationship', 'Current domain identity data is unavailable. The employer relationship remains unconfirmed.', candidate.companyCareerPage || url, { status: 'unavailable' });
    else if (candidate) {
      target = officialTarget(candidate, identityUrl, page);
      try {
        const relationship = await employerRelationship(candidate, target, fetchPage, signal);
        add('employer', 'employer', 'Employer relationship', relationship.detail, relationship.sourceUrl, { outcome: relationship.bound ? 'supporting' : 'neutral', excerpt: relationship.excerpt, observedAt: relationship.observedAt });
        if (relationship.bound) report.employerBound = true;
      } catch { add('employer', 'employer', 'Employer relationship', 'The employer source could not be refreshed. Its relationship to this vacancy remains unconfirmed.', candidate.companyCareerPage || target, { status: 'unavailable' }); }
    } else add('employer', 'employer', 'Employer relationship', 'No exact role identity or associated employer source was found in the checked records. A title or name match alone is insufficient.', url);
    report.completedPhases.push('employer');
    await emit('vacancy');
    const vacancyTarget = target || (atsIdentity(identityUrl) ? identityUrl : null);
    if (vacancyTarget && (report.employerBound || atsIdentity(vacancyTarget))) {
      try {
        const vacancy = await currentVacancy(candidate || {}, vacancyTarget, fetchPage, signal, response, now);
        if (vacancy.proven && vacancy.text) apiPosting = { text: vacancy.text, sourceUrl: vacancy.sourceUrl };
        const bound = Boolean(report.employerBound);
        add('vacancy', 'vacancy', 'Official vacancy', `${vacancy.detail}${vacancy.proven && !bound ? ' Its employer relationship remains unconfirmed.' : ''}`, vacancy.sourceUrl, { outcome: vacancy.proven && bound ? 'supporting' : 'neutral', status: vacancy.proven ? 'completed' : 'unavailable', excerpt: vacancy.excerpt, observedAt: vacancy.observedAt });
        report.availability = vacancy.available;
        if (vacancy.proven) report.title = redactText(vacancy.title || candidate?.title || report.title, 200);
        const confirmedFinal = sameVacancyUrl(report.finalUrl || url, vacancy.officialUrl || target);
        const unexpectedAtsRedirect = atsIdentity(url) && !confirmedFinal;
        if (vacancy.proven && bound && unexpectedAtsRedirect) {
          add('publisher_redirect', 'destination', 'Unexpected job-link redirect', `The submitted role link redirects to ${new URL(report.finalUrl || url).hostname} instead of the verified vacancy. The final publisher is unconfirmed.`, report.finalUrl || url, { outcome: 'caution' });
        } else if (vacancy.proven && bound) {
          report.sourceStatus = confirmedFinal ? 'official' : 'third_party';
          report.officialUrl = redactUrl(vacancy.officialUrl || target);
          report.title = redactText(vacancy.title || candidate.title, 200);
          report.company = redactText(candidate.company, 200);
        }
      } catch { add('vacancy', 'vacancy', 'Official vacancy', 'The exact vacancy could not be refreshed. Current availability is unknown.', vacancyTarget, { status: 'unavailable' }); }
    } else add('vacancy', 'vacancy', 'Official vacancy', 'An official vacancy cannot be confirmed until the role identity and employer relationship are established.', target || url, { status: 'unavailable' });
    report.completedPhases.push('vacancy');
    await emit('risk');
    if (destinations.some(value => new URL(value).protocol === 'http:')) add('http_transport', 'risk', 'Unencrypted destination', 'The submitted link or a redirect uses HTTP. Its content can be altered in transit; obtain an HTTPS vacancy directly from the employer.', destinations.find(value => new URL(value).protocol === 'http:'), { outcome: 'caution' });
    const riskTargets = [...new Map(destinations.map(value => [new URL(value).hostname, value])).values()];
    await Promise.all(riskTargets.map(async (riskUrl, index) => {
      const host = new URL(riskUrl).hostname;
      try {
        const risks = await checkRisk(riskUrl, { signal, now });
        for (const risk of risks) add(riskTargets.length === 1 ? risk.id : `${risk.id}_${index}`, 'risk', risk.title,
          `${risk.detail} Checked host: ${host}.`, risk.sourceUrl, { ...risk, excerpt: [risk.excerpt, `Checked destination: ${redactUrl(riskUrl)}`].filter(Boolean).join('\n') });
      } catch { add(`risk_${index}`, 'risk', 'Destination risk checks', `Risk sources for ${host} were unavailable. This is not proof of safety.`, riskUrl, { status: 'unavailable' }); }
      await emit('risk');
    }));
    const postingSources = [
      ...(response && page.text && !page.blocked ? [{ text: page.text, sourceUrl: report.finalUrl || url }] : []),
      ...(apiPosting ? [apiPosting] : []),
    ];
    if (!postingSources.length) add('scam_patterns', 'risk', 'Requests in the posting', 'No readable posting text was available to check for suspicious requests.', report.finalUrl || url, { status: 'unavailable' });
    for (const [index, posting] of postingSources.entries()) {
      const suspicious = suspiciousRequests(posting.text);
      if (index > 0 && !suspicious.length) continue;
      add(index ? 'scam_patterns_api' : 'scam_patterns', 'risk', 'Requests in the posting', suspicious.length
        ? `${suspicious.map(item => item.detail).join(' ')} Verify these requests with the employer; wording alone does not prove fraud.`
        : 'No configured payment or off-platform request pattern was detected in the accessible text; this does not establish safety.', posting.sourceUrl,
      { outcome: suspicious.length ? 'caution' : 'neutral', excerpt: suspicious.map(item => `${item.title}: ${item.excerpt}`).join('\n') });
    }
    if (candidate?.companyDomain) {
      const actual = registrableDomain(report.finalUrl || url), expected = registrableDomain(candidate.companyDomain);
      const brand = expected?.split('.')[0];
      if (actual && expected && actual !== expected && brand?.length >= 4 && actual.includes(brand) && !atsIdentity(report.finalUrl || url)) {
        add('lookalike', 'risk', 'Domain similarity', `The submitted domain ${actual} contains the employer name but differs from its recorded ${expected} domain. Verify the relationship directly.`, report.finalUrl || url, { outcome: 'caution' });
      }
    }
    report.completedPhases.push('risk');
  } catch {
    for (const phase of PHASES.filter(value => !report.completedPhases.includes(value))) add(`incomplete_${phase}`, phase, 'Check incomplete', 'The investigation deadline or a source failure prevented this check from completing. Completed evidence is retained.', target || url, { status: 'unavailable' });
  }
  report.status = 'completed'; report.phase = 'completed';
  summarizeReport(report);
  await onProgress(structuredClone(report));
  return report;
}
