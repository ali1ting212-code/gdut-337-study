// 手写答卷保存在本机 IndexedDB；导出记录时可一并打包照片。
const PhotoStore=(()=>{
  const DB_NAME='study337.photos.v1',STORE='photos';
  let pending;
  function open(){
    if(!('indexedDB' in window))return Promise.reject(Error('此浏览器不支持本地照片存储'));
    if(!pending)pending=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error??Error('无法打开照片存储'));
    });
    return pending;
  }
  async function put(blob,id=crypto.randomUUID()){
    const db=await open();return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({id,blob,createdAt:new Date().toISOString()});
      tx.oncomplete=()=>resolve(id);tx.onerror=()=>reject(tx.error??Error('照片保存失败'));
    });
  }
  async function get(id){const db=await open();return new Promise((resolve,reject)=>{const request=db.transaction(STORE).objectStore(STORE).get(id);request.onsuccess=()=>resolve(request.result?.blob??null);request.onerror=()=>reject(request.error??Error('照片读取失败'))})}
  async function clear(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error??Error('照片清空失败'))})}
  async function compress(file){
    if(!file.type.startsWith('image/'))throw Error('请选择照片文件');
    const url=URL.createObjectURL(file),img=new Image();
    try{
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('照片无法读取'));img.src=url});
      const limit=2200,scale=Math.min(1,limit/Math.max(img.naturalWidth,img.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.84));
      if(!blob)throw Error('照片处理失败');return blob;
    }finally{URL.revokeObjectURL(url)}
  }
  const toDataURL=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});
  async function exportPhotos(ids){const photos=[];for(const id of new Set(ids)){const blob=await get(id);if(blob)photos.push({id,data:await toDataURL(blob)})}return photos}
  async function importPhotos(photos){if(!Array.isArray(photos))return;for(const photo of photos){if(typeof photo.id!=='string'||!photo.data?.startsWith('data:image/'))continue;const blob=await(await fetch(photo.data)).blob();await put(blob,photo.id)}}
  return{put,get,clear,compress,exportPhotos,importPhotos};
})();
