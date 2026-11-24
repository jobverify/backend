import {createHash} from 'node:crypto'
import {readNativeDocument,decodeNativeEntities,readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {nativeDate} from '../../scraper-support/native-sources/declaredAshby/nativeData.js'
import {NATIVE_INDIA_LOCATION} from '../../scraper-support/utils/greenhouseLocations.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {need} from './currentFacts20261120.js'
export const HOME='https://www.datafold.com/careers/',BOARD='https://jobs.ashbyhq.com/datafold',API='https://api.ashbyhq.com/posting-api/job-board/datafold'
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const sha=value=>createHash('sha256').update(value).digest('hex'),has=(value,key)=>Object.hasOwn(value,key),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const keys=(value,names)=>value&&typeof value==='object'&&!Array.isArray(value)&&same(Object.keys(value).sort(),[...names].sort())
const shape=(value,names,message)=>need(keys(value,names.split(' ')),message),originalJSON=text=>readLiteralModel(text).value

// Existing source-specific native feed, team, original criteria, salary and
// explicit work/applicant-country guards, preserved from the archived source.
// The old corporate/bootstrap/renderer/security-profile pins are not imported.
const feedKeys='id title department team employmentType location secondaryLocations publishedAt isListed isRemote workplaceType address jobUrl applyUrl descriptionHtml descriptionPlain'
const briefKeys='id title teamId locationId locationName workplaceType employmentType secondaryLocations compensationTierSummary __typename'
const postingKeys='id title departmentName departmentExternalName locationName locationAddress workplaceType employmentType descriptionHtml isListed isConfidential teamNames secondaryLocationNames compensationTierSummary compensationTiers applicationDeadline compensationTierGuideUrl scrapeableCompensationSalarySummary compensationPhilosophyHtml applicationLimitCalloutHtml shouldAskForTextingConsent shouldAskForWhatsAppConsent candidateTextingPrivacyPolicyUrl candidateTextingTermsAndConditionsUrl legalEntityNameForTextingConsent automatedProcessingLegalNotice __typename'
export function readFeed(packet){
 const feed=originalJSON(packet.text)
 shape(feed,'jobs apiVersion','Incomplete/changed public feed envelope, pagination or error')
 need(feed.apiVersion==='1'&&Array.isArray(feed.jobs)&&feed.jobs.length<=6,'Public feed count/version bound')
 const ids=new Set()
 for(const job of feed.jobs){
  shape(job,feedKeys,'Unreviewed public job fields')
  need(typeof job.id==='string'&&UUID.test(job.id)&&!ids.has(job.id)&&job.isListed===true,'Duplicate/malformed/unlisted public role')
  ids.add(job.id)
  need(job.jobUrl===BOARD+'/'+job.id&&job.applyUrl===job.jobUrl+'/application','Public own/application URL changed')
 }
 return feed
}

export function readBoard(native,feed){
 const board=native.model.jobBoard
 shape(board,'stealthAccess teams jobPostings __typename','Unreviewed native board/termination model')
 need(board.__typename==='JobBoard'&&board.stealthAccess===false&&Array.isArray(board.teams)&&Array.isArray(board.jobPostings)
  &&board.jobPostings.length===feed.jobs.length,'Stealth/incomplete or mismatched native board count')
 const teams=new Map(),ids=new Set()
 for(const team of board.teams){
  shape(team,'id name externalName parentTeamId __typename','Unreviewed native team model')
  need(UUID.test(team.id)&&!teams.has(team.id)&&typeof team.name==='string'&&team.name.length>0
   &&(team.externalName===null||typeof team.externalName==='string')&&(team.parentTeamId===null||UUID.test(team.parentTeamId))&&team.__typename==='Team','Invalid/duplicate team forest')
  teams.set(team.id,team)
 }
 for(const team of teams.values()){
  const ancestors=new Set([team.id]);let parent=team.parentTeamId
  while(parent!==null){need(teams.has(parent)&&!ancestors.has(parent),'Orphan or cyclic team would omit native cards');ancestors.add(parent);parent=teams.get(parent).parentTeamId}
 }
 for(const brief of board.jobPostings){
  shape(brief,briefKeys,'Unreviewed native card fields')
  need(UUID.test(brief.id)&&!ids.has(brief.id)&&teams.has(brief.teamId)&&UUID.test(brief.locationId)&&brief.__typename==='JobPostingBriefsWithIdsAndTeamId','Missing/duplicate/orphan native card')
  ids.add(brief.id)
 }
 need(feed.jobs.every(record=>ids.has(record.id)),'Native board/API unique IDs disagree')
 return board
}

// USA is explicitly published as ISO3 in every original address and applicant
// model; it is not a country inferred from Remote or an American city.
export const publishedCountry=value=>typeof value==='string'?(value==='USA'?'United States':nativeCountryName(value)):null
function addressCountries(address,country){
 for(const[key,value]of Object.entries(address)){
  if(key==='@type'||key==='addressCountry')continue
  need(value===null||typeof value==='string','Unreviewed nested country/address value')
  if(typeof value!=='string')continue
  need(!/\bIndia(?:n)?\b/i.test(decodeNativeEntities(value)),'Contradictory explicit written address country')
  writtenCountries(decodeNativeEntities(value),country)
  for(const component of value.split(/[,;|/()[\]]|\s+[-–—]\s+/u)){
   const label=component.trim(),explicit=label.length>2?publishedCountry(label):null
   need(!explicit||explicit===country,'Contradictory explicit written address country')
  }
 }
}

const countryLabels=(()=>{
 const display=new Intl.DisplayNames(['en'],{type:'region'}),result=new Set()
 for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
  const code=String.fromCharCode(a,b),name=display.of(code)
  if(name!==code&&name.length>2&&nativeCountryName(name))result.add(name)
 }
 return [...result].sort((a,b)=>b.length-a.length)
})()
function writtenCountries(authored,country){
 // A supported Indian city is a reason to withhold this zero-only contract;
 // it never changes a native country or creates an India-positive record.
 need(!NATIVE_INDIA_LOCATION.test(authored),'Explicit India/city eligibility scope unresolved')
 for(const label of countryLabels){
  if(nativeCountryName(label)===country)continue
  const expression=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  need(!new RegExp('(?:^|[^\\p{L}])'+expression+'(?=$|[^\\p{L}])','iu').test(authored),'Additional written country/eligibility scope unresolved')
 }
}

