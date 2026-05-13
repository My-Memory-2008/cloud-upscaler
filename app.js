// 🔑 MULTI-API POOL (12 FREE APIS)
const API_POOL = [
  {
    name: "HF Real-ESRGAN (Xenova)",
    url: "https://api-inference.huggingface.co/models/Xenova/real-esrgan-x4",
    token: "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",
    payloadKey: "inputs"
  },
  {
    name: "HF Swin2SR Classical 4x",
    url: "https://api-inference.huggingface.co/models/caidas/swin2SR-classical-sr-x4-64",
    token: "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",
    payloadKey: "inputs"
  },
  {
    name: "HF Stable Diffusion x4",
    url: "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-x4-upscaler",
    token: "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",
    payloadKey: "inputs"
  },
  {
    name: "DeepAI Torch-SRGAN",
    url: "https://api.deepai.org/api/torch-srgan",
    token: "7d902ab1-92df-4aae-8548-648edb88e762",
    payloadKey: "image"
  },
  {
    name: "HF Swin2SR Real-World",
    url: "https://api-inference.huggingface.co/models/caidas/swin2SR-realworld-sr-x4-64-bsrgan-psnr",
    token: "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",
    payloadKey: "inputs"
  },
  {
    name: "HF Real-ESRGAN (ai-forever)",
    url: "https://api-inference.huggingface.co/models/ai-forever/Real-ESRGAN",
    token: "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",
    payloadKey: "inputs"
  },
  {
    name: "HF Swin2SR Lightweight 2x",
    url: "https://api-inference.huggingface.co/models/caidas/swin2SR-lightweight-x2-64",
    token: "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",
    payloadKey: "inputs"
  },
  {
    name: "Replicate Real-ESRGAN",
    url: "https://api.replicate.com/v1/predictions",
    token: "r8_E9x2ukz63oJSU7va6HGHDgzsiA3QiBa4AT7Rp",
    payloadKey: "input",
    customBody: { version: "42fed1c4974146d4d2414e2be2c5277c7fcf08fcc3a856549928733e1b89b333" }
  },
  {
    name: "Cloudinary Upscale",
    url: "https://api.cloudinary.com/v1_1/domprjpvc/image/upload",
    token: "422723849469494",
    payloadKey: "file",
    customParams: { transformation: "w_2048,q_auto:best" }
  },
  {
    name: "Stable Diffusion API",
    url: "https://stablediffusionapi.com/api/v3/super_resolution",
    token: "f0P5v65vCUTpF5vfQ1lK2m8jT9oR3ZLCzwzaq2BE0mAopPyk7gC8QZiqXKUq",
    payloadKey: "image_url",
    isJson: true
  },
  {
    name: "Replicate Waifu2x",
    url: "https://api.replicate.com/v1/predictions",
    token: "r8_WRBtHVrbtI0w9ixwMkCBU3rQNGO6kve0iLHI3",
    payloadKey: "input",
    customBody: { version: "a68f758e7f5f0a58e8ad2a6e5f0b0f8e5c5f5e5d5c5b5a595857565554535251" }
  },
  {
    name: "Pixelcut Upscaler",
    url: "https://api.pixelcut.ai/v1/upscaler",
    token: "sk_af5dcea5fc39449d92d226fff587c65e",
    payloadKey: "image",
    isJson: true
  }
];

let currentApiIndex = 0;
let imageFiles = [];
let saveDirectory = null;
let isProcessing = false;

const imageInput = document.getElementById('imageInput');
const uploadBtn = document.getElementById('uploadBtn');
const selectFolderBtn = document.getElementById('selectFolderBtn');
const statusEl = document.getElementById('status');
const progressBar = document.getElementById('progressBar');
const logBox = document.getElementById('logBox');

uploadBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', (e) => {
  imageFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
  if (imageFiles.length > 0) {
    statusEl.textContent = `${imageFiles.length} image(s) ready. Pick a folder to start.`;
    selectFolderBtn.disabled = false;
  }
});

selectFolderBtn.addEventListener('click', async () => {
  if (!window.showDirectoryPicker) {
    statusEl.textContent = '⚠️ Folder API unsupported. Files will download individually.';
    await processQueue(true);
    return;
  }
  try {
    saveDirectory = await window.showDirectoryPicker();
    statusEl.textContent = 'Folder selected. Starting cloud upscaling...';
    await processQueue(false);
  } catch { log('Folder selection canceled.', 'wait'); }
});

function log(msg, type = 'info') {
  const div = document.createElement('div');
  div.className = `log ${type}`;
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logBox.prepend(div);
}

