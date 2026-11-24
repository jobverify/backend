import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js';
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js';
import {hasSourceDescription} from '../../src/utils/jobSourceContent.js';
import {readHyperscienceFormContract} from './currentFormContract.js';
import {C0,C1,A,H,UUID,sha,need,exactFields,ownArray,plainSnapshot,shape,readRawPacket,rawJSON,
  documentEntries,originalText,layout,authoredCharacters,authoredProjection,readNativePacket} from './currentProgrammeRenderer.js';

const API_FIELDS=['id','title','department','team','employmentType','location','secondaryLocations','publishedAt','isListed','isRemote','workplaceType','address','jobUrl','applyUrl','descriptionHtml','descriptionPlain'];
const POSTING_FIELDS=['id','title','departmentName','departmentExternalName','locationName','locationAddress','workplaceType','employmentType','descriptionHtml','isListed','isConfidential','teamNames','secondaryLocationNames','compensationTierSummary','compensationTiers','applicationDeadline','compensationTierGuideUrl','scrapeableCompensationSalarySummary','compensationPhilosophyHtml','applicationLimitCalloutHtml','shouldAskForTextingConsent','shouldAskForWhatsAppConsent','candidateTextingPrivacyPolicyUrl','candidateTextingTermsAndConditionsUrl','legalEntityNameForTextingConsent','automatedProcessingLegalNotice','__typename'];
const LD_FIELDS=['@context','@type','title','description','directApply','identifier','datePosted','hiringOrganization','jobLocation','employmentType','jobLocationType','applicantLocationRequirements'];
// Retain the existing reviewed native work-address/display models independently of dynamic titles/criteria.
const WORK_ADDRESSES={'United States':{addressRegion:'Utah',addressCountry:'United States',addressLocality:'Park City'},Bulgaria:{addressRegion:'Sofia City Province',addressCountry:'Bulgaria',addressLocality:'Sofia'}};
const PUBLISHER_PROFILES={"WebSite":"5bbcb7bb5548a2c61db7292a06f77955dda682ebfd46238bb3c85977e41c4b72","Organization":"865c9a2bed6a179a425a50a1f6b58cd62ab1dc9a9f1dfba668f86a592a4a2e89"};
// Closed reviewed complete authored families; inventory IDs, order and N remain dynamic.
const isActive=entry=>!entry.node.inert&&!entry.node.nativeTagUnqualified&&!entry.ancestors.some(n=>n.inert||n.nativeTagUnqualified||['svg','math','template','noscript','object'].includes(n.tag));
const hiring=/\b(?:careers?|jobs?|vacanc(?:y|ies)|openings?|open\s+positions?|hiring|apply|talent\s+community|join\s+(?:our|the)\s+team|load\s+more)\b/i;
const ATS=/ashbyhq|greenhouse|lever\.co|workdayjobs|smartrecruiters|icims|recruit|\/(?:careers?|jobs?|openings?|positions?)(?:[/?#]|$)|\/vacanc/i;

const APPROVED_RECRUITMENT_TEXT={"C0":["Careers","Join the Team","Hyperscience has always been a remote culture, focused on employing the best people wherever they are in the world. Because of that, we have focused on inclusive and flexible interview practices to make it possible for all candidates to bring their best to conversations with our teams.","All of our interviews can be virtual, at your request. While we do like to meet in person when possible and safe, it’s not required to get through our interview process.","Our interview process is designed to get to know you, so we can mutually evaluate if it’s the right fit. Video conferencing helps with that, we do encourage you to turn video on and get to know our Hiring Managers and team!","We’ve tailored our onboarding process to set you up for success, ensuring a sense of community from the moment your new hire class starts. Our curriculum is self-serve, and is set up for you to choose the pace and focus you need as you start your career with us.","We provide flexible PTO globally, in addition to complying with all local regulations. We have a strong culture of supporting employees to take the time they need.","We provide 3 months of paid parental leave to all employees, with an additional 1 month for the birthing parent. Where required by law, we offer plans that comply with all local regulations.","Benefits are offered where applicable and where required by law, and are subject to change at any time at Hyperscience’s sole discretion.","Join Our Team","We are an equal opportunity employer. We welcome people of different backgrounds, experiences, abilities and perspectives. Qualified applicants will receive consideration for employment without regard to race, color, religion, sex, national origin, sexual orientation, gender identity, disability or protected veteran status.","If you’ve got drive, we’ve got jobs. We’re building a world-class company with the ethos of a small start-up."],"C1":["Careers","Open Positions","Join the Hyperscience Talent Community and our hiring team will proactively review your profile against upcoming roles.","Hyperscience is growing fast, and our talent needs evolve every day. By joining our Talent Community, we’ll keep you in mind for upcoming opportunities and reach out the moment a match opens up.","Join the Talent Community"]};
// Additional authored vacancy/eligibility channels cannot disappear from the
// corporate projection merely because their markup or JSON MIME differs.
const roleType=/(?:^|[/#:])JobPosting$/i;
const roleField=/^(?:qualifications|experienceRequirements|educationRequirements|skills|applicantLocationRequirements|jobLocation|jobLocationType|hiringOrganization|validThrough|directApply|baseSalary)$/i;
const closure=/\b(?:applications?|vacancies|openings|positions|jobs|recruitment|hiring)\b[^.!?]{0,120}\b(?:closed|paused|suspended|filled|cancelled|canceled|frozen|freeze|no\s+longer\s+(?:open|available|accepted))\b|\b(?:not|no\s+longer)\s+accepting\b[^.!?]{0,100}\bapplications?\b|\b(?:no|zero)\s+(?:(?:current|open|available)\s+)?(?:vacancies|openings|positions|jobs)\b/i;
function corporateCarriers(items){
  for(const {node,ancestors}of items){
    const attrs=node.attrs;
    for(const name of ['itemtype','typeof']){
      for(const type of decodeNativeEntities(attrs[name]??'').split(/\s+/))
        need(!roleType.test(type),'corporate-programme','Additional structured corporate vacancy publication');
    }
    for(const name of ['itemprop','property','data-field','data-schema-field']){
      for(const field of decodeNativeEntities(attrs[name]??'').split(/\s+/))
        need(!roleField.test(field.split(/[/#:]/).at(-1)),'corporate-programme','Additional unbound corporate role criterion');
    }
    if(node.tag==='script'&&(/json/i.test(attrs.type??'')||['[','{'].includes((node.raw??'').trimStart()[0]))){
      // Read every JSON string token, including escaped values and duplicate
      // keys. This rejection scan grants no execution or JSON-record authority.
      for(const match of (node.raw??'').matchAll(/"(?:\\.|[^"\\])*"/g)){
        let value;try{value=JSON.parse(match[0])}catch{continue;}
        need(!roleType.test(value)&&!roleField.test(value),'corporate-programme','Additional structured native recruitment data');
      }
    }
    if(![node,...ancestors].some(n=>['script','style','svg','math'].includes(n.tag))){
      need(!closure.test(layout(decodeNativeEntities(originalText(node)))),'corporate-programme','Corporate recruitment availability or closure changed');
    }
    if(['iframe','object','embed'].includes(node.tag)){
      const value=decodeNativeEntities(Object.values(attrs).join(' '));
      need(!ATS.test(value)&&!hiring.test(value)&&!/\bJobPosting\b/i.test(value)&&!closure.test(value),'corporate-programme','Additional embedded hiring programme');
    }
    if(['noscript','template'].includes(node.tag)){
      const value=decodeNativeEntities(node.raw??'');
      need(!ATS.test(value)&&!/\bJobPosting\b/i.test(value)&&!closure.test(value),'corporate-programme','Additional inert native recruitment publication');
    }
  }
}
function corporateGrammar(packet,kind,jobs){
  const entries=documentEntries(packet.text).entries;
  const keyword=/\b(?:applications?|careers?|jobs?|vacanc(?:y|ies)|openings?|open\s+positions?|hiring|apply|talent\s+community|join\s+(?:our|the)\s+team|applicants?|candidates?|eligib\w*|requirements?|required|must|certification|India|Indian|worldwide|anywhere|globally)\b/i;
  const recruitmentContext=[];
  for(const entry of entries){
    const {node,ancestors}=entry;
    for(const[key,value]of Object.entries(node.attrs)){
      need(!/^data-(?:country|location|eligibility|applicant|condition|requirement|filter)/i.test(key),'corporate-programme','Unbound corporate eligibility/filter carrier');
      if(key==='itemprop')need(!/\b(?:qualifications|experienceRequirements|applicantLocationRequirements|jobLocation|hiringOrganization)\b/i.test(value),'corporate-programme','New unbound corporate criteria/schema field');
    }
    if([node,...ancestors].some(n=>['script','style','svg','math'].includes(n.tag)||n.attrs.class==='job-opening'))continue;
    const text=layout(node.children.filter(n=>typeof n==='string').map(n=>originalText(n)).join(' '));
    if(!keyword.test(text))continue;
    need(APPROVED_RECRUITMENT_TEXT[kind].includes(text),'corporate-programme','New authored corporate recruitment or eligibility instruction');
    recruitmentContext.push({text,active:isActive(entry)});
  }
  if(kind==='C1'){
    const archives=entries.filter(e=>e.node.attrs.class==='posts-archive');
    need(archives.length===1&&isActive(archives[0]),'corporate-programme','Unique active native positions container required');
    shape(archives[0].node.attrs,['class'],'corporate-programme');
    const children=archives[0].node.children;
    need(children.every(n=>typeof n==='string'?layout(n)==='':n.tag==='a'&&n.attrs.class==='job-opening'&&jobs.some(j=>j.id===n.attrs.id)),'corporate-programme','Unaccounted positions-container content');
  }
  return {profile:'semantic-authored-recruitment-publication',recruitmentContext,rawEntityRetained:true,
    bodyBytes:packet.bytes.length,bodySHA256:sha(packet.bytes),
    qualification:'Original corporate entities retained; active publisher, declarations, complete typed cards and explicit authored recruitment instructions bind data. Styles, telemetry, unrelated copy and browser execution are not authority or equivalence proofs.'};
}

function readCorporate(record,kind,jobs){
  const packet=readRawPacket(record,kind==='C0'?C0:C1,kind),parsed=documentEntries(packet.text),items=parsed.entries;
  const visible=readVisibleNativeDocument(packet.text,{strict:true});
  const canonical=items.filter(e=>e.node.tag==='link'&&e.node.attrs.rel==='canonical');
  need(canonical.length===1&&isActive(canonical[0])&&canonical[0].node.attrs.href===(kind==='C0'?C0:C1),'corporate','Unique original corporate canonical required');
  const title=items.filter(e=>e.node.tag==='title');
  need(title.length===1&&isActive(title[0])&&title[0].node.raw===(kind==='C0'?'Careers at Hyperscience - Remote, Inclusive, Flexible':'Open Positions - Jobs at Hyperscience'),'corporate','Corporate title/identity changed');
  corporateCarriers(items);
  const schemas=items.filter(e=>e.node.tag==='script'&&(e.node.attrs.type??'').split(';')[0].trim().toLowerCase()==='application/ld+json');
  need(schemas.length===1&&isActive(schemas[0]),'corporate','Unique active corporate publisher schema required');
  const schema=rawJSON(schemas[0].node.raw),graph=schema['@graph'];
  shape(schema,['@context','@graph'],'corporate');need(schema['@context']==='https://schema.org'&&Array.isArray(graph),'corporate','Unknown corporate publisher envelope');
  need(graph.length===(kind==='C0'?4:5)&&graph.every(g=>['WebPage','BreadcrumbList','WebSite','Organization','ImageObject'].includes(g['@type'])),'corporate-programme','Unknown declared corporate schema/programme');
  for(const type of ['WebSite','Organization']){const rows=graph.filter(g=>g['@type']===type);need(rows.length===1&&sha(JSON.stringify(rows[0]))===PUBLISHER_PROFILES[type],'corporate','Full original publisher metadata changed');}
  const anchors=items.filter(e=>e.node.tag==='a'),declarations=[],ownURLs=[],cards=[];let intakeCount=0,entryCount=0;
  const visibleAnchors=visible.nodes(n=>n.tag==='a');
  for(const entry of anchors){
    const node=entry.node,attrs=node.attrs,label=originalText(node),href=attrs.href??'';
    const relevant=ATS.test(href)||hiring.test(label+' '+Object.values(attrs).join(' '));
    if(!relevant)continue;
    for(const value of [href,label,...Object.values(attrs)])authoredCharacters(value);
    let url;try{url=new URL(href,kind==='C0'?C0:C1).href;}catch{need(false,'corporate-programme','Malformed recruitment declaration');}
    declarations.push({attributes:{...attrs},label,literalHref:href,resolvedURL:url,ancestorTags:entry.ancestors.map(n=>n.tag),active:isActive(entry)});
    const own=/^https:\/\/jobs\.ashbyhq\.com\/hyperscience\/([a-f0-9-]{36})$/.exec(href);
    if(url===C0||url===C1){
      need(isActive(entry)&&visibleAnchors.some(a=>a.attrs.href===href&&layout(originalText(a))===layout(label)),'corporate','Current career handoff hidden/inert');
      if(kind==='C0'&&url===C1)entryCount++;continue;
    }
    if(kind==='C1'&&href===H){need(isActive(entry)&&layout(label)==='Join the Talent Community'&&visibleAnchors.some(a=>a.attrs.href===H),'corporate-programme','Original separately advertised intake changed');intakeCount++;continue;}
    need(kind==='C1'&&own&&UUID.test(own[1])&&isActive(entry)&&visibleAnchors.some(a=>a.attrs.href===href),'corporate-programme','Additional/hidden/unbound recruiting programme');
    shape(attrs,['href','target','class','id','data-title','data-track-ga'],'corporate-programme');
    need(attrs.class==='job-opening'&&attrs.id===own[1]&&attrs.target==='_blank'&&attrs['data-track-ga']==='true','corporate-programme','Unknown original vacancy card');
    const job=jobs.find(j=>j.id===own[1]);need(job,'membership','Corporate advert not in full native programme');
    for(const value of [job.title,job.location,job.department,job.team,job.employmentType])need(typeof value==='string'&&value.length>0&&!/[<>&"'\x60]/.test(value),'corporate-programme','Unreviewed raw card scalar/attribute grammar');
    const descendants=items.filter(e=>e.ancestors.includes(node));
    const find=(tag,cls)=>descendants.filter(e=>e.node.tag===tag&&e.node.attrs.class===cls);
    const get=(tag,cls)=>{const rows=find(tag,cls);need(rows.length===1&&isActive(rows[0]),'corporate-programme','Unknown vacancy card fields');shape(rows[0].node.attrs,['class'],'corporate-programme');return originalText(rows[0].node);};
    need(descendants.length===8&&descendants.every(e=>isActive(e)&&['p','div','h3','span'].includes(e.node.tag)),'corporate-programme','Unknown extra authored vacancy card criterion');
    for(const entry of descendants)shape(entry.node.attrs,['class'],'corporate-programme');
    need(attrs['data-title']==='Open position - '+job.title&&get('h3','title')===job.title&&get('p','location')===job.location
      &&get('span','department-team')===job.department+' - '+job.team&&get('span','commitment')===job.employmentType
      &&get('p','apply-text')==='Apply for this Job ->','corporate-programme','Corporate/native authored vacancy metadata disagrees');
    const expected=layout(job.location+' '+job.title+' '+job.department+' - '+job.team+' / '+job.employmentType+' Apply for this Job ->');
    need(layout(label)===expected,'corporate-programme','Unknown whole vacancy card text');
    ownURLs.push(href);cards.push({id:own[1],url:href,attributes:{...attrs},originalDescendantText:label});
  }
  need(kind==='C0'?entryCount===2:ownURLs.length===jobs.length&&new Set(ownURLs).size===jobs.length&&intakeCount===1,'membership','Current whole corporate/native programme membership incomplete');
  need(!items.some(e=>['form','select','input','textarea'].includes(e.node.tag)),'corporate-programme','New unpublished filter/input/programme control');
  for(const entry of items.filter(e=>['iframe','object','embed'].includes(e.node.tag)))need(!ATS.test(Object.values(entry.node.attrs).join(' ')),'corporate-programme','Additional embedded hiring programme');
  // Raw-text/inert contexts cannot grant a declaration; an explicit new hiring
  // link within them is still a contradiction, not silently ignored.
  for(const entry of items.filter(e=>e.node.tag==='noscript'))need(!/<a\b[\s\S]*(?:ashbyhq|careers|jobs|hiring|openings)/i.test(entry.node.raw??''),'corporate-programme','Additional inert recruiting declaration');
  const rawGrammar=corporateGrammar(packet,kind,jobs);
  return {packet,schema,originalTitle:title[0].node.raw,declarations,ownURLs,cards,rawGrammar,publisherBrand:'Hyperscience',legalRegistryQualified:false};
}

export function readInitialHyperscienceCorporate(record,kind){
  need(kind==='C0'||kind==='C1','corporate','Known corporate channel required');
  const packet=readRawPacket(record,kind==='C0'?C0:C1,kind),entries=documentEntries(packet.text).entries;
  const jobs=kind==='C0'?[]:entries.filter(e=>e.node.tag==='a'&&e.node.attrs.class==='job-opening').map(entry=>{
    const attrs=entry.node.attrs,descendants=entries.filter(e=>e.ancestors.includes(entry.node));
    const field=(tag,cls)=>{const values=descendants.filter(e=>e.node.tag===tag&&e.node.attrs.class===cls);need(values.length===1,'corporate-programme','Unique complete card field required');return originalText(values[0].node);};
    const title=field('h3','title'),parts=field('span','department-team').split(' - ');
    need(parts.length===2&&parts.every(v=>typeof v==='string'&&v.length>0),'corporate-programme','Unambiguous native department/team required');
    return{id:attrs.id,url:attrs.href,title,department:parts[0],team:parts[1],location:field('p','location'),employmentType:field('span','commitment')};
  });
  need(kind==='C0'||jobs.length>=1&&jobs.length<=6,'membership','Bounded nonempty current corporate positions required');
  const publication=readCorporate(record,kind,jobs);
  return{packet:publication.packet,cards:jobs,publication};
}
export function hyperscienceCorporateComparison(model){
  const p=model.publication;
  return{title:p.originalTitle,publisher:p.schema['@graph'].filter(v=>['WebSite','Organization'].includes(v['@type'])),
    declarations:p.declarations.map(({literalHref,resolvedURL,label,active})=>({literalHref,resolvedURL,label,active})).sort((a,b)=>a.resolvedURL.localeCompare(b.resolvedURL)||a.label.localeCompare(b.label)),
    cards:model.cards.toSorted((a,b)=>a.id.localeCompare(b.id)),recruitmentContext:p.rawGrammar.recruitmentContext};
}

function geography(text){
  authoredCharacters(text);
  need(!/\b(?:India|Indian|Bengaluru|Bangalore|Karnataka|Hyderabad|Chennai|Mumbai|Pune|Gurugram|Noida|New Delhi)\b/i.test(text),'geography','Possible India work/applicant geography');
  need(!/\bwork\s+(?:country|location)\s*:/i.test(text),'geography','New explicit work metadata is unreviewed');
  need(!/\b(?:applicants?|candidates?|employees?|you|team members?)\s+(?:may|can|must|are\s+eligible\s+to)\s+(?:work|apply|reside|be based)\b/i.test(text),'geography','New explicit authored work/applicant eligibility requires qualification');
  need(!/\b(?:applicants?|candidates?|employees?|you|team members?)\s+(?:may|can|must|are\s+eligible\s+to)\s+(?:work|apply|reside|be based)[^.!?]{0,120}\b(?:any\s+(?:country|location)|globally|worldwide|anywhere)\b/i.test(text)
    &&!/\b(?:remote\s+)?work\s+(?:is\s+available|may\s+be\s+performed|from)[^.!?]{0,120}\b(?:any\s+(?:country|location)|globally|worldwide|anywhere)\b/i.test(text)
    &&!/\b(?:position|role|job|employee|you)\s+(?:is|are|must be)\s+(?:based|located|resident)\s+(?:in|at)\s+/i.test(text),'geography','Unknown authored work/applicant geography');
}

function workCountry(api,native,ld){
  shape(api.address,['postalAddress'],'country');const address=api.address.postalAddress;
  shape(address,['addressRegion','addressCountry','addressLocality'],'country');
  need(['United States','Bulgaria'].includes(address.addressCountry)&&[address.addressLocality,address.addressRegion].every(v=>typeof v==='string'&&v.length>0),'country','Explicit reviewed primary native country required');
  shape(ld.jobLocation,['@type','address'],'country');shape(ld.jobLocation.address,['@type','addressLocality','addressRegion','addressCountry'],'country');
  need(ld.jobLocation['@type']==='Place'&&ld.jobLocation.address['@type']==='PostalAddress','country','Unknown own published location');
  for(const key of ['addressCountry','addressLocality','addressRegion'])need(ld.jobLocation.address[key]===address[key],'country','Published work address representations disagree');
  shape(ld.applicantLocationRequirements,['@type','name'],'country');
  need(ld.applicantLocationRequirements['@type']==='Country'&&ld.applicantLocationRequirements.name===address.addressCountry,'country','Published applicant country unknown/contradictory');
  need(native.locationAddress===null&&Array.isArray(api.secondaryLocations)&&api.secondaryLocations.length===0&&Array.isArray(native.secondaryLocationNames)&&native.secondaryLocationNames.length===0,'country','Unreviewed additional/native-address country scope');
  for(const value of Object.values(address))authoredCharacters(value);
  need(Object.entries(WORK_ADDRESSES[address.addressCountry]).every(([key,value])=>address[key]===value),'country','Native work-address/display model requires review');
  const titleCountry=/\(\s*(UK|United Kingdom|India|United States|Bulgaria)\s*\)\s*$/.exec(api.title)?.[1];
  if(titleCountry)need((titleCountry==='UK'?'United Kingdom':titleCountry)===address.addressCountry,'country','Explicit per-role country label conflicts with typed own work country');
  const expected=address.addressCountry==='United States'?'[Remote] US':'[Hybrid] Sofia, Bulgaria';
  need(api.location===expected&&native.locationName===api.location,'country','Explicit primary native label contradicts reviewed typed country');
  return address.addressCountry;
}

function salary(native,ld){
  const summary=native.compensationTierSummary,tiers=native.compensationTiers;
  need(Array.isArray(tiers),'salary','Complete native compensation tiers required');
  if(summary===null){need(tiers.length===0&&native.scrapeableCompensationSalarySummary===null&&native.compensationPhilosophyHtml===null&&!Object.hasOwn(ld,'baseSalary'),'salary','Explicit null salary and actual absence changed');return null;}
  need(typeof summary==='string'&&tiers.length===1,'salary','Unknown full compensation model');
  authoredCharacters(summary);
  const match=/^(\$|€)([0-9]+(?:\.[0-9])?)K – (\$|€)([0-9]+(?:\.[0-9])?)K( • Offers Equity)( • Offers Commission)?$/.exec(summary);
  need(match&&match[1]===match[3],'salary','Unknown source-specific decimalK/currency/punctuation');
  const amount=value=>{const parts=value.split('.');return Number(parts[0])*1000+Number(parts[1]??0)*100;};
  const minValue=amount(match[2]),maxValue=amount(match[4]),currency=match[1]==='$'?'USD':'EUR';
  need(Number.isSafeInteger(minValue)&&Number.isSafeInteger(maxValue)&&minValue>0&&maxValue>=minValue&&maxValue<=1000000000,'salary','Unreviewed numeric salary range');
  need(native.scrapeableCompensationSalarySummary===match[1]+match[2]+'K - '+match[3]+match[4]+'K','salary','Plain/native salary original differs');
  const tier=tiers[0];shape(tier,['id','title','tierSummary','__typename'],'salary');
  need(UUID.test(tier.id)&&tier.title===null&&tier.__typename==='JobPostingCompensationTiers'&&['','Estimated Base ','Base Salary '].some(prefix=>tier.tierSummary===prefix+summary),'salary','Full original tier criterion differs');
  shape(ld.baseSalary,['@type','currency','value'],'salary');shape(ld.baseSalary.value,['@type','minValue','maxValue','unitText'],'salary');
  need(ld.baseSalary['@type']==='MonetaryAmount'&&ld.baseSalary.currency===currency&&ld.baseSalary.value['@type']==='QuantitativeValue'&&ld.baseSalary.value.minValue===minValue&&ld.baseSalary.value.maxValue===maxValue&&ld.baseSalary.value.unitText==='YEAR','salary','LD/native exact salary differs');
  need(typeof native.compensationPhilosophyHtml==='string','supplement','Full compensation philosophy missing');
  authoredProjection(native.compensationPhilosophyHtml,{philosophy:true});
  need(sha(native.compensationPhilosophyHtml)==='f3bdb85bff4244dc133007eb6c0170a6dacb090313ad5ce0d679c0fe0b062cdf','supplement','New compensation philosophy requires review');
  return {currency,minValue,maxValue,summary,tiers:plainSnapshot(tiers),scrapeableSummary:native.scrapeableCompensationSalarySummary,philosophyHtml:native.compensationPhilosophyHtml,
    scope:'Full native published annual base range plus exact original equity/commission and philosophy; no pay eligibility inference'};
}

function roleFacts(own,api){
  const native=own.originalAppData.posting,ld=own.originalLD;
  shape(native,POSTING_FIELDS,'native-model');
  need(native.__typename==='JobPostingDetails'&&native.isListed===true&&native.isConfidential===false,'native-model','Native role availability changed');
  shape(ld,[...LD_FIELDS,...(Object.hasOwn(ld,'baseSalary')?['baseSalary']:[])],'own-schema');
  need(ld['@context']==='https://schema.org/'&&ld['@type']==='JobPosting'&&ld.directApply===false&&native.id===api.id&&native.title===api.title&&ld.title===api.title,'own-schema','Own full role identity/schema mismatch');
  shape(ld.identifier,['@type','name','value'],'own-schema');need(ld.identifier['@type']==='PropertyValue'&&ld.identifier.name==='Hyperscience'&&ld.identifier.value===api.id,'own-schema','Own native posting identifier differs');
  shape(ld.hiringOrganization,['@type','name','sameAs','logo'],'own-schema');
  need(ld.hiringOrganization['@type']==='Organization'&&ld.hiringOrganization.name==='Hyperscience'&&ld.hiringOrganization.sameAs==='https://www.hyperscience.ai/'&&ld.hiringOrganization.logo===own.originalAppData.organization.theme.logoSquareImageUrl,'own-schema','Published employer/brand mismatch');
  need(native.descriptionHtml===api.descriptionHtml&&ld.description===api.descriptionHtml&&hasSourceDescription({sourceDescription:api.descriptionHtml}),'criteria','Complete original own/API/LD primary criterion differs');
  const projection=authoredProjection(api.descriptionHtml);
  authoredCharacters(api.descriptionPlain);need(projection.comparisonText===layout(api.descriptionPlain),'projection','Original primary HTML/plain source layout differs');
  need(own.headDescriptions.every(text=>layout(text)===layout(api.descriptionPlain)),'native-head','Full published own head description differs');
  for(const text of [api.title,api.location,api.descriptionPlain,projection.comparisonText])geography(text);
  const contentFamily={title:api.title,department:api.department,team:api.team,projectionSHA256:sha(projection.comparisonText),projectionBytes:Buffer.byteLength(projection.comparisonText)};
  need(!/(?:base|annual|salary|compensation)[^.!?]{0,80}[$€][0-9]/i.test(projection.comparisonText),'salary','New primary authored salary clause requires review');
  const country=workCountry(api,native,ld);
  need(['Remote','Hybrid'].includes(api.workplaceType)&&native.workplaceType===api.workplaceType&&api.isRemote===true&&ld.jobLocationType==='TELECOMMUTE'
    &&api.workplaceType===(country==='United States'?'Remote':'Hybrid'),'mode','Published mode representations unknown/contradictory');
  need(api.employmentType==='FullTime'&&native.employmentType==='FullTime'&&ld.employmentType==='FULL_TIME'&&native.applicationDeadline===null,'employment-date','Employment/deadline disagreement');
  need(typeof api.publishedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+00:00$/.test(api.publishedAt)
    &&Number.isFinite(Date.parse(api.publishedAt))&&new Date(api.publishedAt).toISOString()===api.publishedAt.replace('+00:00','Z')&&ld.datePosted===api.publishedAt.slice(0,10),'employment-date','Original offset/date-only published fields disagree');
  need(native.departmentName===api.department&&native.departmentExternalName===api.department&&Array.isArray(native.teamNames)&&[1,2].includes(native.teamNames.length)
    &&native.teamNames[0]===api.department&&native.teamNames.at(-1)===api.team,'department','Direct native department/team path differs');
  for(const key of ['compensationTierGuideUrl','applicationLimitCalloutHtml','candidateTextingPrivacyPolicyUrl','candidateTextingTermsAndConditionsUrl','automatedProcessingLegalNotice'])need(native[key]===null,'supplement','Unknown supplemental condition/notice');
  need(native.shouldAskForTextingConsent===false&&native.shouldAskForWhatsAppConsent===false&&native.legalEntityNameForTextingConsent==='Hyper Labs, Inc. dba Hyperscience','supplement','Unreviewed consent/legal-label fields');
  const compensation=salary(native,ld);
  const sourceDescription=api.descriptionHtml+(compensation?'<h2>Published compensation</h2><p>'+compensation.summary+'</p>'+compensation.tiers.map(t=>'<p>'+t.tierSummary+'</p>').join('')+'<h2>Compensation philosophy</h2>'+compensation.philosophyHtml:'');
  return {id:api.id,title:api.title,country,workplaceType:native.workplaceType,employmentType:native.employmentType,
    applicantCountry:plainSnapshot(ld.applicantLocationRequirements),applicantEligibilityQualified:false,
    reviewedContentFamily:contentFamily,reviewedAddressFamily:{...api.address.postalAddress},criteriaComparisonScope:'Complete current own/API/LD/head authored criteria, not a finite title/content hash allowlist',sourceDescription,originalAPI:api,originalNativeModel:own.originalAppData,originalLD:ld,originalHead:own.head,
    originalHTML:own.packet.text,originalRawAppData:own.rawAppData,originalRawLD:own.rawLD,originalHeadResources:own.links,
    compensation,rawDates:{publishedAt:api.publishedAt,datePosted:ld.datePosted,applicationDeadline:native.applicationDeadline},
    publishedCountryScope:'finite-server-published-work-country',nativeAddressKnownNull:true,legalEmployerQualified:false,
    sourceBodiesQualified:false,rendererConsumptionQualified:false,UIOrApplicationEquivalent:false,
    nativeDeclaration:own.declaration,nativeSecurity:own.securityFacts};
}

/** Reparse complete raw source publications. This pure result is not a fresh
 * programme/closing, even when its historical component model facts qualify. */
export function reconcileHyperscienceServerProgramme(options){
  const value=exactFields(options,['entry','positions','api','roles','intakeShell','intakeClient','intakeOpening','intakeClosing']);
  const api=readRawPacket(value.api,A,'A'),payload=rawJSON(api.bytes);
  shape(payload,['jobs','apiVersion'],'api');need(payload.apiVersion==='1'&&Array.isArray(payload.jobs),'api','Exact native envelope/string1 required');
  need(payload.jobs.length>=1&&payload.jobs.length<=6&&new Set(payload.jobs.map(j=>j?.id)).size===payload.jobs.length,'membership','Whole1..6 native vacancies required without subset');
  for(const record of payload.jobs){
    shape(record,API_FIELDS,'api');need(UUID.test(record.id)&&record.isListed===true&&typeof record.title==='string'&&record.title.length>0,'api','Native row identity/listing unavailable');
    need(record.jobUrl==='https://jobs.ashbyhq.com/hyperscience/'+record.id&&record.applyUrl===record.jobUrl+'/application','api','Exact current own/apply URLs required');
  }
  const corporate=readCorporate(value.entry,'C0',payload.jobs),positions=readCorporate(value.positions,'C1',payload.jobs),roles=ownArray(value.roles);
  need(roles.length===payload.jobs.length,'membership','Every original native publication needs an own record');
  const own=roles.map(row=>readNativePacket(row));
  need(new Set(own.map(row=>row.route.id)).size===payload.jobs.length&&payload.jobs.every((row,i)=>own[i].route.id===row.id)
    &&payload.jobs.every(row=>positions.ownURLs.includes(row.jobUrl)),'membership','Complete own/API/corporate membership or native order differs');
  const nativeRecords=payload.jobs.map((row,i)=>roleFacts(own[i],row));
  const intake=readHyperscienceFormContract({shell:value.intakeShell,client:value.intakeClient,opening:value.intakeOpening,closing:value.intakeClosing});
  const allMetadata=[api,corporate.packet,positions.packet,...own.map(row=>row.packet)].every(row=>row.completeTransportMetadataQualified)&&intake.completeTransportMetadataQualified;
  return {source:'hyperscience',nativePayload:plainSnapshot(payload),nativeRecords,intake,reportedTotal:null,
    sourceObservationEvidence:{source:'hyperscience',recordKind:'mixed',observedRecordCount:nativeRecords.length+1,observedVacancyCount:nativeRecords.length,
      sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null},
    rawPackets:{entry:corporate.packet.original,positions:positions.packet.original,api:api.original,roles:own.map(row=>row.packet.original)},
    originalCorporate:{entryPublisherSchema:corporate.schema,positionsPublisherSchema:positions.schema,entryDeclarations:corporate.declarations,positionsDeclarations:positions.declarations,independentCorporateOrder:positions.ownURLs,entryRawGrammar:corporate.rawGrammar,positionsRawGrammar:positions.rawGrammar},
    qualificationFacts:{serverPublicationBodyFactsQualified:true,completeTransportMetadataQualified:allMetadata,currentTransactionQualified:false,
      countryQualificationScope:'finite-server-published-work-country',publishedApplicantFieldQualified:true,applicantEligibilityQualified:false,
      sourceScopeComplete:false,companyGlobalScopeQualified:false,companyGlobalTotal:null,companyIndiaTotal:null,
      legalEmployerQualified:false,rendererConsumptionQualified:false,UIOrApplicationEquivalent:false,sideEffectFreeInitializationQualified:false,
      sourceTimeSemanticsQualified:false,lifecycleCleanupAllowed:false,allChannelsClosed:false,allWholeBodiesEqual:intake.comparison.rawEntityEqual?null:false,
      QrawEntityEqual:intake.comparison.rawEntityEqual,QserverDefinitionCriteriaEqual:intake.comparison.serverDefinitionCriteriaEqual},
    protocolLimits:{nativeRequests:'14+2N',maximumN:6,maximumNativeRequests:26,defaultSourceTimeoutMs:90000,maximumSourceTimeoutMs:120000,
      perCompleteRequestMs:20000,ordinaryBytes:4194304,manifestBytes:1048576,selectedEntryBytes:6291456,aggregateDecodedBytes:25165824,
      closingReservesAndFinalAbortQualified:false,legacyPublicRequestCount:null},
    limits:['Pure body/model/definition facts only; no complete fresh programme/zero or source recovery.',
      'Every ordinary raw closing/current-client/security interval, cancellation/observer/prior-envelope bridge remains a later controller obligation.',
      'Actual published work/applicant country and Remote/Hybrid fields are retained; broader eligibility/legal/global/UI/application/cleanup remains unknown.']};
}
