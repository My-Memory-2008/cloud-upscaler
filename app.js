// 🔑 MULTI-API POOL (Client-side config for tracking which API to use)
const API_POOL = [
  { name: "HF Real-ESRGAN (Xenova)" },
  { name: "HF Swin2SR Classical 4x" },
  { name: "HF Stable Diffusion x4" },
  { name: "DeepAI Torch-SRGAN" },
  { name: "HF Swin2SR Real-World" },
  { name: "HF Real-ESRGAN (ai-forever)" },
  { name: "HF Swin2SR Lightweight 2x" },
  { name: "Replicate Real-ESRGAN" },
  { name: "Cloudinary Upscale" },
  { name: "Stable Diffusion API" },
  { name: "Replicate Waifu2x" },
  { name: "Pixelcut Upscaler" }
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
    throw new Error('All 12 APIs exhausted. Try again later.');
  }

  const api = API_POOL[currentApiIndex];
  log(`🔄 Trying API ${currentApiIndex + 1}/12: ${api.name}`, 'wait');

  try {
    // Create FormData for our proxy
    const formData = new FormData();
    formData.append('image', file);
    formData.append('apiIndex', currentApiIndex.toString());

    // Call our Vercel serverless proxy (CORS-free)
    const response = await fetch('/api/upscale', {
      method: 'POST',
      body: formData
    });

    // Handle specific error responses
    if (response.status === 400) {
      const errorData = await response.json();
      
      if (errorData.skip) {
        log(`⏭️ ${api.name} not configured. Skipping to next API...`, 'switch');
        currentApiIndex++;
        return await callUpscaleAPI(file); // Try next API
      }
      throw new Error(errorData.error || 'Bad request');
    }

    if (response.status === 429) {
      const errorData = await response.json();
      
      if (errorData.switchApi) {
        log(`🚫 ${api.name} rate limited (429). Switching to next API...`, 'switch');
        currentApiIndex++;
        await new Promise(r => setTimeout(r, 1000)); // Brief delay
        return await callUpscaleAPI(file); // Try next API
      }
    }

    if (response.status === 503) {
      const errorData = await response.json();
      
      if (errorData.retry || errorData.switchApi) {
        log(`⏳ ${api.name} model loading (503). Switching to next API...`, 'switch');
        currentApiIndex++;
        await new Promise(r => setTimeout(r, 1000)); // Brief delay
        return await callUpscaleAPI(file); // Try next API
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // Success! Return the blob
    log(`✅ ${api.name} succeeded!`, 'success');
    return await response.blob();

  } catch (error) {
    // Auto-switch to next API on error
    if (currentApiIndex < API_POOL.length - 1) {
      log(`❌ ${api.name} failed: ${error.message}`, 'error');
      currentApiIndex++;
      await new Promise(r => setTimeout(r, 500)); // Brief delay before retry
      return await callUpscaleAPI(file); // Retry with next API
    }
    throw error; // No more APIs to try
  }
}

async function processQueue(fallbackDownload = false) {
  if (isProcessing) return;
  isProcessing = true;
  selectFolderBtn.disabled = true;
  currentApiIndex = 0; // Reset to first API for new batch

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
        // Fallback: individual downloads for browsers without folder API
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
        // Save directly to chosen folder
        const handle = await saveDirectory.getFileHandle(newName, { create: true });
        const writable = await handle.createWritable();
        await writable.write(upscaledBlob);
        await writable.close();
        log(`💾 Saved to folder: ${newName}`, 'success');
      }
    } catch (err) {
      log(`❌ Failed: ${file.name} → ${err.message}`, 'error');
    }

    // Polite delay between images to avoid overwhelming APIs
    if (i < imageFiles.length - 1) {
      log(`⏱️ Waiting 2 seconds before next image...`, 'wait');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  progressBar.style.width = '100%';
  statusEl.textContent = `✅ All ${imageFiles.length} images processed & saved!`;
  log('🎉 Batch complete!', 'success');
  isProcessing = false;
  selectFolderBtn.disabled = false;
}
