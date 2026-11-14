import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {BOARD_URL,FEED_URL,readGrabBoard,readGrabFeed,readGrabDetail,readGrabProgram,readGrabStyle} from './currentNative.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261114.json.gz',import.meta.url))))
const body=url=>fixture.responses.find(row=>row.url===url).body
const board=body(BOARD_URL),xml=body(FEED_URL),records=readGrabFeed(xml).records
const row=records.find(job=>job.apijobid==='744000161218849'),detail=body(row.url)
const variants=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-layout-variants-20261114.json.gz',import.meta.url))))
const programVariant=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-program-variants-20261114.json.gz',import.meta.url)))).responses[0]
const datalayerVariant=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-datalayer-variant-20261114.json.gz',import.meta.url)))).responses[0]
const stylesheet=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-styles-20261114.json.gz',import.meta.url)))).responses[0]
const guarded=read=>assert.throws(read,error=>error.softFailure===true&&error.lifecycleCleanupAllowed===false)
const editPosting=change=>detail.replace(/(<script[^>]*id="js-job-posting"[^>]*>)([\s\S]*?)(<\/script>)/,(whole,open,json,close)=>{
 const posting=JSON.parse(json);change(posting)
 return open+JSON.stringify(posting).replaceAll('<','\\u003C').replaceAll('>','\\u003E')+close
})
const roleNotice=notice=>{
 const needle='Get to Know the Role',replacement=needle+' - '+notice
 return{record:{...row,description:row.description.replaceAll(needle,replacement)},html:detail.replaceAll(needle,replacement)}
}
const consistentCriterion=replacement=>({
 record:{...row,description:row.description.replaceAll('Get to Know the Role',replacement)},
 html:detail.replaceAll('Get to Know the Role',replacement)
})

for(const className of ['d-none','invisible','opacity-0','d-lg-none'])test('Grab rejects consistently hidden criteria using pinned CSS class '+className,()=>{
 const changed=consistentCriterion("<span class='"+className+"'>Get to Know the Role</span>")
 guarded(()=>readGrabDetail(changed.html,changed.record))
})

for(const [label,markup] of [
 ['CSS hiding on an otherwise reviewed tag',"<strong class='d-none'>Get to Know the Role</strong>"],
 ['responsive CSS hiding on an otherwise reviewed tag',"<strong class='d-lg-none'>Get to Know the Role</strong>"],
 ['generated content from qualified CSS',"<strong class='swiper-button-next'>Get to Know the Role</strong>"],
 ['client video trigger',"<strong class='js-video'>Get to Know the Role</strong>"],
 ['client application trigger',"<strong id='js-apply-external'>Get to Know the Role</strong>"],
 ['Bootstrap data activation',"<strong data-bs-toggle='collapse' data-bs-target='#tab-1-collapse'>Get to Know the Role</strong>"],
 ['client data activation',"<strong data-target='#tab-1-collapse'>Get to Know the Role</strong>"],
 ['unknown data declaration',"<strong data-unreviewed='criteria'>Get to Know the Role</strong>"],
 ['new attribute on static formatting',"<strong title='Unpaired qualification'>Get to Know the Role</strong>"],
 ['interactive criterion',"<button>Get to Know the Role</button>"],
 ['new in-criteria link',"<a href='"+row.url+"'>Get to Know the Role</a>"],
 ['unreviewed static tag',"<em>Get to Know the Role</em>"],
 ['reassigned client inner class',"<div class='inner'>Get to Know the Role</div>"],
 ['new wrapper inside criteria',"<div>Get to Know the Role</div>"]
])test('Grab rejects consistent native criteria with '+label,()=>{
 const changed=consistentCriterion(markup)
 assert.notEqual(changed.html,detail)
 guarded(()=>readGrabDetail(changed.html,changed.record))
})

