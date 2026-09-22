import {mkdir,readFile,writeFile,copyFile,readdir,stat} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import yazl from 'yazl';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dest=path.join(root,'dist','web-online');
await mkdir(path.join(dest,'vendor','ffmpeg'),{recursive:true});await mkdir(path.join(dest,'vendor','core'),{recursive:true});await mkdir(path.join(dest,'licenses'),{recursive:true});
for(const name of await readdir(path.join(root,'node_modules','@ffmpeg','ffmpeg','dist','esm')))if(name.endsWith('.js'))await copyFile(path.join(root,'node_modules','@ffmpeg','ffmpeg','dist','esm',name),path.join(dest,'vendor','ffmpeg',name));
for(const name of ['ffmpeg-core.js','ffmpeg-core.wasm'])await copyFile(path.join(root,'node_modules','@ffmpeg','core','dist','esm',name),path.join(dest,'vendor','core',name));
for(const name of ['style.css','sample.mp4'])await copyFile(path.join(root,'web',name),path.join(dest,name));
await copyFile(path.join(root,'online','browser-engine.js'),path.join(dest,'browser-engine.js'));
let html=await readFile(path.join(root,'web','index.html'),'utf8');
html=html.replace('href="/style.css"','href="./style.css"').replace('src="/app.js"','src="./app.js"').replace('href="/"','href="./"')
  .replace('本地工作台','网页版').replace('本机处理 · 无需上传云端','浏览器内处理 · 视频不上传')
  .replace('最大 2 GB','最大 200 MB').replace('保存 GIF <span>↓</span>','下载 GIF <span>↓</span>')
  .replace('id="outputDir" class="output-path" type="text"','id="outputDir" class="output-path" type="text" readonly')
  .replace('id="saveOutput" class="secondary"','id="saveOutput" hidden class="secondary"').replace('id="openOutput" class="text-button"','id="openOutput" hidden class="text-button"')
  .replace('原尺寸</button>','原尺寸</button>').replace('剪辑 / 缩放 / 压缩','Mac / Windows · 浏览器通用')
  .replace('<main>','<main><div class="online-note">无需安装 · 首次转换需载入约 31 MB 程序 · 单段最多 120 秒。转换期间请保持此页面打开。</div>');
await writeFile(path.join(dest,'index.html'),html);
await writeFile(path.join(dest,'.nojekyll'),'');
let js=await readFile(path.join(root,'web','app.js'),'utf8');
function replaceBlock(start,end,text){const a=js.indexOf(start),b=js.indexOf(end,a);if(a<0||b<0)throw Error('App integration marker missing: '+start);js=js.slice(0,a)+text+js.slice(b);}
replaceBlock('async function api(url,body) {','function setBusy(value)','');
replaceBlock('async function upload(file){',"$('dropzone').onclick",`async function upload(file){
  if(!file||busy)return;error();setBusy(true);$('progressWrap').hidden=false;$('progressBar').style.width='0%';
  try{const m=await uploadMedia(file,message=>{$('progressText').textContent=message;});loadMedia(m);}
  catch(e){error(e.message);}finally{setBusy(false);$('progressWrap').hidden=true;}
}
`);
const oldFrame="const response=await fetch(`/api/frame?mediaId=${encodeURIComponent(current)}&time=${target.toFixed(2)}`,{signal:controller.signal});\n    if(!response.ok)throw Error('preview');\n    const blob=await response.blob();";
if(!js.includes(oldFrame))throw Error('Frame adapter marker missing');
js=js.replace(oldFrame,'const blob=await frameBlob(current,target,controller.signal);');
js=js.replace("$('download').href=r.url+'?download=1'","$('download').href=r.url").replace('`已自动保存：${r.savedPath}`','r.savedPath')
  .replace("$('resultWarning').hidden=r.targetMet;$('resultWarning').textContent=job.message;","$('resultWarning').hidden=r.targetMet&&!r.saveWarning;$('resultWarning').textContent=[r.targetMet?'':job.message,r.saveWarning].filter(Boolean).join(' ');")
  .replace("message||'将自动保存到此文件夹，下次打开继续使用。'","info.canChooseFolder?'可选择本机文件夹；未选择时点击“下载 GIF”保存。浏览器可能要求重新授权。':'当前浏览器使用下载方式保存。' ")
  .replace("'无限循环播放 · 自动保存至上方导出位置'","'无限循环播放 · 支持下载到 Mac / Windows'")
  .replace("'导出位置已保存，下次打开继续使用。'","'保存方式已更新。'")
  .replaceAll('请重启工具后刷新页面','请刷新页面重试').replaceAll('请重启工具后刷新','请刷新页面重试');
await writeFile(path.join(dest,'app.js'),"import {api,uploadMedia,frameBlob} from './browser-engine.js';\n"+js);
await writeFile(path.join(dest,'style.css'),(await readFile(path.join(dest,'style.css'),'utf8'))+'\n.online-note{font-size:11px;color:#5a7650;background:#edf4e6;border:1px solid #dce7d2;padding:11px 16px;border-radius:8px;margin-bottom:25px;line-height:1.7}.output-path[readonly]{background:#f7f9f4;color:#6d7d64}\n');
await copyFile(path.join(root,'LICENSE'),path.join(dest,'licenses','APP-LICENSE.txt'));
await copyFile(path.join(root,'packaging','licenses','GPL-2.0.txt'),path.join(dest,'licenses','GPL-2.0.txt'));
await copyFile(path.join(root,'node_modules','@ffmpeg','ffmpeg','package.json'),path.join(dest,'licenses','ffmpeg-wrapper-package.json'));
await copyFile(path.join(root,'node_modules','@ffmpeg','core','package.json'),path.join(dest,'licenses','ffmpeg-core-package.json'));
await writeFile(path.join(dest,'licenses','SOURCES.txt'),'ffmpeg.wasm wrapper 0.12.15: MIT. https://github.com/ffmpegwasm/ffmpeg.wasm\nFFmpeg WASM core 0.12.10: GPL-2.0-or-later. https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/packages/core\nThe runtime is shipped unmodified. Its FFmpeg and third-party build sources are available in the upstream repository and build scripts.\n');
for(const name of ['_headers','vercel.json','nginx.conf','Dockerfile','netlify.toml','部署说明.md'])await copyFile(path.join(root,'online',name),path.join(dest,name));
const zip=new yazl.ZipFile(),zipPath=path.join(root,'dist','GIF-Studio-Web-Deploy.zip');const done=pipeline(zip.outputStream,createWriteStream(zipPath));
async function add(dir,prefix=''){for(const ent of await readdir(dir,{withFileTypes:true})){const rel=prefix+ent.name;ent.isDirectory()?await add(path.join(dir,ent.name),rel+'/'):zip.addFile(path.join(dir,ent.name),rel);}}
await add(dest);zip.end();await done;
console.log('Static site:',dest);console.log('Deploy ZIP:',zipPath,Math.round((await stat(zipPath)).size/1048576)+' MB');
