import { button, element, local } from './shared.js'
export const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)')

export function videoPlayer(shell, test) {
  if (!test.media) return
  const video=element('video',null,{playsinline:'',controls:'',preload:'metadata',
    poster:local('assets/posters/first-frame.jpg'),'aria-label':'BTV diagnostic video'})
  const auto=(['D01','D02','D03'].includes(test.id) || test.variant==='autoplay') && !test.tapOnly
  video.muted=test.id!=='D02'
  video.loop=test.id==='D03'
  video.append(element('source',null,{src:local(test.media.path),type:test.media.mime}))
  if (test.asset==='videos/diag-5s.mp4') video.append(element('source',null,
    {src:local('assets/videos/diag-vp9.webm'),type:'video/webm'}))
  const decision=element('p','USER PLAY REQUIRED',{class:'live','aria-live':'polite'})
  const state=element('p','PAUSED',{role:'status'})
  const time=element('output','0.00 s')
  const loops=element('p','Loops observed 0',{role:'status'})
  const log=element('ol',null,{class:'events'})
  const details=element('details')
  details.append(element('summary','Playback events'),log)
  let previous=0, wraps=0
  const events=['loadedmetadata','loadeddata','canplay','play','playing','pause','waiting','stalled','ended','error','timeupdate']
  const note=(message)=>{
    log.prepend(element('li',message))
    if (log.children.length>100) log.lastElementChild.remove()
  }
  for (const name of events) video.addEventListener(name,()=>{
    if (['playing','pause','ended','error'].includes(name)) state.textContent={
      playing:'PLAYING',pause:'PAUSED',ended:'ENDED',error:'MEDIA ERROR'}[name]
    if (name==='loadedmetadata'||name==='timeupdate') {
      const current=video.currentTime
      const frame=Math.min((test.media.frames ?? Infinity)-1,Math.floor(current*Number(test.media.fps?.split?.('/')[0] ?? test.media.fps ?? 30)/
        Number(test.media.fps?.split?.('/')[1] ?? 1)))
      time.textContent=current.toFixed(2)+' s / frame '+Math.max(frame,0)+' · '+video.videoWidth+' × '+video.videoHeight
      if (video.loop && !video.seeking && previous>video.duration*.72 && current<video.duration*.25) {
        loops.textContent='LOOP OBSERVED · '+(++wraps)
        note('loop wrap')
      }
      if (Math.floor(previous)!==Math.floor(current)) note('timeupdate '+current.toFixed(2)+' s')
      previous=current
    } else note(name+' · '+video.currentTime.toFixed(2)+' s')
  })
  video.addEventListener('seeking',()=>{ if (!video.loop || video.paused) previous=video.currentTime })
  video.lastElementChild.addEventListener('error',()=>{state.textContent='MEDIA ERROR';note('source error')})
  const play=async initial=>{
    try {
      await video.play()
      if (initial) decision.textContent='AUTOPLAY SUCCEEDED'
    } catch (error) {
      if (initial) decision.textContent=error.name==='NotAllowedError' ? 'AUTOPLAY BLOCKED · USER PLAY REQUIRED' : 'MEDIA ERROR · '+error.name
      else state.textContent='MEDIA ERROR · '+error.name
      note(error.name+' · '+error.message)
    }
  }
  const actions=element('div',null,{class:'actions'})
  const mute=button(video.muted?'Unmute':'Mute',()=>{video.muted=!video.muted;mute.textContent=video.muted?'Unmute':'Mute'})
  const loop=button(video.loop?'Loop on':'Loop off',()=>{video.loop=!video.loop;loop.textContent=video.loop?'Loop on':'Loop off'})
  actions.append(button('Play',()=>play(false)),button('Pause',()=>video.pause()),
    button('Replay',()=>{previous=0;video.currentTime=0;play(false)}),mute,loop)
  if (document.fullscreenEnabled) actions.append(button('Fullscreen',async()=>{try{await video.requestFullscreen()}catch{note('Fullscreen unavailable')}}))
  shell.append(video,decision,state,time,loops,actions,details)
  if (auto && !reducedMotion.matches) play(true)
  if (auto && reducedMotion.matches) decision.textContent='USER PLAY REQUIRED · reduced motion'
  const observer=new IntersectionObserver(entries=>{if (!entries[0].isIntersecting) video.pause()})
  observer.observe(video)
  document.addEventListener('visibilitychange',()=>{if (document.hidden) video.pause()})
  reducedMotion.addEventListener('change',()=>{if (reducedMotion.matches) video.pause()})
}
