import{readFileSync}from'node:fs'
import{isDeepStrictEqual as equal}from'node:util'
import{readNativeDocument,activeHead}from'../../scraper-support/utils/activeNativeHtml.js'
import{hasClientDocumentBase}from'../../scraper-support/utils/reviewedClientProgram.js'
import{currentTransport}from'./currentTransport20261117.js'
import{wholeHeldModel,check,unavailable}from'./currentModels20261117.js'
const p=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8'))
export async function runCurrentImarticus(options={}){
 options.signal?.throwIfAborted();const io=currentTransport({...options,label:'Imarticus Learning',allowedURL:url=>[p.root,p.entry,p.services,p.article].includes(url)})
 try{const acquire=async()=>{const home=await io.read(p.root),root=readNativeDocument(home.text);check(!hasClientDocumentBase(home.text)&&equal(activeHead(home.text).titles,p.rootTitles)&&equal(root.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical').map(n=>n.attrs),p.rootCanonical),'Imarticus current own root metadata/base')
   const first=await io.read(p.entry,'html',{status:301,location:'/careers-services/'});check(first.status===301,'literal current configured careers redirect')
   const second=await io.read(p.services,'html',{status:301,location:'/building-careers-of-the-future-with-imarticus-rise/'});check(second.status===301,'literal own current career-services redirect')
   const article=await io.read(p.article),doc=readNativeDocument(article.text);check(!hasClientDocumentBase(article.text)&&equal(activeHead(article.text).titles,p.articleTitles)&&equal(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical').map(n=>n.attrs),p.articleCanonical),'active exact own student career-services publication identity')
   check(doc.nodes(n=>/^h[1-6]$/.test(n.tag)&&doc.text(n)==='Building Careers Of The Future').length===1&&doc.nodes(n=>/^h[1-6]$/.test(n.tag)&&doc.text(n)==='Benefit From A Global Network Of 3500+ Hiring Partners').length===1,'active published student placement/learning context');io.checkpoint()
   return{corporate:wholeHeldModel(home),redirects:[first,second].map(r=>({url:r.url,status:r.status,location:r.location,fullNativeResponse:r.text})),studentPublication:wholeHeldModel(article),employerVacancyIdentityQualified:false}
  },opening=await acquire(),closing=await acquire();io.checkpoint()
  throw unavailable('imarticuslearning','Imarticus Learning configured careers chain currently publishes student career services, courses and hiring-partner outcomes; it does not establish employer vacancies, per-role country/criteria/application or company empty inventory',io,opening,closing,{closingFullNativeModelMatches:equal(opening,closing),closingStudentPublicationMatches:equal(opening.studentPublication,closing.studentPublication),studentCourseOrPlacementSignalsNotPromoted:true,companyVacancyInventoryProven:false,browserOrAlternateSourceFallbackPerformed:false,leadOrStudentApplicationSubmitted:false})
 }finally{io.close()}
}
