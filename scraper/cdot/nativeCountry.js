import {REVIEWED_NATIONAL_ENGAGEMENT_TERMS} from './nationalDeploymentContract.js'
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
const regions=new Intl.DisplayNames(['en'],{type:'region',fallback:'code'})
const foreignCountries=new Set()
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
 const code=String.fromCharCode(a,b),name=regions.of(code)
 if(code!=='IN'&&name!==code)foreignCountries.add(name)
}
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const foreignCountryPattern=new RegExp('\\b(?:'+[...foreignCountries].map(escapeRegex).join('|')+'|USA|U\\.S\\.A\\.|UAE|U\\.A\\.E\\.|UK|U\\.K\\.)\\b','i')
const deployment='If selected, the candidates can be posted to any Project / location throughout the country.'
const issuer='C-DOT (Centre for Development of Telematics) is a premier R&D Autonomous Institute of the Government of India'
// This is a reviewed reference within this advertisement, not a general rule
// that an Indian government employer, Delhi or an office address implies India.
export function bindNativeDeploymentCountry({pages,role,sha256}){
 const english=pages.map(p=>clean(p.text)),text=english.join(' ')
 const unresolved=reason=>({country:null,proof:null,reason})
 if(clean(role.workplace)!=='Delhi')return unresolved('native-role-workplace-outside-reviewed-deployment-binding')
 if(!english[0]?.includes(issuer)||!english[0].includes('C-DOT invites applications'))return unresolved('native-national-referent-unproven')
 if(!text.includes('English version will prevail'))return unresolved('native-primary-language-precedence-unproven')
 const sections=text.split('VII. General Terms & Conditions:')
 if(sections.length!==2)return unresolved('native-engagement-scope-unproven')
 const engagementScope=clean(sections[1].replace(/Page \d+ of \d+\s*/g,''))
 if(engagementScope!==REVIEWED_NATIONAL_ENGAGEMENT_TERMS)return unresolved('native-whole-engagement-scope-requires-review')
 if(foreignCountryPattern.test(text))return unresolved('native-other-country-reference-requires-review')
 if(/\b(?:except(?:ion|ions)?|excluding|excluded|exempt(?:ion|ions)?|not applicable|do(?:es)? not apply)\b/i.test(text)
  ||/\b(?:terms|conditions|clause)\b[^.]{0,100}\bonly\b/i.test(text))return unresolved('native-engagement-scope-exception-requires-review')
 // Clause 2 must remain a complete applicable engagement term; an added
 // exception, alternative or exclusion before clause 3 invalidates the binding.
 if(!sections[1].includes('2. '+deployment+' 3.'))return unresolved('native-selected-candidate-deployment-scope-changed')
 const matches=text.match(/If selected, the candidates can be posted/g)||[]
 if(matches.length!==1)return unresolved('native-selected-candidate-deployment-scope-ambiguous')
 const geography=text.match(/\b(?:locations?|country|countries|workplaces?|worksites?|overseas|abroad|foreign|international(?:ly)?|assignments?|relocat\w*|offices?|on[- ]?site|onshore|offshore|deput\w*|stationed|travel|residen\w*)\b/gi)||[]
 if(JSON.stringify(geography.map(v=>v.toLowerCase()))!==JSON.stringify(['location','location','country']))return unresolved('native-additional-geographic-scope-requires-review')
 const governments=text.match(/(?:Government|Govt\.) of [^,.)\n]+/g)||[]
 if(!governments.length||governments.some(v=>!/^Government of India$|^Govt\. of India$/.test(v)))return unresolved('native-national-referent-ambiguous')
 return {country:'India',reason:null,proof:{method:'advertisement-national-deployment-context',contextualBinding:true,literalRoleCountry:false,
  country:'India',nativeRoleWorkplace:role.workplace,nativeRoleTitle:role.title,rolePage:1,
  issuerDeclaration:issuer,issuerPage:pages[0].number,scopeSection:'VII. General Terms & Conditions, clause 2',deploymentClause:deployment,
  deploymentPages:pages.filter(p=>clean(p.text).includes(deployment)).map(p=>p.number),
  engagementScopeText:engagementScope,
  primaryEnglishPages:pages.map(p=>p.number),documentSHA256:sha256,
  interpretation:'The selected-candidate deployment term refers to the same advertisement’s India national referent; the native Delhi assignment remains subject to nationwide posting',
  exactCampusEstablished:false,contactAddressUsed:false}}
}