for(const [label,change] of [
 ['a hidden criterion class',value=>value.replace('Get to Know the Role',"<strong class='opacity-0'>Get to Know the Role</strong>")],
 ['a client trigger attribute',value=>value.replace('Get to Know the Role',"<strong data-bs-toggle='collapse'>Get to Know the Role</strong>")],
 ['a generated-content class',value=>value.replace('Get to Know the Role',"<strong class='swiper-button-next'>Get to Know the Role</strong>")],
 ['an extra inner wrapper',value=>value.replace('Get to Know the Role',"<div class='inner'>Get to Know the Role</div>")]
])test('Grab rejects '+label+' introduced in visible criteria alone',()=>{
 const start=detail.indexOf('id="js-job-detail"'),changed=detail.slice(0,start)+change(detail.slice(start))
 assert.notEqual(changed,detail)
 guarded(()=>readGrabDetail(changed,row))
})

test('Grab rejects a new plain wrapper placed before the original inner criteria wrapper',()=>{
 const start=detail.indexOf('collapse read-more-content cms-content'),changed=detail.slice(0,start)+detail.slice(start).replace(/(<div class="inner">)([\s\S]*?)(<\/div>)/,'<div>$1$2$3</div>')
 assert.notEqual(changed,detail)
 guarded(()=>readGrabDetail(changed,row))
})

test('Grab checks the static markup contract independently on feed and native JobPosting descriptions',()=>{
 const replacement="<strong class='swiper-button-next'>Get to Know the Role</strong>"
 guarded(()=>readGrabDetail(detail,{...row,description:row.description.replaceAll('Get to Know the Role',replacement)}))
 guarded(()=>readGrabDetail(editPosting(model=>{model.description=model.description.replaceAll('Get to Know the Role',replacement)}),row))
})

for(const [label,needle,replacement] of [
 ['document ancestor','<html lang="en-US"','<html class="d-none" lang="en-US"'],
 ['body ancestor','class=" js-template-job"','class=" js-template-job opacity-0"'],
 ['main ancestor','<main id="content"','<main class="invisible" id="content"'],
 ['immediate role ancestor','class="overflow-hidden"','class="overflow-hidden d-lg-none"'],
 ['ancestor generated content','class=" js-template-job"','class=" js-template-job swiper-button-next"'],
 ['ancestor client declaration','data-template="job"','data-template="other"']
])test('Grab rejects unreviewed criteria activation on '+label,()=>{
 const changed=detail.replace(needle,replacement)
 assert.notEqual(changed,detail,'Mutation reaches the original ancestor')
 guarded(()=>readGrabDetail(changed,row))
})

for(const [label,style] of [
 ['external stylesheet','<link rel="stylesheet" href="https://example.test/unreviewed.css">'],
 ['token-case alternate stylesheet','<link rel="alternate STYLESHEET" href="https://example.test/unreviewed.css">'],
 ['generated visible criteria','<style>.cms-content:after{content:"Unpaired mandatory qualification"}</style>']
])test('Grab rejects unreviewed CSS authority from '+label,()=>{
 guarded(()=>readGrabDetail(detail.replace('</head>',style+'</head>'),row))
 guarded(()=>readGrabBoard(board.replace('</head>',style+'</head>')))
})

test('Grab rejects unreviewed inline style declarations even when they do not hide the heading',()=>{
 guarded(()=>readGrabDetail(detail.replace('<body','<body style="font-size:0"'),row))
})

test('Grab binds the complete declared CSS bytes to their exact stylesheet URL',()=>{
 readGrabStyle(stylesheet.url,stylesheet.body)
 guarded(()=>readGrabStyle(stylesheet.url,stylesheet.body+'\n.cms-content:after{content:"Unpaired qualification"}'))
 guarded(()=>readGrabStyle(stylesheet.url+'?unreviewed=true',stylesheet.body))
})

test('Grab inventories CSS declarations outside the document head and inside inert template content',()=>{
 for(const added of ['<link rel="STYLESHEET" href="https://example.test/role.css">','<template><style>.cms-content:after{content:"Unpaired qualification"}</style></template>']){
  guarded(()=>readGrabDetail(detail.replace('</body>',added+'</body>'),row))
 }
})

for(const notice of [
 'This position is closed. We are no longer accepting applications.',
 'This vacancy has been filled.',
 'This job has expired.',
 'We are no longer accepting applications for this role.',
 'Applications for this position are closed.'
])test('Grab quarantines an otherwise consistent native role that explicitly says '+notice,()=>{
 const changed=roleNotice(notice)
 assert.throws(()=>readGrabDetail(changed.html,changed.record),error=>error.nativeRecordMismatch===true&&error.nativeVacancyUnavailable===true&&error.lifecycleCleanupAllowed===false)
})

