// ✅ SIMPLIFIED API POOL (Only working APIs)
const API_POOL = [
  { name: "HF Real-ESRGAN (Basic)" },
  { name: "HF SwinIR" },
  { name: "HF CodeFormer" },
  { name: "Replicate Real-ESRGAN" }
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
  } catch { 
    log('Folder selection canceled.', 'wait'); 
  }
});

function log(msg, type = 'info') {
  const div = document.createElement('div');
  div.className = `log ${type}`;
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logBox.prepend(div);
}

async function callUpscaleAPI(file) {
  if (currentApiIndex >= API_POOL.length) {
    throw new Error('All APIs exhausted. Try again later.');
  }

  const api = API_POOL[currentApiIndex];
  log(`🔄 Trying API ${currentApiIndex + 1}/${API_POOL.length}: ${api.name}`, 'wait');

  try {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('apiIndex', currentApiIndex.toString());

    const response = await fetch('/api/upscale', {
      method: 'POST',
      body: formData
    });

    if (response.status === 400) {
      const errorData = await response.json();
      
      if (errorData.skip) {
        log(`⏭️ ${api.name} not configured. Skipping...`, 'switch');
        currentApiIndex++;
        return await callUpscaleAPI(file);
      }
      throw new Error(errorData.error || 'Bad request');
    }

    if (response.status === 429 || response.status === 503) {
      log(`🚫 ${api.name} rate limited/loading. Switching...`, 'switch');
      currentApiIndex++;
      await new Promise(r => setTimeout(r, 1000));
      return await callUpscaleAPI(file);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${errorData.details || errorData.error || response.statusText}`);
    }

    log(`✅ ${api.name} succeeded!`, 'success');
    return await response.blob();

  } catch (error) {
    if (currentApiIndex < API_POOL.length - 1) {
      log(`❌ ${api.name} failed: ${error.message}`, 'error');
      currentApiIndex++;
      await new Promise(r => setTimeout(r, 500));
      return await callUpscaleAPI(file);
    }
    throw error;
  }
}

async function processQueue(fallbackDownload = false) {
  if (isProcessing) return;
  isProcessing = true;
  selectFolderBtn.disabled = true;
  currentApiIndex = 0;

  log(`🚀 Starting batch processing of ${imageFiles.length} image(s)...`, 'info');

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const pct = Math.round(((i) / imageFiles.length) * 100);
    progressBar.style.width = `${pct}%`;
    statusEl.textContent = `☁️ Processing ${i + 1}/${imageFiles.length}: ${file.name}`;
    log(`📤 Image ${i + 1}/${imageFiles.length}: ${file.name}`, 'info');

    try {
      const upscaledBlob = await callUpscaleAPI(file);
      const newName = file.name.replace(/\.[^/.]+$/, '') + '_upscaled.png';

      if (fallbackDownload) {
        const url = URL.createObjectURL(upscaledBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = newName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        log(`⬇️ Downloaded: ${newName}`, 'success');
      } else {
        const handle = await saveDirectory.getFileHandle(newName, { create: true });
        const writable = await handle.createWritable();
        await writable.write(upscaledBlob);
        await writable.close();
        log(`💾 Saved to folder: ${newName}`, 'success');
      }
    } catch (err) {
      log(`❌ Failed: ${file.name} → ${err.message}`, 'error');
    }

    if (i < imageFiles.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  progressBar.style.width = '100%';
  statusEl.textContent = `✅ All ${imageFiles.length} images processed & saved!`;
  log('🎉 Batch complete!', 'success');
  isProcessing = false;
  selectFolderBtn.disabled = false;
}
