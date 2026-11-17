import {readFileSync} from 'node:fs'
import {isDeepStrictEqual as equal} from 'node:util'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {hasClientDocumentBase} from '../../scraper-support/utils/reviewedClientProgram.js'
import {currentTransport} from './currentTransport20261117.js'
import {wholeHeldModel,check,unavailable} from './currentModels20261117.js'
const p=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8'))
export async function runCurrentMcMenon(options={}){
 options.signal?.throwIfAborted();const io=currentTransport({...options,label:'McMenon',allowedURL:url=>[p.root,p.careers].includes(url)})
 try{const acquire=async()=>{const home=await io.read(p.root),doc=readNativeDocument(home.text),links=doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Careers');check(!hasClientDocumentBase(home.text)&&equal(activeHead(home.text).titles,p.rootTitles)&&links.length>0&&links.every(n=>new URL(n.attrs.href,p.root).href===p.careers),'active current McMenon employer/recruitment handoff');const page=await io.read(p.careers),native=readNativeDocument(page.text),hr=native.nodes(n=>n.tag==='a'&&n.attrs.href===p.genericHR.attrs.href),main=native.nodes(n=>n.tag==='main');check(!hasClientDocumentBase(page.text)&&equal(activeHead(page.text).titles,p.careersTitles)&&hr.length===1&&equal(hr[0].attrs,p.genericHR.attrs)&&native.text(hr[0])===p.genericHR.text&&main.length===1,'active current own careers/general HR carrier');const empty=native.nodes(n=>n.tag==='p'&&native.text(n)==='There are no current vacancies at the moment.',main[0]);io.checkpoint();return{corporate:wholeHeldModel(home),careers:wholeHeldModel(page),fullNativeMain:main[0],publishedNoCurrentVacanciesClaim:empty.length===1,publishedClaimIsCompanyInventoryProof:false,currentGeneralHR:{attrs:hr[0].attrs,text:native.text(hr[0]),perRoleApplication:false},clientFlightAndOtherProgrammeContextUnexecuted:true,hrMessageSent:false}}
 const opening=await acquire(),closing=await acquire();io.checkpoint();throw unavailable('mcmenonengineeringservices','McMenon current own careers publication retains its no-current-vacancies statement and general HR inbox; complete native/browser/company vacancy scope is not established',io,opening,closing,{closingFullNativeModelMatches:equal(opening,closing),publishedEmptyClaimNotPromotedToCompanyZero:true,hrMessageSent:false})
 }finally{io.close()}
}