test('Grab does not confuse ordinary closed tickets and expired certificates with a closed vacancy',()=>{
 const changed=roleNotice('You will review closed support tickets and expired certificates as part of the security program.')
 assert.equal(readGrabDetail(changed.html,changed.record).job.jobId,'744000161218849')
})

test('Grab qualifies eleven original rotating decorative raster responses while preserving every original criterion',()=>{
 assert.equal(variants.responses.length,11)
 for(const response of variants.responses){
  const record=records.find(candidate=>candidate.url===response.url),job=readGrabDetail(response.body,record).job
  assert.equal(job.jobId,record.apijobid)
  assert.equal(job.sourceDescriptionHTML,record.description)
  assert.equal(job.sourceDetailComplete,true)
 }
})

test('Grab rejects criteria descendants inside the decorative picture slot',()=>{
 const current=variants.responses[0],record=records.find(candidate=>candidate.url===current.url)
 const changed=current.body.replace('</picture>','<span>Required additional qualification.</span></picture>')
 assert.ok(changed!==current.body)
 guarded(()=>readGrabDetail(changed,record))
})

const picture=detail.match(/<picture>[\s\S]*?<\/picture>/)[0]
test('Grab rejects an image inserted into native full criteria even when the text still matches',()=>{
 const changed=detail.replace(/(<[a-z]+\b[^>]*class="[^\"]*\bcms-content\b[^\"]*"[^>]*>)/,'$1'+picture)
 assert.ok(changed!==detail)
 guarded(()=>readGrabDetail(changed,row))
})

test('Grab rejects out-of-range crop coordinates in an otherwise paired native raster',()=>{
 const original=variants.responses.find(response=>response.body.includes('rxy=')),record=records.find(candidate=>candidate.url===original.url)
 guarded(()=>readGrabDetail(original.body.replaceAll(/rxy=[0-9.]+,[0-9.]+/g,'rxy=1.5,0.5'),record))
})

for(const [label,change] of [
 ['foreign raster publisher',value=>value.replace('src="/media/','src="https://example.test/media/')],
 ['executable raster URL',value=>value.replace('src="/media/','src="javascript:unreviewed()/media/')],
 ['SVG image markup',value=>value.replaceAll('.jpg?','.svg?')],
 ['image event program',value=>value.replace('<img ','<img onerror="unreviewed()" ')],
 ['extra source authority',value=>value.replace('<source ','<source data-unreviewed="true" ')],
 ['unpaired responsive source',value=>value.replace('format=webp','format=png')],
 ['duplicate image query',value=>value.replace('quality=85','quality=85&width=800')],
 ['reassigned slot',value=>value.replace('col-lg-4 job-video','col-lg-4 native-criteria')]
])test('Grab rejects decorative '+label,()=>{
 const changedPicture=change(picture)
 const changed=label==='reassigned slot'?change(detail):detail.replace(picture,changedPicture)
 assert.ok(changed!==detail)
 guarded(()=>readGrabDetail(changed,row))
})

test('Grab accepts only the complete original same-URL source-map-comment program variant',()=>{
 const original=body(programVariant.url)
 assert.equal(programVariant.body,original+'//# sourceMappingURL=/phb/nmap/app.js.vf523dd962ea30b3cf0072a2d0e141bef5818c8ca')
 readGrabProgram(programVariant.url,programVariant.body)
 guarded(()=>readGrabProgram(programVariant.url,programVariant.body+'\n/* unreviewed */'))
 guarded(()=>readGrabProgram(programVariant.url,programVariant.body.replace('/phb/nmap/','https://example.test/nmap/')))
 const anotherDeclaredURL=fixture.responses.find(response=>response.url.includes('/phb/cookieAlert.js.')).url
 guarded(()=>readGrabProgram(anotherDeclaredURL,programVariant.body))
})

