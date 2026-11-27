import { anchor, button, element, local } from './shared.js'
import { reducedMotion } from './playback.js'

export const campaign=fetch(local('assets/characters/characters.json')).then(response=>response.json())
function clip(url, poster) {
  const video=element('video',null,{src:url,playsinline:'',muted:'',preload:'metadata',controls:''})
  video.muted=true
  if (poster) video.poster=poster
  return video
}
export function castSlots(config, compact=false) {
  const cast=element('div',null,{class:'cast'})
  for (const character of Object.values(config.characters)) {
    const slot=element('div')
    const asset=character.assets[0]
    const fallback=character.assets.find(item=>item.kind==='still')
    slot.append(element('strong',character.name))
    if (!asset) slot.append(element('p','Approved render pending',{class:'technical'}))
    else if (compact && asset.kind!=='still' && fallback) {
      slot.append(element('img',null,{src:local(fallback.path),alt:character.name,loading:'lazy'}))
    } else if (compact && asset.kind!=='still') {
      slot.append(element('p','See the character player for the approved animated asset.'))
    } else {
      const frame=element('div',null,{class:'checker'})
      const url=local(asset.path)
      if (['alpha-webm','opaque-mp4','alpha-video'].includes(asset.kind)) {
        const video=clip(url,fallback && local(fallback.path))
        const showFallback=()=>{
          frame.replaceChildren(fallback ? element('img',null,{src:local(fallback.path),alt:character.name}) :
            element('p','No still fallback is available for this codec.'))
        }
        video.addEventListener('error',showFallback)
        frame.append(video)
        if (asset.kind!=='opaque-mp4' && fallback) frame.append(button('Use still fallback',showFallback))
      } else if (['png-sequence','sprite-sheet'].includes(asset.kind)) {
        const image=element('img',null,{alt:character.name})
        const canvas=element('canvas',null,{width:asset.frameWidth || 256,height:asset.frameHeight || 256,'aria-label':character.name})
        const count=asset.kind==='png-sequence'?asset.frames.length:asset.frameCount
        let number=0, timer
        function show() {
          if(asset.kind==='png-sequence') image.src=local(asset.frames[number])
          else if (image.complete && image.naturalWidth) {
            const ctx=canvas.getContext('2d')
            ctx.clearRect(0,0,canvas.width,canvas.height)
            ctx.drawImage(image,number%asset.columns*canvas.width,Math.floor(number/asset.columns)*canvas.height,
              canvas.width,canvas.height,0,0,canvas.width,canvas.height)
          }
        }
        image.addEventListener('load',()=>{if(asset.kind==='sprite-sheet') show()})
        if(asset.kind==='sprite-sheet') image.src=url
        show()
        const pause=()=>{clearInterval(timer);timer=undefined}
        frame.append(asset.kind==='png-sequence'?image:canvas,button('Play',()=>{
          if(!timer) timer=setInterval(()=>{number=(number+1)%count;show()},1000/(asset.fps || 15))
        }),button('Pause',pause))
        document.addEventListener('visibilitychange',()=>{if(document.hidden) pause()})
      } else frame.append(element('img',null,{src:url,alt:character.name}))
      slot.append(frame)
    }
    cast.append(slot)
  }
  return cast
}
export function story(shell, data, config) {
  const stage=element('div',null,{class:'stage story',tabindex:0,'aria-label':'Advent story. Use left and right arrows to navigate.'})
  const progress=element('div',null,{class:'story-progress'})
  const content=element('div')
  const touch=element('div',null,{class:'story-touch','aria-hidden':'true'})
  touch.append(element('div'),element('div'))
  const action=anchor('Register for Advent updates',data.portal+'#sign-up',{class:'action primary'})
  const controls=element('div',null,{class:'actions'})
  const status=element('p',null,{role:'status'})
  const scenes=[
    ['Beyond the Vote','Advent Challenge 2026'],
    ['Advent Challenge 2026','One comic. Five rounds.'],
    ['Five quizzes','Explore the comic and put your reasoning to the test.'],
    ['Explore & solve','Observation, Bible exploration, visual puzzles, history and reasoning.'],
    ['Three age bands','10–15 · 16–21 · 22+'],
    ['Join the challenge',config.launchDate]
  ]
  let index=0, elapsed=0, playing=false, audio, muted=true, timer
  for (let i=0;i<scenes.length;i++) progress.append(element('progress',null,{max:5000,value:0,'aria-label':'Scene '+(i+1)+' progress'}))
  function update() {
    ;[...progress.children].forEach((bar,i)=>{bar.value=i<index?5000:i===index?elapsed:0})
  }
  function show() {
    content.replaceChildren(element('p','PROMOTIONAL PROTOTYPE',{class:'eyebrow'}),
      element('h2',scenes[index][0]),element('p',scenes[index][1]))
    if (index===0) content.append(castSlots(config,true))
    action.hidden=index!==scenes.length-1
    status.textContent='Scene '+(index+1)+' of '+scenes.length+' · '+scenes[index][0]
    update()
  }
  function jump(step) {
    index=Math.min(scenes.length-1,Math.max(0,index+step))
    elapsed=0
    show()
  }
  function pause() {
    playing=false
    clearInterval(timer)
    pauseButton.textContent='Resume'
    if(audio) audio.pause()
  }
  function play() {
    if (playing || document.hidden) return
    if(index===scenes.length-1 && elapsed===5000) jump(-index)
    playing=true
    pauseButton.textContent='Pause'
    let last=performance.now()
    timer=setInterval(()=>{
      const now=performance.now()
      elapsed=Math.min(5000,elapsed+now-last)
      last=now
      if(elapsed===5000) {
        if(index<scenes.length-1) jump(1)
        else pause()
      }
      update()
    },50)
    if(audio && !muted) audio.play().catch(()=>{muted=true;muteButton.textContent='Unmute'})
  }
  const pauseButton=button('Resume',()=>playing?pause():play())
  const muteButton=button('Unmute',()=>{
    audio ||= new Audio(local('assets/videos/diag-audio.mp4'))
    audio.loop=true
    muted=!muted
    if(muted) audio.pause()
    else if(playing) audio.play().catch(()=>{muted=true;muteButton.textContent='Unmute'})
    muteButton.textContent=muted?'Unmute':'Mute'
  })
  controls.append(button('Previous',()=>jump(-1)),button('Next',()=>jump(1)),pauseButton,
    button('Replay',()=>{jump(-index);play()}),muteButton)
  touch.firstChild.addEventListener('click',()=>jump(-1))
  touch.lastChild.addEventListener('click',()=>jump(1))
  stage.addEventListener('keydown',event=>{
    if (event.key==='ArrowLeft'||event.key==='ArrowRight') {
      event.preventDefault()
      jump(event.key==='ArrowLeft'?-1:1)
    }
  })
  stage.append(progress,content,touch,action)
  shell.append(stage,controls,status)
  document.addEventListener('visibilitychange',()=>{if(document.hidden) pause()})
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches) pause()})
  show()
  if(!reducedMotion.matches) play()
}
