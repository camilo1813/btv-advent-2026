import { button, element } from './shared.js'
import { reducedMotion } from './playback.js'

function canvasSurface(canvas) {
  const ctx=canvas.getContext('2d')
  return (t,frame)=>{
    const {width:w,height:h}=canvas
    ctx.fillStyle='#261b29'
    ctx.fillRect(0,0,w,h)
    ctx.strokeStyle='#423044'
    for (let i=1;i<10;i++) {
      ctx.beginPath()
      ctx.moveTo(w*i/10,0);ctx.lineTo(w*i/10,h)
      ctx.moveTo(0,h*i/10);ctx.lineTo(w,h*i/10)
      ctx.stroke()
    }
    ctx.fillStyle='#ffcb8e'
    ctx.beginPath()
    ctx.arc(w*(.5+.27*Math.sin(t)),h*(.59+.071*Math.sin(t*2)),27,0,Math.PI*2)
    ctx.fill()
    ctx.fillRect(54,750,432*(frame+1)/150,8)
    ctx.font='bold 22px sans-serif'
    ctx.fillText('BEYOND THE VOTE',54,153)
    ctx.fillText('DIAGNOSTIC / CANVAS',54,874)
    ctx.fillStyle='#fff8ee'
    ctx.fillText('F'+String(frame).padStart(3,'0')+' · '+(frame/30).toFixed(2)+' s · LOOP',54,810)
    ctx.font='bold 40px sans-serif'
    ctx.fillText('Advent Challenge',54,307)
    ctx.fillText('2026',54,403)
  }
}
function webglSurface(canvas) {
  const gl=canvas.getContext('webgl')
  if (!gl) throw new Error('WebGL context unavailable')
  const program=gl.createProgram()
  for (const [type,source] of [
    [gl.VERTEX_SHADER,'attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);}'],
    [gl.FRAGMENT_SHADER,'precision mediump float; uniform vec2 size; uniform vec2 marker; uniform float progress; void main(){vec2 p=gl_FragCoord.xy/size; vec2 q=fract(p*10.); float grid=1.-step(.023,min(q.x,q.y)); vec3 c=mix(vec3(.15,.105,.16),vec3(.24,.17,.23),grid); float dot=step(length((p-marker)*vec2(1.,size.y/size.x)),.05); float bar=step(.21,p.y)*step(p.y,.22)*step(.1,p.x)*step(p.x,.1+.8*progress); gl_FragColor=vec4(mix(c,vec3(1.,.80,.56),max(dot,bar)),1.);}']
  ]) {
    const shader=gl.createShader(type)
    gl.shaderSource(shader,source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader))
    gl.attachShader(program,shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
  gl.useProgram(program)
  const buffer=gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer)
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW)
  const attribute=gl.getAttribLocation(program,'p')
  gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0)
  gl.enableVertexAttribArray(attribute)
  gl.viewport(0,0,canvas.width,canvas.height)
  gl.uniform2f(gl.getUniformLocation(program,'size'),canvas.width,canvas.height)
  const marker=gl.getUniformLocation(program,'marker')
  const bar=gl.getUniformLocation(program,'progress')
  return (t,frame)=>{
    gl.uniform2f(marker,.5+.27*Math.sin(t),.41-.071*Math.sin(t*2))
    gl.uniform1f(bar,(frame+1)/150)
    gl.drawArrays(gl.TRIANGLES,0,3)
  }
}
export function motion(shell, kind) {
  const stage=element('div',null,{class:'stage'})
  const canvas=element('canvas',null,{width:540,height:960,'aria-label':'Beyond the Vote diagnostic motion'})
  const output=element('output','0.00 s · F000')
  shell.append(stage,output)
  stage.append(canvas)
  let draw
  try { draw=kind==='webgl' ? webglSurface(canvas) : canvasSurface(canvas) }
  catch (error) {
    const replacement=canvas.cloneNode(false)
    canvas.replaceWith(replacement)
    draw=canvasSurface(replacement)
    shell.append(element('p','WebGL unavailable. Canvas fallback active. '+error.message,{role:'status'}))
  }
  if (kind==='webgl' && canvas.isConnected) {
    const text=element('div',null,{class:'motion-overlay'})
    text.append(element('p','BEYOND THE VOTE',{class:'eyebrow'}),element('h2','Advent Challenge 2026'),
      element('p','DIAGNOSTIC / WEBGL'))
    stage.append(text)
  }
  let running=false, elapsed=0, last=0, request=0
  function render() {
    const frame=Math.floor(elapsed/1000*30)%150
    draw(frame/150*Math.PI*2,frame)
    output.textContent=(frame/30).toFixed(2)+' s · F'+String(frame).padStart(3,'0')+' · 540 × 960'
  }
  function tick(now) {
    if (!running) return
    if (last) elapsed+=now-last
    last=now
    render()
    request=requestAnimationFrame(tick)
  }
  const pause=()=>{running=false;last=0;cancelAnimationFrame(request)}
  const play=()=>{if(!running){ running=true;request=requestAnimationFrame(tick) }}
  shell.append(button('Play',play),button('Pause',pause),button('Replay',()=>{elapsed=0;render();play()}))
  render()
  if (!reducedMotion.matches) play()
  const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting) pause()})
  observer.observe(stage)
  document.addEventListener('visibilitychange',()=>{if(document.hidden) pause()})
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches) pause()})
}
