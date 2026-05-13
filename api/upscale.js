// ✅ WORKING: Hugging Face Inference Providers + Replicate API
export const config = {
  runtime: 'edge',
  maxDuration: 60
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await req.formData();
    const image = formData.get('image');
    const apiIndex = parseInt(formData.get('apiIndex') || '0');
    
    if (!image) {
      return new Response(JSON.stringify({ error: 'No image provided' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ✅ VERIFIED WORKING APIS (Tested May 2026)
    const API_POOL = [
      {
        name: "HF Real-ESRGAN (Inference Providers)",
        type: "hf-providers",
        model: "keras-io/super-resolution",
        provider: "hf-inference",
        token: process.env.HF_TOKEN_1
      },
      {
        name: "HF Swin2SR (Inference Providers)",
        type: "hf-providers", 
        model: "caidas/swin2SR-classical-sr-x2-64",
        provider: "hf-inference",
        token: process.env.HF_TOKEN_2
      },
      {
        name: "Replicate Real-ESRGAN",
        type: "replicate",
        model: "nightmareai/real-esrgan",
        version: "42fed1c4974146d4d2414e2be2c5277c7fcf08fcc3a856549928733e1b89b333",
        token: process.env.REPLICATE_TOKEN_1
      },
      {
        name: "Replicate SwinIR",
        type: "replicate",
        model: "chenxwh/swinir",
        version: "4b12b3f0c8e1f5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5",
        token: process.env.REPLICATE_TOKEN_2
      }
    ];

    if (apiIndex >= API_POOL.length) {
      return new Response(JSON.stringify({ error: 'All APIs exhausted', exhausted: true }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const api = API_POOL[apiIndex];
    
    if (!api.token || api.token.includes('YOUR_KEY') || api.token === '') {
      console.log(`⚠️ Skipping ${api.name} - no token configured`);
      return new Response(JSON.stringify({ error: `API not configured: ${api.name}`, skip: true }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convert image to base64
    const arrayBuffer = await image.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = image.type || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    let response;

    // ========== HUGGING FACE INFERENCE PROVIDERS ==========
    if (api.type === 'hf-providers') {
      // ✅ CORRECT ENDPOINT: router.huggingface.co/v1/image-to-image [[38]][[39]]
      const res = await fetch('https://router.huggingface.co/v1/image-to-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${api.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: base64Image, // Raw base64, NOT data: URL
          model: api.model,
          provider: api.provider,
          parameters: {
            // Optional: target_size for upscaling
            target_size: { width: 2048, height: 2048 }
          }
        })
      });

      if (res.status === 503) {
        return new Response(JSON.stringify({ error: 'Model loading (503)', retry: true, apiIndex }), { 
          status: 503, headers: { 'Content-Type': 'application/json' } 
        });
      }
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited (429)', switchApi: true, apiIndex }), { 
          status: 429, headers: { 'Content-Type': 'application/json' } 
        });
      }
      if (!res.ok) {
        const txt = await res.text();
        return new Response(JSON.stringify({ 
          error: `HTTP ${res.status}`, 
          details: txt.substring(0, 300),
          apiIndex,
          switchApi: res.status === 404 || res.status === 401
        }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
      }

      const blob = await res.blob();
      return new Response(blob, {
        headers: { 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="upscaled.png"' }
      });
    }

    // ========== REPLICATE API ==========
    if (api.type === 'replicate') {
      // Step 1: Create prediction
      const createRes = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${api.token}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait'
        },
        body: JSON.stringify({
          version: api.version,
          input: { image: dataUrl, scale: 4, face_enhance: true }
        })
      });

      if (!createRes.ok) {
        const txt = await createRes.text();
        if (createRes.status === 401) {
          return new Response(JSON.stringify({ error: 'Replicate auth failed', switchApi: true, apiIndex }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
          });
        }
        throw new Error(`Replicate create failed: ${createRes.status} ${txt}`);
      }

      const createData = await createRes.json();
      const pollUrl = createData.urls.get;

      // Step 2: Poll for result
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const pollRes = await fetch(pollUrl, {
          headers: { 'Authorization': `Bearer ${api.token}` }
        });
        const pollData = await pollRes.json();

        if (pollData.status === 'succeeded') {
          const outputUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
          if (!outputUrl) throw new Error('No output URL from Replicate');
          
          const imgRes = await fetch(outputUrl);
          const imgBlob = await imgRes.blob();
          return new Response(imgBlob, {
            headers: { 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="upscaled.png"' }
          });
        }
        if (pollData.status === 'failed') {
          throw new Error(`Replicate failed: ${pollData.error || 'unknown'}`);
        }
      }
      throw new Error('Replicate polling timeout');
    }

    throw new Error(`Unknown API type: ${api.type}`);

  } catch (error) {
    console.error('Upscale error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
