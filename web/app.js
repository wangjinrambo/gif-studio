const $=id=>document.getElementById(id);
let media=null, jobId=null, latest=null, busy=false, polling=null, previewing=false, browserPlayable=true;
let savedOutputDir='', outputBusy=false, outputReady=false;
let scrubTarget=null,scrubTimer=null,scrubHide=null,scrubRequest=null,scrubSequence=0,scrubDragging=false,scrubURL=null;
const formatSize=b=>b>=1048576?`${(b/1048576).toFixed(2)} MB`:`${(b/1024).toFixed(1)} KB`;
const round=n=>Math.round(n*100)/100;
function error(message=''){$('error').textContent=message;$('error').hidden=!message;}
async function api(url,body) {
  const res=await fetch(url,body===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await res.json();if(!res.ok) throw new Error(data.error||'请求失败，请重试。');return data;
}
function setBusy(value){busy=value;document.body.classList.toggle('busy',value);$('settingsFields').disabled=value||!media;$('trimFields').disabled=value||!media;$('convert').disabled=value||!media||outputBusy;$('outputFields').disabled=value||outputBusy;$('replace').disabled=value;$('demo').disabled=value;}
function update() {
  const start=+$('start').value,end=+$('end').value,length=end-start;
  $('fpsValue').textContent=`${$('fps').value} fps`;
  $('targetControl').hidden=!$('targetEnabled').checked;
  if(!media)return;
  $('startRange').value=start;$('endRange').value=end;
  $('rangeFill').style.left=`${start/media.duration*100}%`;$('rangeFill').style.right=`${100-end/media.duration*100}%`;
  $('durationLabel').textContent=length>0?`已选 ${length.toFixed(2)} 秒 / 共 ${media.duration.toFixed(2)} 秒`:'请检查起止时间';
  $('exportSummary').textContent=`${$('width').value} × ${$('height').value} px · ${Math.max(0,length).toFixed(2)} 秒 · ${$('fps').value} fps`;
  document.querySelectorAll('[data-width]').forEach(b=>b.classList.toggle('selected',b.dataset.width==='original'?+$('width').value===media.width&&+$('height').value===media.height:+b.dataset.width===+$('width').value));
}
function setWidth(value) {
  let width=Math.min(1920,Math.max(16,Math.round(value))),height=+$('height').value;
  if($('lockRatio').checked&&media){height=Math.round(width*media.height/media.width);if(height>1920){height=1920;width=Math.round(height*media.width/media.height);}height=Math.max(16,height);}
  $('width').value=width;$('height').value=height;update();
}
function setPreviewAspect(width,height){
  if(!(width>0&&height>0))return;
  const ratio=width/height,stage=$('video').parentElement;
  stage.style.setProperty('--source-aspect',`${width} / ${height}`);
  stage.style.setProperty('--preview-max-width',`${460*ratio}px`);
  const scale=Math.min(162/width,126/height),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
  const canvas=$('scrubCanvas');canvas.width=w*2;canvas.height=h*2;
  canvas.style.width=`${w}px`;canvas.style.height=`${h}px`;
}
function loadMedia(m){
  resetScrub();
  setPreviewAspect(m.width,m.height);
  media=m;previewing=false;browserPlayable=true;$('dropzone').hidden=true;$('demoLine').hidden=true;$('source').hidden=false;$('replace').hidden=false;$('trimFields').disabled=false;$('settingsFields').disabled=false;
  $('fileName').textContent=m.name;$('fileMeta').textContent=`${m.width} × ${m.height} · ${formatSize(m.size)}`;
  const isGif=/\.gif$/i.test(m.name);$('video').pause();$('video').hidden=isGif;$('gifSource').hidden=!isGif;$('previewNotice').hidden=true;
  $('setStart').disabled=isGif;$('setEnd').disabled=isGif;$('previewClip').disabled=isGif;
  if(isGif){$('video').removeAttribute('src');$('video').load();$('gifSource').src=m.url;}else{$('gifSource').removeAttribute('src');$('video').src=m.url;}
  $('start').value=0;$('end').value=round(Math.min(m.duration,10));
  for(const id of ['startRange','endRange','start','end']) $(id).max=m.duration;
  $('lockRatio').checked=true;setWidth(Math.min(480,m.width));
  $('result').hidden=true;$('progressWrap').hidden=true;latest=null;error();setBusy(false);update();
}
async function upload(file){
  if(!file||busy)return;if(file.size>2*1024**3){error('文件不能超过 2 GB。');return;}
  error();setBusy(true);$('progressWrap').hidden=false;$('progressBar').style.width='0%';$('progressText').textContent='正在读取本地文件…';
  try{
    const m=await new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();xhr.open('POST','/api/upload');xhr.setRequestHeader('X-File-Name',encodeURIComponent(file.name));xhr.setRequestHeader('Content-Type','application/octet-stream');
      xhr.upload.onprogress=e=>{if(e.lengthComputable){$('progressBar').style.width=`${e.loaded/e.total*100}%`;$('progressText').textContent=e.loaded===e.total?'正在读取视频信息…':`正在读取文件 ${Math.round(e.loaded/e.total*100)}%`;}};
      xhr.onerror=()=>reject(new Error('读取失败，请确认工具仍在运行，文件未超过 2 GB。'));
      xhr.onload=()=>{try{const data=JSON.parse(xhr.responseText);xhr.status<300?resolve(data):reject(new Error(data.error));}catch{reject(new Error('读取失败，请重试。'));}};xhr.send(file);
    });loadMedia(m);
  }catch(e){error(e.message);}finally{setBusy(false);$('progressWrap').hidden=true;}
}
$('dropzone').onclick=()=>{if(!busy)$('file').click();};$('replace').onclick=()=>$('file').click();
$('dropzone').onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();$('file').click();}};
$('file').onchange=e=>{upload(e.target.files[0]);e.target.value='';};
for(const event of ['dragenter','dragover']) $('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.add('dragover');});
for(const event of ['dragleave','drop']) $('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.remove('dragover');});
$('dropzone').addEventListener('drop',e=>upload(e.dataTransfer.files[0]));
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
$('demo').onclick=async()=>{if(busy)return;setBusy(true);error();try{loadMedia(await api('/api/demo',{}));}catch(e){error(e.message);}finally{setBusy(false);}};
$('video').addEventListener('error',()=>{if(!media||/\.gif$/i.test(media.name))return;browserPlayable=false;$('previewNotice').hidden=false;$('previewClip').disabled=true;$('setStart').disabled=true;$('setEnd').disabled=true;});
$('video').addEventListener('timeupdate',()=>{if(previewing&&$('video').currentTime>=+$('end').value){$('video').pause();previewing=false;}});
$('previewClip').onclick=async()=>{if(!browserPlayable)return;if(+$('end').value<=+$('start').value){error('结束时间必须晚于开始时间。');return;}error();resetScrub();$('video').currentTime=+$('start').value;previewing=true;try{await $('video').play();}catch{previewing=false;error('此文件暂时无法在浏览器预览，仍可尝试转换。');}};
function resetScrub(){
  scrubTarget=null;scrubSequence++;scrubDragging=false;clearTimeout(scrubTimer);clearTimeout(scrubHide);scrubRequest?.abort();scrubRequest=null;
  $('scrubPreview').hidden=true;$('scrubFrame').hidden=true;
  if(scrubURL){URL.revokeObjectURL(scrubURL);scrubURL=null;}
}
function drawScrub(source){
  const canvas=$('scrubCanvas'),ctx=canvas.getContext('2d');
  const w=source.videoWidth||source.naturalWidth,h=source.videoHeight||source.naturalHeight;
  if(!w||!h)return;
  const scale=Math.min(canvas.width/w,canvas.height/h),dw=w*scale,dh=h*scale;
  ctx.fillStyle='#18241f';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,(canvas.width-dw)/2,(canvas.height-dh)/2,dw,dh);
  $('scrubPreview').classList.remove('loading');
}
function seekScrub(){
  const video=$('video');if(scrubTarget===null||video.readyState<1||video.seeking)return;
  if(Math.abs(video.currentTime-scrubTarget)>.012){video.currentTime=scrubTarget;}
  else if(video.readyState>=2)drawScrub(video);
}
$('video').addEventListener('seeked',()=>{if(scrubTarget===null)return;if(Math.abs($('video').currentTime-scrubTarget)>.012)seekScrub();else drawScrub($('video'));});
$('video').addEventListener('loadeddata',seekScrub);
$('video').addEventListener('loadedmetadata',()=>setPreviewAspect($('video').videoWidth,$('video').videoHeight));
$('gifSource').addEventListener('load',()=>setPreviewAspect($('gifSource').naturalWidth,$('gifSource').naturalHeight));
$('video').addEventListener('play',resetScrub);
async function fetchScrubFrame(){
  if(scrubTarget===null||!media)return;
  const seq=scrubSequence,current=media.id,target=scrubTarget;
  const controller=new AbortController();scrubRequest=controller;
  try{
    const response=await fetch(`/api/frame?mediaId=${encodeURIComponent(current)}&time=${target.toFixed(2)}`,{signal:controller.signal});
    if(!response.ok)throw Error('preview');
    const blob=await response.blob();if(seq!==scrubSequence)return;
    const url=URL.createObjectURL(blob),img=new Image();
    img.onload=()=>{if(seq!==scrubSequence){URL.revokeObjectURL(url);return;}if(scrubURL)URL.revokeObjectURL(scrubURL);scrubURL=url;$('scrubFrame').src=url;$('scrubFrame').hidden=false;drawScrub(img);};
    img.onerror=()=>URL.revokeObjectURL(url);img.src=url;
  }catch(e){if(e.name!=='AbortError'&&seq===scrubSequence){$('scrubTime').textContent='画面暂未就绪，请稍后重试';$('scrubPreview').classList.remove('loading');}}
  finally{if(scrubRequest===controller)scrubRequest=null;}
}
function showScrub(which,time){
  if(!media)return;previewing=false;$('video').pause();clearTimeout(scrubHide);
  scrubSequence++;scrubTarget=Math.min(Math.max(0,time),Math.max(0,media.duration-.05));
  const preview=$('scrubPreview'),track=$('startRange').parentElement,width=track.clientWidth;
  preview.hidden=false;preview.classList.add('loading');
  const half=preview.offsetWidth/2;
  preview.style.left=`${Math.max(half,Math.min(width-half,time/media.duration*width))}px`;
  $('scrubTime').textContent=`${which==='start'?'起点':'终点'} ${time.toFixed(2)} 秒`;
  if(browserPlayable&&!/\.gif$/i.test(media.name)){$('scrubFrame').hidden=true;seekScrub();}
  else {clearTimeout(scrubTimer);scrubRequest?.abort();scrubTimer=setTimeout(fetchScrubFrame,90);}
  if(!scrubDragging)scrubHide=setTimeout(()=>{$('scrubPreview').hidden=true;},1600);
}
function changeTrim(which,value){
  if(!media)return;const other=which==='start'?'end':'start';
  const limit=which==='start'?Math.max(0,+$(other).value-.1):media.duration;
  const floor=which==='end'?Math.min(media.duration,+$(other).value+.1):0;
  $(which).value=round(Math.min(limit,Math.max(floor,value)));update();
  showScrub(which,+$(which).value);
}
for(const id of ['start','end']) {
  $(id).oninput=()=>{update();const t=+$(id).value;if(media&&Number.isFinite(t)&&t>=0&&t<=media.duration)showScrub(id,t);};
  const slider=$(id+'Range');slider.oninput=e=>changeTrim(id,+e.target.value);
  slider.addEventListener('pointerdown',()=>{scrubDragging=true;showScrub(id,+slider.value);});
}
function finishScrubDrag(){if(!scrubDragging)return;scrubDragging=false;clearTimeout(scrubHide);scrubHide=setTimeout(()=>{$('scrubPreview').hidden=true;},1600);}
window.addEventListener('pointerup',finishScrubDrag);window.addEventListener('pointercancel',finishScrubDrag);
$('setStart').onclick=()=>changeTrim('start',$('video').currentTime);$('setEnd').onclick=()=>changeTrim('end',$('video').currentTime);
$('fullLength').onclick=()=>{$('start').value=0;$('end').value=media.duration;update();showScrub('start',0);};
$('width').onchange=()=>setWidth(+$('width').value);
$('height').onchange=()=>{if($('lockRatio').checked&&media){const height=Math.min(1920,Math.max(16,+$('height').value));setWidth(height*media.width/media.height);}else update();};
$('lockRatio').onchange=()=>setWidth(+$('width').value);
document.querySelectorAll('[data-width]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-width]').forEach(x=>x.classList.toggle('selected',x===b));setWidth(b.dataset.width==='original'?media.width:+b.dataset.width);});
document.querySelectorAll('[data-quality]').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('[data-quality]').forEach(x=>x.classList.toggle('selected',x===b));
  const presets={small:[8,64,'bayer'],balanced:[12,128,'bayer'],clear:[20,256,'sierra2_4a']};
  const [fps,colors,dither]=presets[b.dataset.quality];$('fps').value=fps;$('colors').value=colors;$('dither').value=dither;update();
});
for(const id of ['fps','colors','dither']) $(id).addEventListener('input',()=>{document.querySelectorAll('[data-quality]').forEach(x=>x.classList.remove('selected'));update();});
$('targetEnabled').onchange=update;
function params(){return {mediaId:media.id,start:+$('start').value,end:+$('end').value,width:+$('width').value,height:+$('height').value,fps:+$('fps').value,colors:+$('colors').value,dither:$('dither').value,targetMB:$('targetEnabled').checked?+$('targetMB').value:0};}
$('convert').onclick=async()=>{
  if(!media||busy||outputBusy)return;error();
  if(!outputReady){error('导出位置尚未读取成功，请刷新页面重试。');return;}
  if($('outputDir').value.trim()!==savedOutputDir){error('导出位置尚未保存，请先点击“保存位置”。');$('saveOutput').focus();return;}
  if($('targetEnabled').checked&&(!Number.isFinite(+$('targetMB').value)||+$('targetMB').value<.01||+$('targetMB').value>100)){error('目标体积需在 0.01–100 MB 之间。');return;}
  setBusy(true);$('video').pause();previewing=false;$('convert').textContent='正在制作…';$('progressWrap').hidden=false;$('progressBar').style.width='0%';$('progressText').textContent='正在准备…';
  try{const job=await api('/api/convert',params());jobId=job.id;$('cancel').hidden=false;poll();}catch(e){error(e.message);finish();}
};
async function poll(){
  try{
    const job=await api(`/api/jobs/${jobId}`);$('progressBar').style.width=`${job.progress}%`;$('progressText').textContent=`${job.message}${job.status==='running'?` ${job.progress}%`:''}`;
    if(job.status==='running'){polling=setTimeout(poll,600);return;}
    if(job.status==='done')showResult(job);else if(job.status==='error')error(job.message);
    finish();
  }catch(e){$('progressText').textContent='连接暂时中断，正在重试…';polling=setTimeout(poll,1800);}
}
function finish(){clearTimeout(polling);jobId=null;setBusy(false);$('cancel').hidden=true;$('cancel').disabled=false;$('convert').innerHTML='生成 GIF <span>↗</span>';}
$('cancel').onclick=async()=>{if(!jobId)return;$('cancel').disabled=true;try{await api(`/api/jobs/${jobId}/cancel`,{});}catch(e){error(e.message);$('cancel').disabled=false;}};
function showResult(job){
  latest=job.result;const r=latest;$('resultImage').src=r.url;$('resultSize').textContent=formatSize(r.bytes);$('resultMeta').textContent=`${r.width} × ${r.height} px · ${r.duration.toFixed(2)} 秒 · ${r.fps} fps · ${r.colors} 色`;
  const percent=(1-r.bytes/media.size)*100;$('resultComparison').textContent=percent>=0?`比源文件小 ${percent.toFixed(1)}%`:`比源文件大 ${(r.bytes/media.size).toFixed(1)} 倍；GIF 通常比视频更大，可降低尺寸或启用目标体积。`;
  $('resultWarning').hidden=r.targetMet;$('resultWarning').textContent=job.message;$('resultStatus').textContent=r.targetMet?'已完成':'未达到目标体积';
  $('download').href=r.url+'?download=1';$('download').download=r.name;$('savedPath').textContent=`已自动保存：${r.savedPath}`;$('result').hidden=false;$('result').scrollIntoView({behavior:'smooth',block:'nearest'});
}
$('editResult').onclick=async()=>{if(!latest||busy)return;const r=latest;try{const res=await fetch(r.url);if(!res.ok)throw new Error('无法读取生成的 GIF。');await upload(new File([await res.blob()],r.name,{type:'image/gif'}));window.scrollTo({top:0,behavior:'smooth'});}catch(e){error(e.message);}};
update();
function showOutput(info,message){
  savedOutputDir=info.outputDir;$('outputDir').value=savedOutputDir;$('outputDir').title=savedOutputDir;
  $('chooseOutput').hidden=!info.canChooseFolder;outputReady=true;
  $('outputHint').textContent=message||'将自动保存到此文件夹，下次打开继续使用。';
  document.querySelector('.export-footnote').textContent='无限循环播放 · 自动保存至上方导出位置';
}
async function saveOutput(body){
  const info=await api('/api/settings/output',body);showOutput(info,'导出位置已保存，下次打开继续使用。');
}
async function outputAction(action){
  if(busy||outputBusy)return;error();outputBusy=true;setBusy(busy);
  try{await action();}catch(e){error(e.message);$('outputHint').textContent='未更改已保存的位置，请检查后重试。';}
  finally{outputBusy=false;setBusy(busy);}
}
$('saveOutput').onclick=()=>outputAction(()=>saveOutput({outputDir:$('outputDir').value.trim()}));
$('resetOutput').onclick=()=>outputAction(()=>saveOutput({reset:true}));
$('chooseOutput').onclick=()=>outputAction(async()=>{
  $('outputHint').textContent='请在系统窗口中选择文件夹…';
  const result=await api('/api/choose-output',{});
  if(result.cancelled){$('outputHint').textContent='已取消选择，导出位置未改变。';return;}
  await saveOutput({outputDir:result.outputDir});
});
$('outputDir').oninput=()=>{$('outputHint').textContent=$('outputDir').value.trim()===savedOutputDir?'将自动保存到此文件夹，下次打开继续使用。':'路径尚未保存，点击“保存位置”后生效。';};
$('outputDir').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('saveOutput').click();}};
$('openOutput').onclick=()=>outputAction(()=>api('/api/open-output',{}));
api('/api/app-info').then(info=>{
  showOutput(info);
  if(!info.packaged)return;
  $('desktopControls').hidden=false;
  $('quitApp').onclick=async()=>{
    if(busy){error('请先完成或取消当前任务。');return;}
    try{await api('/api/quit',{});$('desktopControls').textContent='工具已退出。可以关闭本页；下次双击应用即可再次使用。';setBusy(true);$('convert').textContent='已退出';clearInterval(heartbeat);}
    catch(e){error(e.message);}
  };
  const heartbeat=setInterval(()=>{if(document.visibilityState==='visible')api('/api/health').catch(()=>{});},60000);
}).catch(()=>{error('无法读取导出位置。请重启工具后刷新页面。');$('outputHint').textContent='无法读取设置，请重启工具后刷新。';});
