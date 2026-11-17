import{readFileSync}from'node:fs'
import{isDeepStrictEqual as equal}from'node:util'
import{readNativeDocument,activeHead}from'../../scraper-support/utils/activeNativeHtml.js'
import{hasClientDocumentBase}from'../../scraper-support/utils/reviewedClientProgram.js'
import{currentTransport}from'./currentTransport20261117.js'
import{wholeHeldModel,check,unavailable}from'./currentModels20261117.js'
const p=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8'))
export async function runCurrentJuzGo(options={}){
 options.signal?.throwIfAborted();const io=currentTransport({...options,label:'JuzGoDigital',allowedURL:url=>[p.root,p.team].includes(url)})
 try{const acquire=async()=>{const page=await io.read(p.root),doc=readNativeDocument(page.text);check(!hasClientDocumentBase(page.text)&&equal(activeHead(page.text).titles,p.rootTitles),'active current own JuzGoDigital identity');const teams=doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Our Team');check(teams.length>0&&teams.every(n=>new URL(n.attrs.href,p.root).href===p.team),'active exact own team declaration')
   const team=await io.read(p.team),native=readNativeDocument(team.text);check(!hasClientDocumentBase(team.text)&&equal(activeHead(team.text).titles,p.teamTitles),'active current own team identity');const heading=native.nodes(n=>/^h[1-6]$/.test(n.tag)&&native.text(n)==='Ready to join our team?'),cv=native.nodes(n=>n.tag==='a'&&native.text(n)==='Send us your CV');check(heading.length===1&&cv.length===1&&cv[0].attrs.href===p.genericCVHandoff,'active whole general HR CV carrier');io.checkpoint();return{corporate:wholeHeldModel(page),team:wholeHeldModel(team),generalCVDeclaration:{attrs:cv[0].attrs,text:native.text(cv[0]),perRoleApplication:false},gmailNavigationPerformed:false}
  },opening=await acquire(),closing=await acquire();io.checkpoint()
  throw unavailable('juzgodigital','JuzGoDigital current own team page publishes a general HR CV email-compose handoff; no per-role vacancy/country/criteria/application or company empty inventory is established',io,opening,closing,{closingFullNativeModelMatches:equal(opening,closing),gmailNavigationPerformed:false,hrMessageSent:false,guessedCareersRouteRequested:false})
 }finally{io.close()}
}
