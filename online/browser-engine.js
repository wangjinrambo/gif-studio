import {FFmpeg} from './vendor/ffmpeg/index.js';

const MAX_FILE=200*1024*1024;
const media=new Map(),jobs=new Map();
let engine=null,engineLoad=null,queue=Promise.resolve(),activeJob=null,logs=[],loadedInput=null,directory=null;
const base=new URL('.',import.meta.url);
const directoryReady=readDirectory().then(handle=>{directory=handle;}).catch(()=>{});

function directoryDB(){return new Promise((resolve,reject)=>{
  const req=indexedDB.open('gif-studio-online',1);
  req.onupgradeneeded=()=>req.result.createObjectStore('preferences');
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});}
async function readDirectory(){const db=await directoryDB();try{return await new Promise((resolve,reject)=>{const req=db.transaction('preferences').objectStore('preferences').get('directory');req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}finally{db.close();}}
async function rememberDirectory(handle){try{const db=await directoryDB();try{await new Promise((resolve,reject)=>{const tx=db.transaction('preferences','readwrite');tx.objectStore('preferences').put(handle,'directory');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}}catch{/* Private browsing may disallow persistence; this session still works. */}}
function outputInfo(){return {packaged:false,outputDir:directory?`已选择：${directory.name}`:'浏览器下载（保存 GIF）',canChooseFolder:typeof window.showDirectoryPicker==='function',defaultOutputDir:'浏览器下载（保存 GIF）'};}
function status(message,progress){if(activeJob?.status==='running'){activeJob.message=message;if(progress!==undefined)activeJob.progress=progress;}}
async function ready(){
  if(engine?.loaded)return engine;
  if(engineLoad)return engineLoad;
  const instance=new FFmpeg();engine=instance;
  instance.on('log',({message})=>{logs.push(message);if(logs.length>300)logs.shift();});
  instance.on('progress',({time})=>{if(activeJob?.status==='running'&&activeJob.encoding)activeJob.progress=Math.max(25,Math.min(98,25+Math.round(time/(activeJob.duration*1000000)*73)));});
  status('首次使用，正在载入转换程序（约 31 MB）…',0);
  engineLoad=instance.load({coreURL:new URL('vendor/core/ffmpeg-core.js',base).href,wasmURL:new URL('vendor/core/ffmpeg-core.wasm',base).href})
    .then(()=>instance).catch(e=>{instance.terminate();if(engine===instance)engine=null;throw new Error('转换程序载入失败，请检查网络或浏览器是否支持 WebAssembly，然后重试。');}).finally(()=>{engineLoad=null;});
  return engineLoad;
}
function exclusive(fn){const result=queue.then(fn,fn);queue=result.catch(()=>{});return result;}
async function inputFile(ff,m){
  if(loadedInput?.id===m.id)return loadedInput.path;
  if(loadedInput)await ff.deleteFile(loadedInput.path).catch(()=>{});
  const ext=(m.name.match(/\.[a-z0-9]+$/i)||['.mp4'])[0],file='input'+ext;
  await ff.writeFile(file,new Uint8Array(await m.file.arrayBuffer()));loadedInput={id:m.id,path:file};return file;
}
function browserMetadata(file,url){return new Promise((resolve,reject)=>{
  if(/\.gif$/i.test(file.name))return reject(Error('GIF metadata requires decoder'));
  const video=document.createElement('video');video.preload='metadata';
  const timer=setTimeout(()=>finish(Error('metadata timeout')),7000);
  function finish(err,value){clearTimeout(timer);video.onloadedmetadata=null;video.onerror=null;video.removeAttribute('src');video.load();err?reject(err):resolve(value);}
  video.onloadedmetadata=()=>{if(!Number.isFinite(video.duration)||!video.videoWidth)finish(Error('invalid metadata'));else finish(null,{duration:video.duration,width:video.videoWidth,height:video.videoHeight});};
  video.onerror=()=>finish(Error('browser decoder unavailable'));video.src=url;
});}
async function decoderMetadata(m){return exclusive(async()=>{
  const ff=await ready(),input=await inputFile(ff,m);logs=[];await ff.exec(['-hide_banner','-i',input]);
  const log=logs.join('\n'),d=log.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/),line=log.split('\n').find(s=>/Stream.*Video:/.test(s)),s=line?.match(/\b(\d{2,5})x(\d{2,5})\b/);
  if(!d||!s)throw Error('无法读取这个文件，请选择有效的视频或动态 GIF。');
  let width=+s[1],height=+s[2];if(Math.abs(+(log.match(/rotation of (-?[\d.]+)/)?.[1]||0))%180===90)[width,height]=[height,width];
  return {duration:+d[1]*3600 + +d[2]*60 + +d[3],width,height};
});}
export async function uploadMedia(file,onProgress=()=>{}){
  if(activeJob?.status==='running')throw Error('请先完成或取消当前转换。');
  if(file.size>MAX_FILE)throw Error('网页版单个文件不能超过 200 MB，请使用更短的视频或桌面版。');
  if(!/\.(mp4|mov|mkv|webm|avi|m4v|gif|wmv|flv|mpeg|mpg|ts)$/i.test(file.name))throw Error('请选择视频文件或 GIF。');
  const m={id:crypto.randomUUID(),name:file.name,size:file.size,file,url:URL.createObjectURL(file)};onProgress('正在读取本地视频…');
  try{let metadata;try{metadata=await browserMetadata(file,m.url);}catch{onProgress('正在载入转换程序并读取文件信息…');metadata=await decoderMetadata(m);}Object.assign(m,metadata);
    for(const old of media.values())URL.revokeObjectURL(old.url);media.clear();media.set(m.id,m);return {...m,file:undefined};
  }catch(e){URL.revokeObjectURL(m.url);throw e;}
}
export async function frameBlob(id,time,signal){
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  if(activeJob?.status==='running')throw Error('正在转换');
  return exclusive(async()=>{
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    const m=media.get(id);if(!m||!Number.isFinite(time))throw Error('源文件不存在');
    const ff=await ready(),input=await inputFile(ff,m);
    try{const code=await ff.exec(['-ss',String(Math.min(Math.max(0,time),Math.max(0,m.duration-.05))),'-i',input,'-frames:v','1','-vf','scale=480:270:force_original_aspect_ratio=decrease','-y','frame.jpg']);if(code!==0)throw Error('无法读取这一帧');
      const data=await ff.readFile('frame.jpg');return new Blob([data],{type:'image/jpeg'});
    }finally{await ff.deleteFile('frame.jpg').catch(()=>{});}
  });
}
function validate(p,m){
  for(const [key,min,max] of [['start',0,m.duration],['end',0,m.duration+.02],['width',16,1920],['height',16,1920],['fps',1,30],['colors',8,256],['targetMB',0,100]])if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw Error(`${key} 参数不在允许范围内。`);
  if(p.end-p.start<.1||p.end-p.start>120)throw Error('网页版截取片段需要在 0.1–120 秒之间。');
  if(p.width*p.height*p.fps*(p.end-p.start)>180000000)throw Error('当前设置占用内存较大，请缩短片段或降低尺寸、帧率。');
  if(!['bayer','sierra2_4a','none'].includes(p.dither))throw Error('无效的颜色处理方式');
  return {...p,width:Math.round(p.width),height:Math.round(p.height),fps:Math.round(p.fps),colors:Math.round(p.colors),end:Math.min(p.end,m.duration)};
}
async function convert(job,m,p,folder){
  let ff;
  try{
    ff=await ready();if(job.status==='cancelled')return;
    const input=await inputFile(ff,m),length=p.end-p.start,target=p.targetMB*1048576;let cfg={...p};
    for(let pass=1;pass<=9;pass++){
      if(job.status==='cancelled')return;
      job.pass=pass;job.encoding=false;status(pass===1?'正在生成 GIF…':`正在压缩，第 ${pass} 次优化…`,0);
      const vf=`fps=${cfg.fps},scale=${cfg.width}:${cfg.height}:flags=lanczos,setsar=1`;
      let code=await ff.exec(['-y','-ss',String(p.start),'-t',String(length),'-i',input,'-an','-vf',`${vf},palettegen=max_colors=${cfg.colors}:stats_mode=diff`,'-frames:v','1','-update','1','palette.png']);
      if(code!==0)throw Error('无法解码这个文件，或浏览器可用内存不足。请缩短片段或降低尺寸。');
      job.encoding=true;status(job.message,25);
      const dither=cfg.dither==='bayer'?'bayer:bayer_scale=3':cfg.dither;
      code=await ff.exec(['-y','-ss',String(p.start),'-t',String(length),'-i',input,'-i','palette.png','-filter_complex',`[0:v]${vf}[v];[v][1:v]paletteuse=dither=${dither}:diff_mode=rectangle[out]`,'-map','[out]','-an','-loop','0','output.gif']);
      if(code!==0)throw Error('GIF 生成失败，请缩短片段或降低尺寸后重试。');
      const data=await ff.readFile('output.gif');
      if(!target||data.length<=target||pass===9){
        const stem=m.name.replace(/\.[^.]+$/,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,60)||'animation';
        const name=`${stem}_${cfg.width}x${cfg.height}_${job.id.slice(0,8)}.gif`,blob=new Blob([data],{type:'image/gif'});
        let savedPath='尚未保存到磁盘，请点击“下载 GIF”。',saveWarning='';
        if(folder){try{const handle=await folder.getFileHandle(name,{create:true}),w=await handle.createWritable();try{await w.write(blob);await w.close();}catch(e){await w.abort().catch(()=>{});throw e;}savedPath=`已保存至所选文件夹：${folder.name} / ${name}`;}catch{saveWarning='未能写入所选文件夹，请点击“下载 GIF”保存。';savedPath=saveWarning;}}
        const targetMet=!target||data.length<=target;
        job.result={name,bytes:data.length,width:cfg.width,height:cfg.height,fps:cfg.fps,colors:cfg.colors,duration:length,targetMet,url:URL.createObjectURL(blob),savedPath,saveWarning};
        job.status='done';job.progress=100;job.message=targetMet?'GIF 已生成':'已生成，但仍超过目标体积，请缩短片段或降低尺寸。';return;
      }
      const factor=Math.max(.45,Math.min(.88,Math.sqrt(target/data.length)*.91));
      cfg.width=Math.max(16,Math.round(cfg.width*factor));cfg.height=Math.max(16,Math.round(cfg.height*factor));cfg.fps=Math.min(cfg.fps,Math.max(5,Math.floor(cfg.fps*.88)));cfg.colors=Math.min(cfg.colors,Math.max(16,Math.floor(cfg.colors*.8)));cfg.dither='bayer';
    }
  }catch(e){if(job.status!=='cancelled'){job.status='error';job.message=e.message||'浏览器转换失败，请降低参数后重试。';}}
  finally{if(ff?.loaded){await Promise.all(['palette.png','output.gif'].map(file=>ff.deleteFile(file).catch(()=>{})));}if(activeJob===job)activeJob=null;}
}
export async function api(route,body){
  if(route==='/api/app-info'){await directoryReady;return outputInfo();}
  if(route==='/api/demo'){const response=await fetch(new URL('sample.mp4',base));if(!response.ok)throw Error('无法读取示例');return uploadMedia(new File([await response.blob()],'示例动画.mp4',{type:'video/mp4'}));}
  if(route==='/api/choose-output'){
    if(!window.showDirectoryPicker)throw Error('这个浏览器使用下载方式保存，请点击“下载 GIF”。');
    try{directory=await window.showDirectoryPicker({id:'gif-studio-export',mode:'readwrite'});await rememberDirectory(directory);return {cancelled:false,outputDir:outputInfo().outputDir};}catch(e){if(e.name==='AbortError')return {cancelled:true};throw Error('未能获得文件夹权限，可以使用下载方式保存。');}
  }
  if(route==='/api/settings/output'){if(body.reset){directory=null;await rememberDirectory(null);}return outputInfo();}
  if(route==='/api/convert'){
    if(activeJob)throw Error('已有转换正在进行');const m=media.get(body.mediaId);if(!m)throw Error('请重新选择源文件');const p=validate(body,m);
    if(directory&&await directory.requestPermission({mode:'readwrite'})!=='granted')throw Error('未获得所选文件夹的写入权限，请重新选择文件夹，或恢复默认以使用下载方式保存。');
    const job={id:crypto.randomUUID(),status:'running',progress:0,pass:1,message:'正在准备…',duration:p.end-p.start};activeJob=job;jobs.set(job.id,job);exclusive(()=>convert(job,m,p,directory));return {id:job.id};
  }
  const match=route.match(/^\/api\/jobs\/([\w-]+)(\/cancel)?$/);
  if(match){const job=jobs.get(match[1]);if(!job)throw Error('任务不存在');
    if(match[2]&&job.status==='running'){job.status='cancelled';job.message='已取消';engine?.terminate();engine=null;engineLoad=null;loadedInput=null;}
    return {...job};
  }
  throw Error('不支持的操作');
}
