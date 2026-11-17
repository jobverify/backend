import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {createCurrentReader,need} from './currentRead20261117.js'
const HOME='https://www.oxyzo.in/',CAREERS='https://www.oxyzocareers.in/'
export async function runCurrentOxyzo(options={}){
 const io=createCurrentReader(options,[[HOME,'html'],[CAREERS,'html']],{maxReads:2})
 try{
  const home=await io.read(HOME),doc=readNativeDocument(home.text),text=doc.nodes(n=>n.tag==='body').map(doc.text).join(' ')
  need(activeHead(home.text).titles.length===1&&activeHead(home.text).titles[0]==='Customized Financial Solutions for SMEs & Corporate | Oxyzo.in'&&!doc.nodes(n=>n.tag==='base').length&&text.includes('OXYZO Financial Services Limited'),'current corporate publisher identity changed')
  const links=doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Careers');need(links.length>0&&links.every(n=>n.attrs.href==='https://www.oxyzocareers.in'),'current corporate declared careers target changed')
  await io.read(CAREERS)
  io.check();need(false,'corporate-declared careers target is newly accessible but its current native inventory, country, criteria and application contract have not been verified')
 }finally{io.close()}
}