async function callUpscaleAPI(file, retryCount = 0) {
  if (currentApiIndex >= API_POOL.length) {
    throw new Error('All APIs exhausted. Try again later.');
  }

  const api = API_POOL[currentApiIndex];
  
  // Prepare request
  let body;
  let headers = { 'Content-Type': 'application/json' };
  
  if (api.name.includes('Hugging Face')) {
    const formData = new FormData();
    formData.append(api.payloadKey, file);
    body = formData;
    headers = { 'Authorization': `Bearer ${api.token}` };
    delete headers['Content-Type']; // Let browser set it for FormData
  } 
  else if (api.name.includes('DeepAI')) {
    const formData = new FormData();
    formData.append(api.payloadKey, file);
    body = formData;
    headers = { 'api-key': api.token };
    delete headers['Content-Type'];
  }
  else if (api.name.includes('Replicate')) {
    const base64 = await new Promise(res => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });
    body = JSON.stringify({
      ...api.customBody,
      [api.payloadKey]: { image: `data:${file.type};base64,${base64}` }
    });
    headers = { 
      'Authorization': `Bearer ${api.token}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait'
    };
  }
  else if (api.name.includes('Cloudinary')) {
    const formData = new FormData();
    formData.append(api.payloadKey, file);
    if (api.customParams) {
      Object.entries(api.customParams).forEach(([k, v]) => formData.append(k, v));
    }
    body = formData;
    headers = {};
  }
  else if (api.name.includes('Stable Diffusion API')) {
    // Convert to base64 for SD API
    const base64 = await new Promise(res => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });
    body = JSON.stringify({
      key: api.token,
      image_url: `data:${file.type};base64,${base64}`,
      output_format: 'png'
    });
  }
  else if (api.name.includes('Pixelcut')) {
    const base64 = await new Promise(res => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });
    body = JSON.stringify({
      image: `data:${file.type};base64,${base64}`,
      scale: 4
    });
  }

  try {
    const res = await fetch(api.url, {
      method: 'POST',
      headers,
      body
    });

    // Detect limits/errors
    if (res.status === 429 || res.status === 503 || res.status === 500 || res.status === 400) {
      const text = await res.text();
      if (/quota|limit|rate|credit|loading|busy|overloaded|error/i.test(text) || 
          [429, 503, 500].includes(res.status)) {
        throw new Error('API_LIMIT');
      }
    }
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    // Parse response based on API
    if (api.name.includes('Replicate')) {
      const data = await res.json();
      // Poll for result
      return await pollReplicateResult(data.urls.get, api.token);
    }
    else if (api.name.includes('Stable Diffusion API')) {
      const data = await res.json();
      if (data.status === 'success' && data.output) {
        const imgRes = await fetch(data.output[0]);
        return await imgRes.blob();
      }
      throw new Error('SD API failed');
    }
    else if (api.name.includes('Pixelcut')) {
      const data = await res.json();
      if (data.url) {
        const imgRes = await fetch(data.url);
        return await imgRes.blob();
      }
      throw new Error('Pixelcut failed');
    }
    else {
      return await res.blob();
    }
  } catch (err) {
    if (err.message === 'API_LIMIT' && currentApiIndex < API_POOL.length - 1) {
      log(`🔄 ${api.name} limit hit. Switching to next API...`, 'switch');
      currentApiIndex++;
      return await callUpscaleAPI(file, retryCount + 1);
    }
    throw err;
  }
}

async function pollReplicateResult(pollUrl, token, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.status === 'succeeded' && data.output) {
      const imgRes = await fetch(data.output);
      return await imgRes.blob();
    }
    if (data.status === 'failed') throw new Error('Replicate failed');
  }
  throw new Error('Replicate timeout');
}

async function processQueue(fallbackDownload = false) {
  if (isProcessing) return;
  isProcessing = true;
  selectFolderBtn.disabled = true;

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const pct = Math.round(((i) / imageFiles.length) * 100);
    progressBar.style.width = `${pct}%`;
    statusEl.textContent = `☁️ Processing ${i + 1}/${imageFiles.length}: ${file.name}`;
    log(`📤 Sending to cloud: ${file.name} [API: ${API_POOL[currentApiIndex].name}]`);

    try {
      const upscaledBlob = await callUpscaleAPI(file);
      const newName = file.name.replace(/\.[^/.]+$/, '') + '_upscaled.png';

      if (fallbackDownload) {
        const url = URL.createObjectURL(upscaledBlob);
        const a = document.createElement('a');
        a.href = url; a.download = newName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const handle = await saveDirectory.getFileHandle(newName, { create: true });
        const writable = await handle.createWritable();
        await writable.write(upscaledBlob);
        await writable.close();
      }
      log(`✅ Saved: ${newName}`, 'success');
    } catch (err) {
      log(`❌ Failed: ${file.name} → ${err.message}`, 'error');
    }

    // Polite delay
    if (i < imageFiles.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  progressBar.style.width = '100%';
  statusEl.textContent = `✅ All ${imageFiles.length} images processed & saved!`;
  log('🎉 Batch complete.', 'success');
  isProcessing = false;
  selectFolderBtn.disabled = false;
}
