import { anchor, button, element, local, manifest } from './shared.js'
import { motion } from './motion.js'
import { reducedMotion, videoPlayer } from './playback.js'
import { campaign, castSlots, story } from './story.js'

function animatedImage(shell, asset) {
  const stage=element('div',null,{class:'stage'})
  const still=local('assets/posters/first-frame.jpg')
  const image=element('img',null,{src:still,alt:'Diagnostic frame and moving time counter'})
  const play=()=>{image.src=local(asset)}
  const stop=()=>{image.src=still}
  stage.append(image)
  shell.append(stage,button('Play / replay',()=>{stop();requestAnimationFrame(play)}),button('Stop',stop))
  const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting) stop()})
  observer.observe(stage)
  document.addEventListener('visibilitychange',()=>{if(document.hidden) stop()})
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches) stop()})
  if(!reducedMotion.matches) play()
}
async function lottie(shell, test) {
  const stage=element('div',null,{class:'stage','aria-label':'Lottie diagnostic composition'})
  shell.append(stage)
  try {
    const script=element('script',null,{src:local('vendor/lottie_light.min.js')})
    const loaded=new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=reject})
    document.head.append(script)
    await loaded
    const animation=window.lottie.loadAnimation({container:stage,renderer:'svg',loop:true,
      autoplay:!reducedMotion.matches,path:local(test.media.path)})
    const overlay=element('div',null,{class:'motion-overlay'})
    const output=element('output','0.00 s · F000')
    overlay.append(element('p','BEYOND THE VOTE',{class:'eyebrow'}),element('h2','Advent Challenge 2026'),
      element('p','DIAGNOSTIC / LOTTIE'),output)
    stage.append(overlay)
    animation.addEventListener('enterFrame',event=>{
      const frame=Math.floor(event.currentTime)%150
      output.textContent=(frame/30).toFixed(2)+' s · F'+String(frame).padStart(3,'0')
    })
    animation.addEventListener('data_failed',()=>stage.textContent='Lottie composition could not load.')
    shell.append(button('Play',()=>animation.play()),button('Pause',()=>animation.pause()),
      button('Replay',()=>animation.goToAndPlay(0,true)))
    const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting) animation.pause()})
    observer.observe(stage)
    document.addEventListener('visibilitychange',()=>{if(document.hidden) animation.pause()})
    reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches) animation.pause()})
  } catch { stage.textContent='Lottie runtime could not load.' }
}
export async function renderPlayer(shell,kind,data,test) {
  if (test?.blocked && !test.media) {
    shell.append(element('p',test.blocked,{role:'status'}))
    return
  }
  if (kind==='mp4') videoPlayer(shell,test)
  if (['gif','css','svg'].includes(kind)) animatedImage(shell,test?.media?.path ||
    'assets/animations/'+({gif:'loop.gif',css:'css.svg',svg:'smil.svg'}[kind]))
  if (kind==='canvas'||kind==='webgl') motion(shell,kind)
  if (kind==='lottie') await lottie(shell,test)
  if (kind==='story'||kind==='characters') {
    try {
      const config=await campaign
      if(kind==='story') story(shell,data,config)
      else {
        shell.append(element('h2','Character compositing'),castSlots(config))
        if(test?.id==='D10') videoPlayer(shell,test)
        if(test?.id==='F05') {
          const diagnostics={characters:{alpha:{name:'Alpha diagnostic plate',assets:[
            {kind:'alpha-webm',path:'assets/characters/alpha-diagnostic.webm'},
            {kind:'still',path:'assets/characters/alpha-diagnostic.png'}
          ]}}}
          shell.append(castSlots(diagnostics))
        }
        const promos=element('div',null,{class:'actions'})
        for (const [i,seconds] of [3,5,15,30].entries()) promos.append(anchor('P0'+(i+1)+' · '+seconds+' s prototype',
          local('assets/videos/promo-'+seconds+'s.mp4')))
        promos.append(anchor('P05 · Interactive story',local('players/story/')))
        shell.append(promos)
      }
    } catch (error) { shell.append(element('p','Campaign assets unavailable. '+error.message)) }
  }
}
const shell=document.querySelector('#player')
if (shell) {
  try {
    const data=await manifest
    const kind=shell.dataset.kind
    const id=new URL(location.href).searchParams.get('test') ||
      {mp4:'D03',gif:'A06',css:'D04',svg:'D05',canvas:'D06',webgl:'D07',lottie:'D08',story:'D09',characters:'D10'}[kind]
    const test=data.tests.find(item=>item.id===id)
    shell.replaceChildren(element('h1',kind==='gif'?'Animated image player':test?.title || 'BTV player'))
    await renderPlayer(shell,kind,data,test)
  } catch (error) { shell.textContent=error.message }
}
