import { anchor, describe, element, local, manifest } from './shared.js'
import { editor } from './results.js'
import { shareControls } from './share.js'
import { renderPlayer } from './player.js'

const shell=document.querySelector('#case')
try {
  const data=await manifest
  const test=data.tests.find(item=>item.id===shell.dataset.id)
  const resultBox=element('section',null,{class:'panel'})
  shell.after(resultBox)
  const record=editor(resultBox,data.tests)
  const size=element('p',describe(test.media || test.preview),{class:'technical'})
  shell.replaceChildren(size)
  if (test.blocked) shell.append(element('p',test.blocked,{role:'status'}))
  if (test.player || test.media?.mime.startsWith('video/')) {
    const player=element('section',null,{class:'player-page'})
    shell.append(player)
    renderPlayer(player,test.player || 'mp4',data,test)
  } else if (test.media?.mime.startsWith('image/')) {
    const still=test.media.frames===1 && !test.media.duration
    if (still) shell.append(element('img',null,{src:local(test.media.path),alt:'Diagnostic preview artwork',loading:'lazy'}))
    else {
      shell.append(anchor('View animated image',local('players/gif/')+'?test='+encodeURIComponent(test.id)))
    }
  }
  shell.append(shareControls(test,data.portal,()=>record(test.id)))
} catch (error) { shell.textContent=error.message }
