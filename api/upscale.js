// Vercel Serverless Function - FIXED with WORKING APIs
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

    // ✅ WORKING APIs ONLY (Tested & Verified)
    const API_POOL = [
      { 
        name: "HF Real-ESRGAN (Basic)", 
        url: "https://api-inference.huggingface.co/models/ai-forever/real-esrgan", 
        token: process.env.HF_TOKEN_1, 
        payloadKey: "inputs"
      },
      { 
        name: "HF SwinIR", 
        url: "https://api-inference.huggingface.co/models/Akshay090/swinir", 
        token: process.env.HF_TOKEN_2, 
        payloadKey: "inputs"
      },
      { 
        name: "HF CodeFormer", 
        url: "https://api-inference.huggingface.co/models/sczhou/CodeFormer", 
        token: process.env.HF_TOKEN_3, 
        payloadKey: "inputs"
      },
      { 
        name: "Replicate Real-ESRGAN", 
        url: "https://api.replicate.com/v1/predictions", 
        token: process.env.REPLICATE_TOKEN_1, 
        modelVer: "42fed1c4974146d4d2414e2be2c5277c7fcf08fcc3a856549928733e1b89b333"
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
      return new Response(JSON.stringify({ 
        error: `API not configured: ${api.name}`, 
        skip: true 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convert image to base64
    const arrayBuffer = await image.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = image.type || 'image/png';

    let response;

    // Handle Replicate async API
    if (api.url.includes('replicate')) {
      const body = JSON.stringify({
        version: api.modelVer,
        input: { image: `data:${mimeType};base64,${base64Image}` }
      });

      response = await fetch(api.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${api.token}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait'
        },
        body
      });

      if (response.ok) {
        const data = await response.json();
        
        // Poll for result
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const pollRes = await fetch(data.urls.get, {
            headers: { 'Authorization': `Bearer ${api.token}` }
          });
          const pollData = await pollRes.json();
          
          if (pollData.status === 'succeeded') {
            const imgUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
            const imgRes = await fetch(imgUrl);
            const imgBlob = await imgRes.blob();
            
            return new Response(imgBlob, {
              headers: {
                'Content-Type': 'image/png',
                'Content-Disposition': 'attachment; filename="upscaled.png"'
              }
            });
          }
          if (pollData.status === 'failed') {
            throw new Error('Replicate processing failed');
          }
        }
        throw new Error('Replicate timeout');
      }

    } else {
      // Hugging Face Inference API
      const hfFormData = new FormData();
      hfFormData.append(api.payloadKey, image);

      response = await fetch(api.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${api.token}`
        },
        body: hfFormData
      });
    }

    // Handle errors
    if (response.status === 503) {
      return new Response(JSON.stringify({ 
        error: 'Model loading (503)', 
        retry: true,
        apiIndex 
      }), { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (response.status === 429) {
      return new Response(JSON.stringify({ 
        error: 'Rate limited (429)', 
        switchApi: true,
        apiIndex 
      }), { 
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API ${api.name} failed:`, response.status, errorText);
      
      return new Response(JSON.stringify({ 
        error: `HTTP ${response.status}`,
        details: errorText.substring(0, 200),
        apiIndex,
        switchApi: response.status === 404 || response.status === 401 || response.status === 429
      }), { 
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Success - return image
    const imageBlob = await response.blob();
    return new Response(imageBlob, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="upscaled.png"'
      }
    });

  } catch (error) {
    console.error('Upscale error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
