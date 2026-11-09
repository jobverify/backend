"""Independent, offline audit of Persistent raw HTTP captures and registered replay fields."""
from pathlib import Path
from collections import Counter
from html.parser import HTMLParser
import gzip
import hashlib
import json
import re
import os

ROOT = Path(__file__).resolve().parents[3]
CAPTURE = ROOT / 'artifacts/scraper-log-review-1b360f27/current-native/persistent-registered-native'
REPLAY = Path(os.environ.get('PERSISTENT_REPLAY_DIR', ROOT / 'artifacts/scraper-log-review-1b360f27/current-native/persistent-registered-replay-final-platform'))
metadata = json.loads((CAPTURE / 'persistent-responses.json').read_bytes())
summary = json.loads((REPLAY / 'persistent-summary.json').read_bytes())
jobs = json.loads(gzip.decompress((REPLAY / 'persistent-jobs.json.gz').read_bytes()))

class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
    def handle_data(self, data):
        self.parts.append(data)

def visible(html):
    parser = VisibleText()
    parser.feed(html or '')
    return ' '.join(' '.join(parser.parts).split()) or None

def normal(value):
    return ' '.join(str(value or '').split()) or None

bodies = {}
for item in metadata:
    raw = gzip.decompress((CAPTURE / item['bodyFile']).read_bytes())
    assert len(raw) == item['bytes'], item['id']
    assert hashlib.sha256(raw).hexdigest() == item['sha256'], item['id']
    if item['status'] == 200:
        try:
            bodies[item['id']] = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            pass

searches = [item for item in metadata if item['url'].endswith('/jobs/search') and item['status'] == 200]
assert len(searches) == 70
rows = [record['_source'] for item in searches for record in bodies[item['id']]['data']['data']]
assert len(rows) == len({r['id'] for r in rows}) == 622
assert all(r['companyId'] == 16344 and r['status'] == 1 and r['displayStatus'] == 'Open' for r in rows)
assert all(bodies[item['id']]['data']['totalCount'] == 622 for item in searches)
assert all(bodies[item['id']]['data']['facets']['Location'][0] == {'doc_count': 585, 'key': 'India'} for item in searches)
assert bodies[searches[-1]['id']]['data']['hasMoreData'] is False
assert json.loads(searches[-1]['requestBody']['filterCri'])['paginationStartNo'] == 621

company = next(body['reponseObject']['company'] for body in bodies.values() if isinstance(body, dict) and isinstance(body.get('reponseObject'), dict) and 'company' in body['reponseObject'])
assert company['id'] == 16344 and company['companyName'] == 'Persistent Systems'
assert company['careerSiteUrl'] == company['domainName'] == 'careers.persistent.com'
assert metadata[0]['url'] == 'https://www.persistent.com/careers/' and metadata[0]['finalUrl'] == 'https://careers.persistent.com/'

conflicts = []
for row in rows:
    countries = {loc['country'].strip() for loc in (row.get('jobLocationRecord') or []) if loc.get('country')}
    if countries and row['text1'] not in countries:
        conflicts.append({'nativePostingId': row['id'], 'jobCode': row['jobCode'], 'title': normal(row['jobTitle']), 'facetCountry': row['text1'], 'locationCountries': sorted(countries)})
assert {c['nativePostingId'] for c in conflicts} == {1113972, 1126958, 1128066}

successful_detail_items = [item for item in metadata if item['url'].endswith('/jobs-service/v1/jobs/careersite') and item['status'] == 200]
assert len(successful_detail_items) == 11
successful_req_items = [item for item in metadata if '/getReqFieldsForCareersSite/' in item['url'] and item['status'] == 200]
assert len(successful_req_items) == 9
raw_details = {str(bodies[item['id']]['id']): bodies[item['id']] for item in successful_detail_items}
raw_reqs = {item['url'].split('/')[-2]: bodies[item['id']]['reponseObject']['customDetails'] for item in successful_req_items}
row_by_id = {str(row['id']): row for row in rows}
assert all(visible(d['longDescription']) == visible(d['jobConfigurationData']['Description']) for d in raw_details.values())
assert all('Posted On' not in d['jobConfigurationData'] for d in raw_details.values())
assert all(not row.get('longDescription') and not row.get('jobConfigurationData') and row.get('reqFieldsAndValues') is None for row in rows)
assert all(row.get('mediumDescriptionWithoutHtml') and row.get('shortDescriptionWithoutHtml') for row in rows)

