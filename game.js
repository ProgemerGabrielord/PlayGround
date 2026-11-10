(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 960, H = 540, WORLD = 4380;
  canvas.width = W; canvas.height = H;
  const ui = {
    start: document.getElementById('start-screen'), end: document.getElementById('end-screen'),
    startButton: document.getElementById('start-button'), restart: document.getElementById('restart-button'),
    hud: document.getElementById('hud'), hearts: document.getElementById('hearts'), relics: document.getElementById('relics'),
    progress: document.getElementById('progress-fill'), toast: document.getElementById('toast'), sound: document.getElementById('sound-button'),
    endTitle: document.getElementById('end-title'), endCopy: document.getElementById('end-copy'), endEyebrow: document.getElementById('end-eyebrow')
  };
  const platforms = [
    {x:0,y:450,w:660},{x:735,y:450,w:510},{x:1325,y:450,w:520},{x:1925,y:450,w:550},
    {x:2555,y:450,w:505},{x:3140,y:450,w:545},{x:3760,y:450,w:620},
    {x:230,y:365,w:125},{x:440,y:310,w:128},{x:820,y:370,w:138},{x:1040,y:310,w:140},
    {x:1430,y:355,w:125},{x:1645,y:300,w:130},{x:2055,y:360,w:145},{x:2280,y:305,w:125},
    {x:2710,y:370,w:130},{x:2915,y:315,w:145},{x:3300,y:360,w:138},{x:3520,y:300,w:135},
    {x:3910,y:365,w:140}
  ];
  const relicSeeds = [{x:500,y:268},{x:1710,y:258},{x:2965,y:273}];
  let player, enemies, relics, particles, camera=0, state='title', last=0, elapsed=0, toastTimer=0, soundOn=false, audio;
  const keys = Object.create(null), pressed = Object.create(null), controls = {left:false,right:false};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  function reset() {
    player={x:85,y:385,vx:0,vy:0,w:25,h:39,face:1,ground:false,hp:5,inv:0,attack:0,dash:0,dashCd:0,anim:0,checkpoint:80};
    enemies=[{x:385,y:0,home:385,left:325,right:445,hp:2},{x:915,y:0,home:915,left:790,right:1000,hp:2},
      {x:1515,y:0,home:1515,left:1380,right:1590,hp:2},{x:2170,y:0,home:2170,left:1990,right:2230,hp:2},
      {x:2780,y:0,home:2780,left:2600,right:2850,hp:2},{x:3415,y:0,home:3415,left:3200,right:3480,hp:2},{x:3990,y:0,home:3990,left:3790,right:4110,hp:2}].map(e=>({...e,w:27,h:28,dir:1,alive:true,hit:0}));
    relics=relicSeeds.map((r,i)=>({...r,got:false,phase:i*2})); particles=[];camera=0;elapsed=0;
    updateHud();
  }
  function updateHud(){ui.hearts.innerHTML=Array.from({length:5},(_,i)=>`<i class="heart ${i>=player.hp?'empty':''}"></i>`).join('');ui.relics.textContent=relics.filter(r=>r.got).length;ui.progress.style.width=`${Math.min(100,(player.x/WORLD)*100)}%`;}
  function say(message){ui.toast.textContent=message;ui.toast.classList.add('show');toastTimer=2.2;}
  function begin(){reset();state='play';document.querySelector('.game-shell').classList.add('playing');ui.start.classList.add('hidden');ui.end.classList.add('hidden');ui.hud.hidden=false;}
  function finish(win){state=win?'win':'dead';document.querySelector('.game-shell').classList.remove('playing');ui.hud.hidden=true;ui.end.classList.remove('hidden');ui.endEyebrow.textContent=win?'A LENDA RENASCE':'FIM DE JORNADA';ui.endTitle.textContent=win?'A lua voltou ao céu.':'As sombras venceram.';ui.endCopy.textContent=win?'Você reuniu os fragmentos e despertou o coração das ruínas. Uma nova lenda começa!':'As ruínas ainda guardam seus segredos. Reúna os fragmentos e tente novamente.';}
  function sound(freq=420,duration=.08,type='sine'){if(!soundOn)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}catch(_){}}
  function hitbox(a,b,pad=0){return a.x-pad<b.x+b.w&&a.x+a.w+pad>b.x&&a.y-pad<b.y+b.h&&a.y+a.h+pad>b.y;}
  function spawn(x,y,color,n=8){for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*190,vy:-Math.random()*160-25,t:.45+Math.random()*.4,color,size:2+Math.random()*3});}
  function inputDown(e){let k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(!keys[k])pressed[k]=true;keys[k]=true;if(k==='enter'&&(state==='title'||state==='dead'||state==='win'))begin();}
  function inputUp(e){keys[e.key.toLowerCase()]=false;}
  addEventListener('keydown',inputDown);addEventListener('keyup',inputUp);addEventListener('blur',()=>{for(const k in keys)keys[k]=false});
  ui.startButton.addEventListener('click',begin);ui.restart.addEventListener('click',begin);
  ui.sound.addEventListener('click',()=>{soundOn=!soundOn;ui.sound.classList.toggle('muted',!soundOn);ui.sound.textContent=soundOn?'♫':'♪';if(soundOn)sound(600,.09)});
  document.querySelectorAll('[data-control]').forEach(btn=>{const name=btn.dataset.control;const down=e=>{e.preventDefault();btn.classList.add('active');if(name==='left'||name==='right')controls[name]=true;else pressed[name]=true;};const up=e=>{e.preventDefault();btn.classList.remove('active');if(name==='left'||name==='right')controls[name]=false;};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',up)});
  function collideX(p,dx){p.x+=dx;for(const b of platforms)if(p.y+p.h>b.y+1&&p.y<b.y+ (b.h||20)&&p.x<b.x+b.w&&p.x+p.w>b.x){if(dx>0)p.x=b.x-p.w;else if(dx<0)p.x=b.x+b.w;}}
  function collideY(p,dy){p.y+=dy;p.ground=false;for(const b of platforms)if(p.x+p.w>b.x+2&&p.x<b.x+b.w-2){if(dy>=0&&p.y+p.h>=b.y&&p.y+p.h-dy<=b.y+8){p.y=b.y-p.h;p.vy=0;p.ground=true;}else if(dy<0&&p.y<b.y+(b.h||20)&&p.y-dy>=b.y+(b.h||20)-4){p.y=b.y+(b.h||20);p.vy=0;}}}
  function update(dt){if(state!=='play')return;elapsed+=dt;const left=keys.a||keys.arrowleft||controls.left,right=keys.d||keys.arrowright||controls.right;const attack=pressed.j||pressed.z||pressed.attack;const jump=pressed[' ']||pressed.w||pressed.arrowup||pressed.jump;const dash=pressed.k||pressed.shift||pressed.dash;
    if(left){player.face=-1;player.vx=-205} else if(right){player.face=1;player.vx=205}else player.vx*=Math.pow(.001,dt);
    if(jump&&player.ground){player.vy=-455;player.ground=false;sound(290,.08,'triangle');}
    if(dash&&player.dashCd<=0){player.dash=.18;player.dashCd=.8;player.vx=player.face*490;player.vy*=.2;sound(180,.1,'sawtooth');spawn(player.x+12,player.y+22,'#bbd8ed',4);}
    if(attack&&player.attack<=.08){player.attack=.25;sound(520,.07,'triangle');}
    player.attack=Math.max(0,player.attack-dt);player.dash=Math.max(0,player.dash-dt);player.dashCd=Math.max(0,player.dashCd-dt);player.inv=Math.max(0,player.inv-dt);player.anim+=dt*Math.abs(player.vx)*.045;
    player.vy=Math.min(700,player.vy+1200*dt);const dx=(player.dash>0?player.face*490:player.vx)*dt;collideX(player,dx);collideY(player,player.vy*dt);player.x=clamp(player.x,0,WORLD-player.w);
    if(player.y>H+80){damage(true);}
    if(player.x>620&&player.checkpoint<700){player.checkpoint=760;say('PONTO DE RETORNO ATIVADO');}
    for(const e of enemies){if(!e.alive)continue;e.hit=Math.max(0,e.hit-dt);e.x+=e.dir*75*dt;if(e.x<e.left||e.x>e.right)e.dir*=-1;let ground=platforms.find(b=>e.x+e.w>b.x&&e.x<b.x+b.w&&Math.abs((b.y-e.h)-e.y)<50);if(ground)e.y=ground.y-e.h;else e.y=420;
      if(player.attack>0){const sword={x:player.face>0?player.x+player.w:player.x-27,y:player.y+10,w:32,h:23};if(hitbox(sword,e)&&!e.hit){e.hit=.35;e.hp--;e.x+=player.face*20;spawn(e.x+12,e.y+13,'#e5c27e',5);if(e.hp<=0){e.alive=false;spawn(e.x+12,e.y+12,'#8dc8c2',10);sound(190,.16,'triangle')}}}
      if(hitbox(player,e)&&player.inv<=0&&player.dash<=0)damage(false);
    }
    for(const r of relics)if(!r.got){r.phase+=dt;if(Math.abs(player.x+player.w/2-r.x)<27&&Math.abs(player.y+player.h/2-r.y)<38){r.got=true;spawn(r.x,r.y,'#f4d184',18);sound(760,.22,'sine');say(`FRAGMENTO DA LUA ${relics.filter(q=>q.got).length}/3`);updateHud();}}
    if(player.x>4260){if(relics.every(r=>r.got))finish(true);else if(!toastTimer)say('O PORTAL PRECISA DOS 3 FRAGMENTOS');}
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=380*dt;p.t-=dt;}particles=particles.filter(p=>p.t>0);
    camera=clamp(player.x-W*.36,0,WORLD-W);if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)ui.toast.classList.remove('show');}updateHud();
  }
  function damage(fall){if(player.inv>0)return;player.hp--;player.inv=1.1;player.vy=fall?-350:-300;if(fall){player.x=player.checkpoint;player.y=350;}else{player.vx=-player.face*250;}spawn(player.x+12,player.y+18,'#ee7c87',9);sound(110,.2,'sawtooth');if(player.hp<=0)finish(false);updateHud();}
  function drawBackground(){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#141a2d');g.addColorStop(.58,'#283348');g.addColorStop(1,'#65535a');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    const moonX=690-camera*.035;const mg=ctx.createRadialGradient(moonX,132,5,moonX,132,118);mg.addColorStop(0,'#f2dfb6');mg.addColorStop(.55,'#ddc69e');mg.addColorStop(1,'#ddc69e00');ctx.fillStyle=mg;ctx.beginPath();ctx.arc(moonX,132,118,0,Math.PI*2);ctx.fill();ctx.fillStyle='#efe1c4';ctx.beginPath();ctx.arc(moonX,132,38,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d2c19f';ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(moonX+11,123,7,0,Math.PI*2);ctx.arc(moonX-13,142,4,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    for(let i=0;i<50;i++){let x=((i*197+60-camera*(.05+(i%3)*.025))%(W+10)+W+10)%(W+10);let y=(i*83+21)%250;ctx.globalAlpha=.25+(Math.sin(elapsed*1.7+i)*.15+.15);rect(x,y,1+(i%4===0),1.5,'#fff2d6');}ctx.globalAlpha=1;
    drawMountains(.16,330,'#30384c',0);drawMountains(.29,375,'#232c3f',1);
    for(let i=0;i<8;i++){const wx=i*1450+260-camera*.36;drawTower(wx,255+(i%3)*12,55,130,'#293145');}
    for(let i=0;i<18;i++){const x=((i*153-camera*.57)%(W+150)+W+150)%(W+150)-50;drawPine(x,352+(i%4)*19,22+(i%3)*7,'#1b2936');}
    const haze=ctx.createLinearGradient(0,325,0,455);haze.addColorStop(0,'#a7a5a000');haze.addColorStop(1,'#d3a77925');ctx.fillStyle=haze;ctx.fillRect(0,320,W,140);
  }
  function drawMountains(speed,base,color,offset=0){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,H);for(let x=-100;x<=W+120;x+=110){let worldX=x+camera*speed;let y=base+Math.sin(worldX*.006+offset)*30+Math.cos(worldX*.013)*18;ctx.lineTo(x,y);ctx.lineTo(x+55,y-56-Math.sin(worldX*.009)*23);ctx.lineTo(x+110,y+8);}ctx.lineTo(W,H);ctx.closePath();ctx.fill();}
  function drawTower(x,y,w,h,color){if(x<-100||x>W+100)return;rect(x,y,w,h,color);rect(x+w*.16,y-20,w*.68,22,color);rect(x+w*.35,y-34,w*.3,16,color);rect(x+w*.38,y+18,w*.22,h*.18,'#111a2a');rect(x+w*.68,y+45,4,26,'#d8b975');}
  function drawPine(x,y,w,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-34-w*.4);ctx.lineTo(x-w*.7,y);ctx.lineTo(x+w*.7,y);ctx.fill();ctx.fillRect(x-2,y-2,4,12);}
  function drawWorld(){
    for(const b of platforms){const x=b.x-camera;if(x+b.w< -5||x>W+5)continue;rect(x,b.y,b.w,100,'#292a36');rect(x,b.y,b.w,9,'#66705f');rect(x,b.y+9,b.w,4,'#424a46');for(let s=0;s<b.w;s+=38){const n=((b.x+s)*13)%23;rect(x+s+5,b.y+21+n,b.s||3,3,'#45404a');if(s%3===0)rect(x+s+18,b.y+53,2,7,'#353544');}for(let s=10;s<b.w;s+=77){rect(x+s,b.y-7,2,7,'#8e8063');rect(x+s+3,b.y-5,2,5,'#71806a');}}
    // Scattered ruins and lanterns
    for(let i=0;i<13;i++){let wx=240+i*327,x=wx-camera;if(x< -30||x>W+30)continue;rect(x,423,25,27,'#49434a');rect(x-5,418,35,7,'#77705c');rect(x+5,400,3,18,'#5b554f');if(i%2===0){const glow=ctx.createRadialGradient(x+12,398,1,x+12,398,25);glow.addColorStop(0,'#e6b96cbb');glow.addColorStop(1,'#e6b96c00');ctx.fillStyle=glow;ctx.fillRect(x-13,373,50,50);rect(x+10,394,4,7,'#f5d894');}}
    drawGate();for(const r of relics)if(!r.got)drawRelic(r);for(const e of enemies)if(e.alive)drawEnemy(e);drawPlayer();
    for(const p of particles){ctx.globalAlpha=clamp(p.t*2,0,1);rect(p.x-camera,p.y,p.size,p.size,p.color);}ctx.globalAlpha=1;
  }
  function drawGate(){const x=4290-camera;if(x<-100||x>W+100)return;const open=relics.every(r=>r.got);ctx.save();ctx.shadowBlur=open?25:10;ctx.shadowColor=open?'#f0d091':'#8c86a5';ctx.strokeStyle=open?'#f2d89d':'#77758d';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(x-48,450);ctx.lineTo(x-48,355);ctx.quadraticCurveTo(x-48,280,x,280);ctx.quadraticCurveTo(x+48,280,x+48,355);ctx.lineTo(x+48,450);ctx.stroke();ctx.fillStyle=open?'#dce4ca50':'#8d8ba033';ctx.fill();ctx.restore();for(let i=0;i<3;i++){ctx.fillStyle=relics[i].got?'#f0d291':'#626477';ctx.beginPath();ctx.arc(x-25+i*25,441,4,0,Math.PI*2);ctx.fill();}}
  function drawRelic(r){const x=r.x-camera,y=r.y+Math.sin(r.phase*2)*6;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(r.phase)*.12);ctx.shadowBlur=22;ctx.shadowColor='#f4d184';ctx.fillStyle='#f6d88e';ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(11,0);ctx.lineTo(0,16);ctx.lineTo(-11,0);ctx.closePath();ctx.fill();ctx.fillStyle='#fff0c2';ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(5,0);ctx.lineTo(0,7);ctx.lineTo(-4,0);ctx.fill();ctx.restore();}
  function drawEnemy(e){const x=e.x-camera,y=e.y;if(x<-50||x>W+50)return;ctx.save();ctx.translate(x+e.w/2,y);if(e.dir<0)ctx.scale(-1,1);ctx.globalAlpha=e.hit>0?.6:1;ctx.fillStyle='#192532';ctx.beginPath();ctx.ellipse(0,17,14,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#435d61';ctx.beginPath();ctx.arc(0,7,12,Math.PI,0);ctx.lineTo(12,18);ctx.lineTo(-12,18);ctx.fill();ctx.fillStyle='#e99c78';ctx.fillRect(3,5,3,3);ctx.fillStyle='#b9c9b0';ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(-12,-7);ctx.lineTo(-3,-3);ctx.fill();ctx.restore();}
  function drawPlayer(){const p=player,x=p.x-camera,y=p.y;if(p.inv>0&&Math.floor(p.inv*14)%2===0)return;ctx.save();ctx.translate(x+p.w/2,y);if(p.face<0)ctx.scale(-1,1);const bob=p.ground&&Math.abs(p.vx)>15?Math.sin(p.anim)*2:0;
    // scarf trailing behind
    ctx.fillStyle='#d77766';ctx.beginPath();ctx.moveTo(-6,13+bob);ctx.lineTo(-19-Math.sin(elapsed*14)*4,19+bob);ctx.lineTo(-9,21+bob);ctx.lineTo(-3,16+bob);ctx.fill();
    // boots, tunic, head and hair
    rect(-9,31+bob,7,8,'#292536');rect(2,31+bob,8,8,'#292536');rect(-10,36+bob,9,3,'#d0ac72');rect(2,36+bob,9,3,'#d0ac72');
    rect(-10,17+bob,20,16,'#3f716e');rect(-8,20+bob,16,11,'#558982');rect(5,23+bob,4,7,'#e4c57f');
    rect(-9,3+bob,18,16,'#dfb990');rect(-10,0+bob,20,8,'#563c3c');rect(-9,-4+bob,18,5,'#6d4a43');rect(2,10+bob,3,3,'#202634');rect(7,9+bob,6,2,'#d8ab79');
    if(p.attack>0){ctx.save();ctx.translate(8,19+bob);ctx.rotate(-.8+Math.sin((.25-p.attack)*12)*.9);ctx.fillStyle='#d4e0dc';ctx.fillRect(3,-21,4,29);ctx.fillStyle='#d5b875';ctx.fillRect(0,4,11,4);ctx.fillStyle='#76624a';ctx.fillRect(2,8,4,11);ctx.restore();}
    else{ctx.fillStyle='#d5dfe0';ctx.fillRect(9,17+bob,3,17);ctx.fillStyle='#b79864';ctx.fillRect(7,27+bob,7,3);}
    ctx.restore();}
  function render(){ctx.clearRect(0,0,W,H);drawBackground();drawWorld();if(state==='title'){ctx.fillStyle='#f1d89e';ctx.globalAlpha=.7;ctx.beginPath();ctx.arc(778,429,3,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}}
  function loop(now){const dt=Math.min(.033,(now-last)/1000||0);last=now;if(state==='play')update(dt);render();for(const k in pressed)pressed[k]=false;requestAnimationFrame(loop);}
  reset();requestAnimationFrame(loop);
})();
