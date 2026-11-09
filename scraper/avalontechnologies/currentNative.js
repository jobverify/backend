import {structure,need,publicRead,stable,failure} from '../bizongo/publicRead.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
export const CURRENT_HOME='https://www.avalontec.com/',CURRENT_CAREERS='https://www.avalontec.com/careers/'
function inspect(home,html){
 const company='Avalon Technologies',homepage=structure(home),s=structure(html)
 need(homepage.visible(n=>n.tag==='a'&&n.attrs.href===CURRENT_CAREERS).length>0,company,'current corporate careers handoff missing')
 need(s.visible(n=>n.tag==='link'&&n.attrs.rel==='canonical'&&n.attrs.href===CURRENT_CAREERS).length===1&&/Avalon Technologies/i.test(s.text(s.root)),company,'current careers employer identity changed')
 const forms=s.visible(n=>n.tag==='form').filter(n=>{const members=s.nodes.filter(c=>{for(let p=c;p;p=s.parents.get(p))if(p===n)return true;return false});return members.some(c=>c.tag==='input'&&c.attrs.type==='file')&&members.some(c=>c.tag==='input'&&c.attrs.type==='email')})
 need(forms.length===1&&/Post your Resume/i.test(s.text(s.root)),company,'active general resume intake changed')
 const form=forms[0],controls=s.nodes.filter(c=>{if(!s.active(c))return false;for(let p=c;p;p=s.parents.get(p))if(p===form)return ['input','select','button','textarea'].includes(c.tag);return false}).map(n=>({tag:n.tag,name:n.attrs.name??null,type:n.attrs.type??null,accept:n.attrs.accept??null,required:Object.hasOwn(n.attrs,'required'),text:s.text(n)}))
 const observations=[{kind:'general-resume-intake',employer:company,sourceUrl:CURRENT_CAREERS,formAction:form.attrs.action??null,formMethod:form.attrs.method??null,controls,country:null,jobId:null,requisitionId:null,vacancyCount:null,applicationSubmitted:false}]
 const discovered=s.visible(n=>n.tag==='a'&&n.attrs.href).filter(n=>{try{const u=new URL(n.attrs.href,CURRENT_CAREERS);return /(?:lever\.co|greenhouse\.io|ashbyhq\.com|myworkdayjobs|darwinbox|oraclecloud|turbohire)/i.test(u.hostname)||u.origin===new URL(CURRENT_HOME).origin&&/\/(?:jobs?|openings)\//i.test(u.pathname)}catch{return false}}).map(n=>({text:s.text(n),href:n.attrs.href}))
 const scripts=s.scripts.map(({attrs,sha256,visuallyInactive,executable})=>({attrs,sha256,visuallyInactive,executable}))
 return{observations,discovered,structuralScripts:scripts,model:{formAction:form.attrs.action??null,method:form.attrs.method??null,controls,discovered}}
}
export const runCurrentAvalon=options=>publicRead({source:'avalontechnologies',company:'Avalon Technologies'},options,async({read,stamp,audit,publicPages})=>{
 const verifiedAt=stamp(),snapshot=async phase=>inspect(await read(CURRENT_HOME,{phase}),await read(CURRENT_CAREERS,{phase})),first=await snapshot('initial'),last=await snapshot('closing'),closingMatches=stable(first.model)===stable(last.model)
 const evidence={status:'coverage-gap',surface:CURRENT_CAREERS,firstParty:true,listingComplete:false,pagesFetched:publicPages.length,reportedTotal:null,indiaFacetCount:null,verifiedAt,reason:'general-resume-intake;vacancy-inventory-and-role-criteria-unpublished'}
 await audit({...first,verifiedAt,closingMatches,closingComparison:'public-resume-intake-model',sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,inventoryEvidence:evidence})
 if(!closingMatches)throw failure('Avalon Technologies','closing public intake changed')
 if(first.discovered.length)throw failure('Avalon Technologies','a public vacancy handoff requires a native collector','PUBLIC_VACANCY_COLLECTOR_REQUIRED')
 const jobs=attachInventoryEvidence([],evidence)
 return attachSourceObservationEvidence(jobs,{source:'avalontechnologies',recordKind:'hiring-signals',observedRecordCount:first.observations.length,observedVacancyCount:0,sourceScopeComplete:false})
})
