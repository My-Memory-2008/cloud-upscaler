// ✅ Simplified: Single API (Replicate)
const API_POOL = [{ name: "Replicate Real-ESRGAN" }];

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
  log(`🔄 Sending to Replicate cloud...`, 'wait');

  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/upscale', {
      method: 'POST',
      body: formData
    });

    if (response.status === 401) {
      const err = await response.json();
      throw new Error(`Auth failed: ${err.detail || 'Invalid Replicate token'}`);
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${err.error || response.statusText}`);
    }

    log(`✅ Replicate succeeded!`, 'success');
    return await response.blob();

  } catch (error) {
    throw error;
  }
}

async function processQueue(fallbackDownload = false) {
  if (isProcessing) return;
  isProcessing = true;
  selectFolderBtn.disabled = true;

  log(`🚀 Starting batch of ${imageFiles.length} image(s)...`, 'info');

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    progressBar.style.width = `${Math.round(((i) / imageFiles.length) * 100)}%`;
    statusEl.textContent = `☁️ Processing ${i + 1}/${imageFiles.length}: ${file.name}`;
    log(`📤 ${file.name}`, 'info');

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

    // Delay between images to avoid rate limits
    if (i < imageFiles.length - 1) await new Promise(r => setTimeout(r, 3000));
  }

  progressBar.style.width = '100%';
  statusEl.textContent = `✅ All ${imageFiles.length} images processed!`;
  log('🎉 Batch complete!', 'success');
  isProcessing = false;
  selectFolderBtn.disabled = false;
}