const authoredBlocks=new Set(['p','div','section','article','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','table','tr','th','td','dl','dt','dd'])
const authoredTags=new Set(['root',...authoredBlocks,'br','strong','b','em','i','u','s','span','code','small','sup','sub','a'])
// Join authored inline text directly and retain block/BR boundaries. Country
// checks must see Ind<span>ia</span> exactly as a word. This projection never
// changes the original HTML/JSON, and never executes source markup or scripts.
function authoredText(html,nativePlain=false){
 need(typeof html==='string','Unreviewed authored text channel')
 for(const match of html.matchAll(/<([a-z][^\s/>]*)\s+([^>]*)>/gi)){
  const seen=new Set()
  for(const[name]of readNativeAttributeTokens(match[2])){
   need(!seen.has(name),'Duplicate authored eligibility attribute');seen.add(name)
  }
 }
 const doc=readNativeDocument(html)
 const walk=node=>{
  need(!node.inert&&!node.nativeTagUnqualified&&authoredTags.has(node.tag),'Unreviewed authored criteria carrier/visibility')
  for(const[name,value]of Object.entries(node.attrs)){
   const style=node.tag==='p'||node.tag==='ul'?'min-height:1.5em':
    node.tag==='div'?'min-height:1.2em;margin-top:0px;margin-bottom:0px':null
   need(name==='style'&&style!==null&&value===style
    ||node.tag==='a'&&(name==='href'&&typeof value==='string'||name==='target'&&value==='_blank'
     ||name==='rel'&&value==='noopener noreferrer nofollow'),
   'Unreviewed authored criteria/eligibility carrier/style/attribute')
  }
  if(node.tag==='br')return '\n'
  let text=node.children.map(child=>typeof child==='string'?decodeNativeEntities(child):walk(child)).join('')
  // These three native plaintext presentation rules are demonstrated by both
  // actual full descriptions. Case remains exact everywhere outside headings;
  // list markers and link targets are added rather than erased from criteria.
  if(nativePlain&&/^h[1-6]$/.test(node.tag))text=text.toUpperCase()
  if(nativePlain&&node.tag==='li')text=' - '+text
  if(node.tag==='a'){
   need(typeof node.attrs.href==='string','Unreviewed authored link target')
   text+=' '+node.attrs.href
  }
  return (authoredBlocks.has(node.tag)?'\n':'')+text+(authoredBlocks.has(node.tag)?'\n':'')
 }
 return walk(doc.nodes(node=>node.tag==='root')[0])
}
const layoutText=text=>text.normalize('NFC').replace(/\s+/gu,' ').trim()
function geography(posting,record,brief,schema){
 need(Array.isArray(record.secondaryLocations)&&!record.secondaryLocations.length&&Array.isArray(brief.secondaryLocations)&&!brief.secondaryLocations.length
  &&Array.isArray(posting.secondaryLocationNames)&&!posting.secondaryLocationNames.length,'Additional or unknown work-country scope')
 shape(record.address,'postalAddress','Unreviewed native address wrapper')
 shape(record.address.postalAddress,'addressCountry addressRegion addressLocality','Unreviewed native work-country model')
 shape(schema.jobLocation,'@type address','Unreviewed native schema location model')
 shape(schema.jobLocation.address,'@type addressLocality addressRegion addressCountry','Unreviewed native schema address model')
 need(schema.jobLocation['@type']==='Place'&&schema.jobLocation.address['@type']==='PostalAddress'&&posting.locationAddress===null,'Additional/nested own location scope')
 const country=publishedCountry(record.address.postalAddress.addressCountry)
 need(country&&country!=='India'&&publishedCountry(schema.jobLocation.address.addressCountry)===country
  &&publishedCountry(record.location)===country&&publishedCountry(posting.locationName)===country
  &&brief.locationName===record.location,'Explicit work-country disagreement or unresolved country')
 shape(schema.applicantLocationRequirements,'@type name','Unreviewed applicant-country model')
 need(schema.applicantLocationRequirements['@type']==='Country'&&publishedCountry(schema.applicantLocationRequirements.name)===country,'Applicant-country disagreement/unknown')
 addressCountries(record.address.postalAddress,country);addressCountries(schema.jobLocation.address,country)
 return country
}

