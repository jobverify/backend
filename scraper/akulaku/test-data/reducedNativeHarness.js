import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {jobCards,listingModel,BOARD,CORPORATE} from '../nativeModels.js'
import {readNativeDocument} from '../../../scraper-support/utils/activeNativeHtml.js'

// Explicit synthetic reduction of retained original public packets. This never
// supplies live health evidence: the registered default audit must read all
// actual current pages and details independently.
const originals=JSON.parse(gunzipSync(readFileSync(new URL('./native-20261103.json.gz',import.meta.url))))
const original=url=>structuredClone(originals.find(row=>row.requestedUrl===url||row.url===url))
const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')
export function reducedBoard({india=false}={}){
 const listing=original(BOARD+'alljob/?o=1'),cards=jobCards(listing.html).slice(0,2),table=listing.html.match(/<table\b[^>]*>[\s\S]*?<\/table>/g).find(value=>value.includes('职位名称')),rows=[...table.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map(match=>match[0]),header=rows.find(value=>value.includes('职位名称')),selected=cards.map(card=>rows.find(value=>value.includes('/zpdetail/'+card.detailId+'?')))
 let reduced=listing.html.replace(table,'<table>'+header+selected.join('')+'</table>').replace('共210条记录','共2条记录').replace('当前第1/14页','当前第1/1页').replace(/<a\b[^>]*>[\s\S]*?<\/a>/g,anchor=>{const doc=readNativeDocument(anchor),text=doc.text(doc.nodes(node=>node.tag==='root')[0]);return /^(?:首页|上一页|下一页|尾页)$/.test(text)?'':anchor})
 if(india)reduced=reduced.replaceAll('广东省-深圳市','India-Bengaluru')
 assert.notEqual(reduced,listing.html)
 assert.equal(listingModel(reduced,BOARD+'alljob/?o=1').reportedTotal,2)
 const pages=new Map(),calls=[],visits=new Map()
 for(const sheet of originals.filter(row=>row.kind==='stylesheet'))pages.set(sheet.url,structuredClone(sheet))
 pages.set(CORPORATE,original(CORPORATE))
 const home=original(BOARD);let at=0;home.html=home.html.replace(/<a\b[^>]*href=["']\/zpdetail\/\d+[^"']*["'][^>]*>[\s\S]*?<\/a>/g,()=>{const card=cards[at++%cards.length];return'<a href="'+card.detailUrl.replace(BOARD,'/').replace('o=1','o=2')+'" title="'+escape(card.title)+'">'+escape(card.title)+'</a>'});home.syntheticFixture=true;pages.set(BOARD,home)
 for(const order of[1,2]){const url=BOARD+'alljob/?o='+order;pages.set(url,{...listing,url,requestedUrl:url,html:order===1?reduced:reduced.replaceAll('?o=1','?o=2'),syntheticFixture:true})}
 for(const card of cards){const detail=original(card.detailUrl);if(india)detail.html=detail.html.replaceAll('广东省-深圳市','India-Bengaluru');detail.syntheticFixture=true;pages.set(card.detailUrl,detail)}
 return{pages,cards,calls,visits,fetchPage:async(url,request)=>{calls.push({url,signal:request?.signal});const count=(visits.get(url)||0)+1;visits.set(url,count);const packet=structuredClone(pages.get(url));assert.ok(packet,'only declared reduced native URL '+url);return packet},remove(id){for(const order of[1,2]){const url=BOARD+'alljob/?o='+order,packet=pages.get(url);packet.html=packet.html.replace(new RegExp('<tr\\b[^>]*>(?:(?!<tr)[\\s\\S])*?/zpdetail/'+id+'\\?(?:(?!<tr)[\\s\\S])*?</tr>'),'').replace('共2条记录','共1条记录')}},addThirdOriginal(){const third=jobCards(listing.html)[2],row=rows.find(value=>value.includes('/zpdetail/'+third.detailId+'?'));for(const order of[1,2]){const packet=pages.get(BOARD+'alljob/?o='+order),current=packet.html.match(/<table\b[^>]*>[\s\S]*?<\/table>/g).find(value=>value.includes('职位名称'));packet.html=packet.html.replace(current,current.replace('</table>',row.replaceAll('?o=1','?o='+order)+'</table>')).replace('共2条记录','共3条记录')}return third}}
}