checks = []
assert {job['nativePostingId'] for job in jobs} == {'1061575', '1061623'}
for job in jobs:
    posting_id = job['nativePostingId']
    detail, listing, req = raw_details[posting_id], row_by_id[posting_id], raw_reqs[posting_id]
    fields = detail['jobConfigurationData']
    assert job['company'] == 'Persistent Systems' and job['country'] == 'India'
    assert listing['text1'] == 'India' and all(loc['country'] == 'India' for loc in listing['jobLocationRecord'])
    assert job['jobId'] == str(detail['jobCode']) == str(listing['jobCode'])
    assert job['nativeReferenceNumber'] == detail['referenceNumber'] == listing['referenceNumber']
    assert job['title'] == normal(detail['jobTitle']) == normal(listing['jobTitle'])
    assert job['location'] == visible(fields['Location']) == normal(listing['location'])
    assert job['jobDescriptionHtml'] == fields['Description']
    assert job['jobDescription'] == visible(fields['Description']) and req == {}
    assert job['sourceNativeDescriptionSha256'] == hashlib.sha256(fields['Description'].encode()).hexdigest()
    assert job['requiredSkills'] == [s.strip() for s in fields['Skills Required'].split(',')]
    assert job['experienceRequired'] == re.sub(r'\s+to\s+', '-', fields['Years Of Exp'], flags=re.I)
    assert job['sourceNativeDetailAttributes'] == {key: value for key, value in fields.items() if key != 'Description'}
    assert job['sourceNativeRequisitionAttributes'] == req
    assert job['sourceNativeDisplayedLocation'] == visible(fields['Location'])
    assert job['sourceCountryEvidence']['countryCodes'] == ['IN']
    assert job['sourceNativeExpiryEvidence'] == [] and job['sourceNativeExpired'] is False and job['sourceNativeExpiryUnresolved'] is False
    assert job['sourceNativeBinding']['additionalScopes'] == []
    assert job['postingDate'] is None and job['sourcePublicationDateUnavailable'] is True
    assert job['requisitionId'] is None and job['closingDate'] is None
    assert job['sourceDetailComplete'] is True
    assert job['sourceListingComplete'] is False and job['sourceScopeComplete'] is False and job['lifecycleCleanupAllowed'] is False
    assert job['sourceUrl'] == job['applyUrl'] == f"https://careers.persistent.com/jobview/{listing['jobUrl']}?id={posting_id}"
    checks.append({'nativePostingId': posting_id, 'title': job['title'], 'fullDescriptionCharacters': len(job['jobDescription']), 'explicitCountry': 'India', 'postingDate': None, 'requisitionId': None, 'allRetainedFieldsMatchRawNative': True, 'displayedGeographyMatchesTypedIndia': True, 'nativeExpiryNotExposed': True, 'unaccountedActiveScopesInCapturedShell': 0})

assert summary['atsPlatform'] == 'zwayam' and summary['runtimePlatformValues'] == ['zwayam']
assert all(job['atsPlatform'] == 'zwayam' for job in jobs)
assert summary['providerOverrideSha256'] == hashlib.sha256((ROOT / 'jobverify-backend/scraper-support/providers/providerExtensions/zzzz-persistent-native-20261026.json').read_bytes()).hexdigest()
assert summary['codeSha256'] == hashlib.sha256((ROOT / 'jobverify-backend/scraper/persistent/script.js').read_bytes()).hexdigest()
assert summary['inventoryEvidence']['status'] == 'coverage-gap' and summary['proof']['closingStable'] is False
assert summary['proof']['detailsUnattempted'] == 612 and summary['networkRequests'] == 0
first_denial = next(item for item in metadata if item['status'] != 200)
assert first_denial['id'] == 94 and first_denial['status'] == 403
assert metadata[-1]['url'].endswith('/jobs/search') and metadata[-1]['status'] == 403

report = {
    'verificationKind': 'independent-offline-raw-source-field-audit',
    'source': 'persistent', 'codeSha256': summary['codeSha256'], 'providerOverrideSha256': summary['providerOverrideSha256'], 'atsPlatform': summary['atsPlatform'], 'pass': True,
    'originalLiveAttempt': {
        'captureStartedAt': metadata[0]['capturedAt'], 'captureEndedAt': metadata[-1]['capturedAt'],
        'completeInventoryEstablished': False, 'finalCodeFreshLiveRun': False,
        'rawResponsesVerified': len(metadata), 'statusCounts': dict(Counter(item['status'] for item in metadata)),
        'initialPages': 70, 'nativeTotal': 622, 'nativeIndiaFacet': 585,
        'nativeCountryFacetValues': dict(Counter(row['text1'] for row in rows)),
        'successfulDetailBodies': 11, 'successfulVisibleRequisitionBodies': 9,
        'firstDeniedResponse': first_denial, 'closingSearchStatus': 403,
        'limitation': 'Original live implementation continued requests after access denial; final code adds immediate sequential circuit-breaking and preserves partial verified rows. No further live probes occurred.'
    },
    'countryContradictions': conflicts,
    'searchDescriptionAuthority': 'All622 search records expose medium/short descriptions only; no full longDescription or visible jobConfigurationData and no populated reqFieldsAndValues.',
    'registeredFinalCodeOfflineReplay': {
        'rowsRetained': 2, 'fullIndiaDetails': 2, 'originalPublicationDates': 0,
        'detailBodiesRead': 10, 'visibleRequisitionBodiesRead': 9, 'unattemptedDetailsAfterDenial': 612,
        'nativeCountryUnknownOrConflicting': 3, 'classifiedIndiaRecords': 584,
        'closingStable': False, 'inventoryStatus': 'coverage-gap', 'networkRequests': 0,
        'fieldChecks': checks
    }
}
(REPLAY / 'persistent-independent-field-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'pass': True, 'rawResponseHashesVerified': len(metadata), 'sourceFieldsAudited': len(checks), 'countryContradictions': len(conflicts), 'codeSha256': summary['codeSha256'], 'providerOverrideSha256': summary['providerOverrideSha256'], 'atsPlatform': summary['atsPlatform']}))