function supplements(posting,schema){
 need(Array.isArray(posting.compensationTiers),'Unreviewed compensation tier collection')
 const ids=new Set()
 for(const tier of posting.compensationTiers){
  shape(tier,'id title tierSummary __typename','Unreviewed compensation tier fields')
  need(UUID.test(tier.id)&&!ids.has(tier.id)&&tier.__typename==='JobPostingCompensationTiers'
   &&(tier.title===null||typeof tier.title==='string')&&typeof tier.tierSummary==='string'&&tier.tierSummary.length>0,'Invalid/ambiguous compensation tier')
  ids.add(tier.id)
 }
 // These current nulls are retained as unknown, never replaced by defaults.
 for(const key of ['applicationDeadline','compensationTierGuideUrl','applicationLimitCalloutHtml','candidateTextingPrivacyPolicyUrl','candidateTextingTermsAndConditionsUrl','automatedProcessingLegalNotice'])
  need(posting[key]===null,'Unreviewed authored notice/deadline/application supplement: '+key)
 need(posting.shouldAskForTextingConsent===false&&posting.shouldAskForWhatsAppConsent===false&&posting.legalEntityNameForTextingConsent==='Datafold','Unreviewed consent model')
 need(posting.compensationPhilosophyHtml===null||typeof posting.compensationPhilosophyHtml==='string','Unreviewed compensation philosophy')
 if(posting.compensationTierSummary===null){
  need(!posting.compensationTiers.length&&posting.scrapeableCompensationSalarySummary===null&&!has(schema,'baseSalary'),'Unreconciled salary supplements')
 }else{
  need(typeof posting.compensationTierSummary==='string'&&posting.compensationTiers.length===1&&posting.compensationTiers[0].title===null,'Unreviewed compensation summary model')
  const salary=schema.baseSalary
  shape(salary,'@type currency value','Unreviewed salary structure')
  shape(salary.value,'@type minValue maxValue unitText','Unreviewed salary interval')
  need(salary['@type']==='MonetaryAmount'&&salary.currency==='USD'&&salary.value['@type']==='QuantitativeValue'&&salary.value.unitText==='YEAR'
   &&Number.isFinite(salary.value.minValue)&&Number.isFinite(salary.value.maxValue)&&salary.value.minValue>0&&salary.value.maxValue>=salary.value.minValue,'Invalid/foreign salary interval')
  // Exact reviewed presentation. Numeric endpoints are checked independently;
  // no punctuation/whitespace erasure can hide an authored condition.
  const match=/^\$([0-9]+)K – \$([0-9]+)K • Offers Equity • Offers Commission$/u.exec(posting.compensationTierSummary)
  need(match&&Number(match[1])*1000===salary.value.minValue&&Number(match[2])*1000===salary.value.maxValue,'Native salary summary/interval disagreement')
  const tier=posting.compensationTiers[0].tierSummary
  const tierMatch=/^Base \(OTE \$([0-9]+)K–\$([0-9]+)K, uncapped commission\) /u.exec(tier)
  need(tierMatch&&tier.endsWith(posting.compensationTierSummary)
   &&posting.scrapeableCompensationSalarySummary===`$${match[1]}K - $${match[2]}K`,'Unreviewed or contradictory native compensation terms')
  const describedOTE=[...posting.descriptionHtml.matchAll(/\$([0-9]+)K–\$([0-9]+)K OTE/gu)]
  const describedBase=[...posting.descriptionHtml.matchAll(/\bBase \$([0-9]+)K–\$([0-9]+)K\./gu)]
  need(describedOTE.length===1&&describedBase.length===1&&describedOTE[0][1]===tierMatch[1]&&describedOTE[0][2]===tierMatch[2]
   &&describedBase[0][1]===match[1]&&describedBase[0][2]===match[2],'Native compensation/full description disagreement')
 }
 return {nativeCompensationTiers:posting.compensationTiers,nativeCompensationPhilosophyHTML:posting.compensationPhilosophyHtml,
  nativeCompensationTierSummary:posting.compensationTierSummary,nativeSalary:schema.baseSalary??null,nativeDeadline:posting.applicationDeadline,
  nativeApplicationLimitHTML:posting.applicationLimitCalloutHtml,nativeAutomatedProcessingLegalNotice:posting.automatedProcessingLegalNotice,
  nativeTextingConsentLegalName:posting.legalEntityNameForTextingConsent}
}

