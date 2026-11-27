import { describe, element, local, manifest, select } from './shared.js'
import { editor, observations } from './results.js'
import { shareControls } from './share.js'
import { classifications, dimensions } from './schema.js'

const filters=document.querySelector('#filters')
const cards=document.querySelector('#cards')
const counts=document.querySelector('#counts')
try {
  const data=await manifest
  let rows=observations()
  let showEditor
  const search=element('label','Search tests')
  search.append(element('input',null,{name:'search',type:'search',placeholder:'A06, GIF, loop…'}))
  const picker=(label,name,values)=>select(label,name,[['','All'],...values.map(value=>Array.isArray(value)?value:[value,value])])
  const devices=picker('Device','device',[])
  filters.append(search,picker('Category','category',Object.entries(data.categories)),
    picker('Format','format',[...new Set(data.tests.map(test=>(test.media || test.preview)?.format).filter(Boolean))].sort()),devices,
    picker('Playback observed','playback', [['preview_animation_observed','Preview animated'],['native_playback_observed','Native playback'],
      ['autoplay_after_opening','Autoplay after opening'],['loop_observed','Loop observed']]),
    picker('Observation status','status',['PENDING','ASSET BLOCKED',...classifications]),
    picker('File size','size',[['small','Below 600 KB'],['large','600 KB and above']]),
    picker('Evidence','evidence',[['yes','Evidence recorded'],['no','No evidence recorded']]))
  function render() {
    const byTest=new Map()
    for (const row of rows) {
      if (!byTest.has(row.test_id)) byTest.set(row.test_id,[])
      byTest.get(row.test_id).push(row)
    }
    const byStatus=status=>data.tests.filter(test=>byTest.get(test.id)?.some(row=>row.result_classification===status)).length
    counts.replaceChildren(...[
      [data.tests.length,'Total tests'],[data.tests.length,'Generated pages'],[data.core_count,'Core'],
      [data.tests.filter(test=>!byTest.has(test.id)).length,'Awaiting observations'],
      [byStatus('PASS'),'Pass observed'],[byStatus('PASS_WITH_LIMITATIONS'),'Partial observed'],
      [byStatus('FAIL'),'Fail observed'],[data.tests.filter(test=>test.blocked).length,'Setup blocked']
    ].map(([number,label])=>{
      const node=element('div')
      node.append(element('strong',number),label)
      return node
    }))
    const values=Object.fromEntries(new FormData(filters))
    const query=values.search.trim().toLowerCase()
    const exactId=data.tests.some(test=>test.id.toLowerCase()===query)
    const deviceSelect=devices.querySelector('select')
    const available=[...new Set(rows.map(row=>row.device_model).filter(Boolean))].sort()
    deviceSelect.replaceChildren(element('option','All',{value:''}),...available.map(name=>element('option',name,{value:name})))
    deviceSelect.value=available.includes(values.device)?values.device:''
    const matching=data.tests.filter(test=>{
      const related=byTest.get(test.id) || []
      const evidence=related.some(row=>row.evidence_filename)
      const media=test.media || test.preview
      const searchText=[test.id,test.title,media?.mime,test.expected].join(' ').toLowerCase()
      return (!query || (exactId ? test.id.toLowerCase()===query : searchText.includes(query))) &&
        (!values.category || values.category===test.category) &&
        (!values.format || values.format===media?.format) &&
        (!values.size || (media && ((media.bytes<600000)===(values.size==='small')))) &&
        (!values.evidence || evidence===(values.evidence==='yes')) &&
        (!values.status || (values.status==='PENDING' ? !related.length : values.status==='ASSET BLOCKED' ?
          test.blocked : related.some(row=>row.result_classification===values.status))) &&
        ((!deviceSelect.value && !values.playback) || related.some(row=>
          (!deviceSelect.value || row.device_model===deviceSelect.value) && (!values.playback || row[values.playback]===true)))
    })
    document.querySelector('#match-count').textContent=matching.length+' matching tests'
    cards.replaceChildren(...matching.map(test=>{
      const related=byTest.get(test.id) || []
      const card=element('article',null,{class:'card','data-id':test.id})
      const preview=test.preview?.frames===1 && test.preview?.mime!=='image/svg+xml' ? test.preview.path : 'assets/posters/a01.jpg'
      const statuses=element('div',null,{class:'status-list'})
      for (const label of [test.automated,test.previewLimits, related.length ? related.length+' observations' : 'WhatsApp pending',
        related.filter(row=>row.evidence_filename).length+' evidence files']) statuses.append(element('span',label))
      card.append(element('img',null,{src:local(preview),alt:'',loading:'lazy',width:240,height:142}),
        element('div',test.id+' / '+data.categories[test.category],{class:'tag'}),
        element('h2',test.title),element('p',describe(test.media || test.preview),{class:'technical'}),
        element('p',test.expected),statuses)
      if (test.blocked) card.append(element('p',test.blocked))
      if (related.length) {
        const details=element('details')
        details.append(element('summary','Observed behaviour'))
        for (const row of related) {
          const findings=dimensions.filter(key=>row[key]).map(key=>key.replaceAll('_',' ')+' '+row[key])
          const behavior=['preview_present','preview_animation_observed','preview_autoplay_observed','native_playback_observed',
            'autoplay_after_opening','loop_observed','caption_preserved','url_clickable'].filter(key=>typeof row[key]==='boolean')
            .map(key=>key.replaceAll('_',' ')+' '+(row[key]?'yes':'no'))
          details.append(element('p',[row.device_model,row.distribution_context,row.result_classification,...findings,...behavior,row.notes].filter(Boolean).join(' · ')))
        }
        card.append(details)
      }
      card.append(shareControls(test,data.portal,()=>showEditor(test.id),true))
      return card
    }))
  }
  showEditor=editor(document.querySelector('#observations'),data.tests,next=>{ rows=next; render() })
  filters.addEventListener('input',render)
  filters.addEventListener('submit',event=>event.preventDefault())
} catch (error) {
  cards.textContent='The test dashboard could not load. '+error.message
}