test('Grab qualifies the exact current complete dataLayer source-map-comment entity and rejects byte or URL mispairing',()=>{
 assert.equal(datalayerVariant.bytes,15034)
 assert.equal(datalayerVariant.body,body(datalayerVariant.url)+'//# sourceMappingURL=/phb/nmap/dataLayer.js.vf523dd962ea30b3cf0072a2d0e141bef5818c8ca')
 readGrabProgram(datalayerVariant.url,datalayerVariant.body,datalayerVariant.sha256)
 guarded(()=>readGrabProgram(datalayerVariant.url,'\ufeff'+datalayerVariant.body))
 guarded(()=>readGrabProgram(datalayerVariant.url,datalayerVariant.body+'\n/* unreviewed */'))
 guarded(()=>readGrabProgram(datalayerVariant.url,datalayerVariant.body.replace('/phb/nmap/','https://example.test/nmap/')))
 guarded(()=>readGrabProgram(programVariant.url,datalayerVariant.body,datalayerVariant.sha256))
 guarded(()=>readGrabProgram(datalayerVariant.url,body(datalayerVariant.url),datalayerVariant.sha256))
})

test('Grab withholds criteria hidden by a document stylesheet outside the role container',()=>{
 const hidden=detail.replace('</head>','<style>.cms-content{display:none}</style></head>')
 guarded(()=>readGrabDetail(hidden,row))
})

test('Grab withholds individual criteria hidden by a document stylesheet',()=>{
 const hidden=detail.replace('</head>','<style>.cms-content p{visibility:hidden}</style></head>')
 guarded(()=>readGrabDetail(hidden,row))
})

test('Grab publisher XML rejects unqualified text outside original data records',()=>{
 assert.throws(()=>readGrabFeed(xml.replace('<publisher>','UNQUALIFIED <publisher>')),/XML|envelope|publisher/i)
})

test('Grab publisher XML rejects embedded processing instructions as unreviewed authority',()=>{
 assert.throws(()=>readGrabFeed(xml.replace('<publisher>','<?unreviewed target="roles"?><publisher>')),/XML|envelope|publisher/i)
})

test('Grab current native board and immutable assets are independently bound to original bytes',()=>{
 assert.equal(readGrabBoard(board).total,431)
 const asset=fixture.responses.find(response=>/javascript/.test(response.headers['content-type']))
 readGrabProgram(asset.url,asset.body)
 assert.throws(()=>readGrabProgram(asset.url,asset.body+'\n/* changed */'),/program bytes/)
 assert.throws(()=>readGrabProgram(asset.url+'?unreviewed=true',asset.body),/program bytes/)
})

for(const [label,change] of [
 ['publisher identity',value=>value.replace('<publisher>Grab</publisher>','<publisher>Other Employer</publisher>')],
 ['publisher tenant',value=>value.replace('<publisherUrl>https://www.grab.com/sg/</publisherUrl>','<publisherUrl>https://www.grab.com/other/</publisherUrl>')],
 ['record employer',value=>value.replace('<company><![CDATA[Grab]]></company>','<company><![CDATA[Other Employer]]></company>')],
 ['record source',value=>value.replace('<sourcename><![CDATA[Grab]]></sourcename>','<sourcename><![CDATA[Other Employer]]></sourcename>')],
 ['role ID and URL mismatch',value=>value.replace(/<apijobid><!\[CDATA\[\d+\]\]><\/apijobid>/,'<apijobid><![CDATA[744000000000000]]></apijobid>')],
 ['duplicate original ID',value=>value.replace('</source>',value.match(/<job>[\s\S]*?<\/job>/)[0]+'</source>')],
 ['missing original field',value=>value.replace(/<state>[\s\S]*?<\/state>/,'')],
 ['nested original field',value=>value.replace('<title><![CDATA[','<title><span>unreviewed</span><![CDATA[')],
 ['non-native publication date',value=>value.replace(/<date>[\s\S]*?<\/date>/,'<date><![CDATA[not-a-date]]></date>')],
 ['external entity authority',value=>value.replace('<source>','<!DOCTYPE source [<!ENTITY x SYSTEM "https://example.test/roles">]><source>')],
 ['new XML stylesheet',value=>value.replace('<source>','<?xml-stylesheet type="text/xsl" href="/roles.xsl"?><source>')]
])test('Grab rejects changed native feed '+label,()=>guarded(()=>readGrabFeed(change(xml))))