export function readRole(native,record,brief,board,now){
 const posting=native.model.posting,schema=native.schemas[0],org=native.model.organization
 shape(posting,postingKeys,'Unreviewed own-role fields')
 const schemaKeys='@context @type title description directApply identifier datePosted hiringOrganization jobLocation employmentType jobLocationType applicantLocationRequirements'+(has(schema,'baseSalary')?' baseSalary':'')
 shape(schema,schemaKeys,'Unreviewed own JobPosting fields')
 need(posting.id===record.id&&posting.__typename==='JobPostingDetails'&&posting.isListed===true&&posting.isConfidential===false&&native.model.jobBoard===null,'Own role availability/identity changed')
 shape(schema.identifier,'@type name value','Unreviewed native role identifier')
 need(schema['@context']==='https://schema.org/'&&schema['@type']==='JobPosting'&&schema.directApply===true
  &&schema.identifier['@type']==='PropertyValue'&&schema.identifier.name==='Datafold'&&schema.identifier.value===record.id,'Original JobPosting role identity changed')
 need(typeof record.title==='string'&&record.title.length>0&&posting.title===record.title&&schema.title===record.title&&brief.title===record.title
  &&native.title===record.title+' @ Datafold','Native title identity disagreement')
 shape(schema.hiringOrganization,'@type name sameAs logo','Unreviewed hiring employer model')
 need(schema.hiringOrganization['@type']==='Organization'&&schema.hiringOrganization.name==='Datafold'
  &&schema.hiringOrganization.sameAs==='https://www.datafold.com'&&schema.hiringOrganization.logo===org.theme.logoSquareImageUrl,'Native employer/public website disagreement')
 const team=board.teams.find(value=>value.id===brief.teamId)
 need(team&&posting.departmentName===team.name&&posting.departmentExternalName===(team.externalName??team.name)
  &&record.department===team.name&&Array.isArray(posting.teamNames)&&same(posting.teamNames,[team.name]),'Native role/team forest correspondence changed')
 need(typeof posting.descriptionHtml==='string'&&posting.descriptionHtml.length>100&&posting.descriptionHtml===record.descriptionHtml
  &&schema.description===posting.descriptionHtml&&typeof record.descriptionPlain==='string'&&record.descriptionPlain.length>100,'Full original description disagreement')
 const projectedPlain=authoredText(posting.descriptionHtml,true)
 need(layoutText(projectedPlain)===layoutText(record.descriptionPlain),'Native plain/full HTML material criteria disagreement')
 const country=geography(posting,record,brief,schema)
 need(nativeDate(record.publishedAt)&&schema.datePosted===record.publishedAt.slice(0,10)&&Date.parse(record.publishedAt)<=Date.parse(now),'Invalid/contradictory native publication date')
 need(posting.workplaceType==='Remote'&&record.workplaceType==='Remote'&&brief.workplaceType==='Remote'&&record.isRemote===true
  &&schema.jobLocationType==='TELECOMMUTE','Native work-mode disagreement or unknown')
 need(posting.employmentType==='FullTime'&&record.employmentType==='FullTime'&&brief.employmentType==='FullTime'&&schema.employmentType==='FULL_TIME','Native employment-type disagreement')
 need(same(posting.compensationTierSummary,brief.compensationTierSummary),'List/detail compensation disagreement')
 const extra=supplements(posting,schema)
 const authored=[posting.descriptionHtml,record.descriptionPlain,posting.title,posting.departmentName,posting.departmentExternalName,
  posting.compensationPhilosophyHtml??'',posting.compensationTierSummary??'',...posting.compensationTiers.flatMap(tier=>[tier.title??'',tier.tierSummary])]
  .map(value=>authoredText(value)).join('\n')
 need(!/\b(?:India(?:n)?|worldwide|anywhere\s+in\s+the\s+world)\b/i.test(authored),'Additional written India/global eligibility scope unresolved')
 writtenCountries(authored,country)
 return {id:record.id,url:record.jobUrl,title:record.title,country,nativeEmployer:schema.hiringOrganization,
  nativeDatePosted:record.publishedAt,nativeSchemaDatePosted:schema.datePosted,nativeRemoteStatus:posting.workplaceType,
  descriptionHTML:posting.descriptionHtml,descriptionHTMLSHA256:sha(posting.descriptionHtml),originalDescriptionPlain:record.descriptionPlain,
  nativePlainDescriptionReconciled:true,nativePlainProjection:'Published heading uppercase, per-LI marker and own anchor target; NFC/layout whitespace only; all other case, punctuation, numeric values and word boundaries exact.',
  ...extra,originalNativePosting:posting,originalPublicRecord:record,originalSchema:schema,originalNativeJSON:native.rawJSON,
  originalJobPostingJSON:native.rawSchema[0],originalOwnHTML:native.originalHTML,originalWorkCountryModel:record.address,
  originalApplicantRequirements:schema.applicantLocationRequirements,originalHTMLSHA256:native.htmlSHA256,
  applicationVisited:false,screeningCriteriaAcquired:false,publisherLegalNameRegistryVerified:false}
}