for(const [label,change] of [
 ['title',value=>value.replace('<title>Grab your dream role | Grab Careers</title>','<title>Other employer</title>')],
 ['canonical',value=>value.replace('rel="canonical" href="https://www.grab.careers/en/jobs/"','rel="canonical" href="https://example.test/jobs/"')],
 ['document base',value=>value.replace('</head>','<base href="https://example.test/"></head>')],
 ['publisher feed handoff',value=>value.replace('href="https://www.grab.careers/en/jobs/xml/?rss=true"','href="https://example.test/jobs.xml"')],
 ['program declarations',value=>value.replace('</body>','<script src="https://example.test/roles.js"></script></body>')],
 ['event activation',value=>value.replace('<body','<body onload="unreviewed()"')],
 ['delegated frame',value=>value.replace('</body>','<iframe src="https://example.test/roles"></iframe></body>')],
 ['visible count',value=>value.replace('Displaying <strong>1</strong> to <strong>20</strong>','Displaying <strong>1</strong> to <strong>19</strong>')]
])test('Grab rejects changed corporate board '+label,()=>{
 const changed=change(board);assert.notEqual(changed,board,'Mutation must reach original entity')
 guarded(()=>readGrabBoard(changed))
})

for(const [label,change] of [
 ['employer',model=>{model.hiringOrganization.name='Other Employer'}],
 ['employer domain',model=>{model.hiringOrganization.url='https://www.grab.com/other/'}],
 ['JSON-LD context',model=>{model['@context']='https://example.test/context'}],
 ['employment type',model=>{model.employmentType='PART_TIME'}],
 ['department',model=>{model.industry='Unpaired department'}],
 ['nested employer criteria',model=>{model.hiringOrganization.additionalCriteria='Unpaired condition'}],
 ['nested worksite criteria',model=>{model.jobLocation.address.workPermitRequired=true}],
 ['native requisition',model=>{model.identifier='REF000000X'}],
 ['role URL',model=>{model.url='https://example.test/job/'}],
 ['foreign country',model=>{model.jobLocation.address.addressCountry='Malaysia'}],
 ['unknown country',model=>{model.jobLocation.address.addressCountry=''}],
 ['mixed country worksites',model=>{model.jobLocation=[model.jobLocation,{address:{addressCountry:'Malaysia',addressLocality:'Kuala Lumpur'}}]}],
 ['city mismatch',model=>{model.jobLocation.address.addressLocality='Other city'}],
 ['publication date',model=>{model.datePosted='2026-11-14'}],
 ['incomplete description',model=>{model.description='<p>Apply now</p>'}],
 ['extra original criteria',model=>{model.description+='<p>Additional unpaired qualification.</p>'}],
 ['hidden criteria',model=>{model.description='<div hidden>'+model.description+'</div>'}],
 ['executable criteria',model=>{model.description+='<script>unreviewed()</script>'}],
 ['schema authority',model=>{model.unreviewed={'role':'different'}}]
])test('Grab withholds detail '+label,()=>guarded(()=>readGrabDetail(editPosting(change),row)))

for(const [label,change] of [
 ['application tenant',value=>value.replace('jobs.smartrecruiters.com/Grab/','jobs.smartrecruiters.com/OtherEmployer/')],
 ['application record',value=>value.replace('jobs.smartrecruiters.com/Grab/744000161218849-','jobs.smartrecruiters.com/Grab/744000000000000-')],
 ['new executable program',value=>value.replace('</body>','<script>unreviewed()</script></body>')],
 ['changed share activation',value=>value.replace('menubar=no,toolbar=no','menubar=yes,toolbar=no')],
 ['extra DOM criteria',value=>value.replace('</h1>','</h1><div class="cms-content"><p>Unpaired qualification</p></div>')],
 ['unreviewed criteria wrapper',value=>value.replace('id="js-job-detail"','data-unreviewed="true" id="js-job-detail"')]
])test('Grab rejects native detail '+label,()=>{
 const changed=change(detail);assert.notEqual(changed,detail,'Mutation must reach original entity')
 guarded(()=>readGrabDetail(changed,row))
})
