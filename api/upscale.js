// Vercel Serverless Function - Proxy for AI Upscaling (ALL 12 APIs)
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

    // ALL 12 APIs Configuration
    const API_POOL = [
      { 
        name: "HF Real-ESRGAN (Xenova)", 
        url: "https://api-inference.huggingface.co/models/Xenova/real-esrgan-x4", 
        token: process.env.HF_TOKEN_1, 
        payloadKey: "inputs",
        type: "form"
      },
      { 
        name: "HF Swin2SR Classical 4x", 
        url: "https://api-inference.huggingface.co/models/caidas/swin2SR-classical-sr-x4-64", 
        token: process.env.HF_TOKEN_2, 
        payloadKey: "inputs",
        type: "form"
      },
      { 
        name: "HF Stable Diffusion x4", 
        url: "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-x4-upscaler", 
        token: process.env.HF_TOKEN_3, 
        payloadKey: "inputs",
        type: "form"
      },
      { 
        name: "DeepAI Torch-SRGAN", 
        url: "https://api.deepai.org/api/torch-srgan", 
        token: process.env.DEEPAI_KEY, 
        payloadKey: "image",
        type: "form"
      },
      { 
        name: "HF Swin2SR Real-World", 
        url: "https://api-inference.huggingface.co/models/caidas/swin2SR-realworld-sr-x4-64-bsrgan-psnr", 
        token: process.env.HF_TOKEN_4, 
        payloadKey: "inputs",
        type: "form"
      },
      { 
        name: "HF Real-ESRGAN (ai-forever)", 
        url: "https://api-inference.huggingface.co/models/ai-forever/Real-ESRGAN", 
        token: process.env.HF_TOKEN_5, 
        payloadKey: "inputs",
        type: "form"
      },
      { 
        name: "HF Swin2SR Lightweight 2x", 
        url: "https://api-inference.huggingface.co/models/caidas/swin2SR-lightweight-x2-64", 
        token: process.env.HF_TOKEN_6, 
        payloadKey: "inputs",
        type: "form"
      },
      { 
        name: "Replicate Real-ESRGAN", 
        url: "https://api.replicate.com/v1/predictions", 
        token: process.env.REPLICATE_TOKEN_1, 
        payloadKey: "input",
        type: "async",
        modelVer: "42fed1c4974146d4d2414e2be2c5277c7fcf08fcc3a856549928733e1b89b333"
      },
      { 
        name: "Cloudinary Upscale", 
        url: "https://api.cloudinary.com/v1_1/" + (process.env.CLOUDINARY_CLOUD_NAME || 'demo') + "/image/upload", 
        token: process.env.CLOUDINARY_KEY, 
        payloadKey: "file",
        type: "form",
        transformation: "w_2048,q_auto:best"
      },
      { 
        name: "Stable Diffusion API", 
        url: "https://stablediffusionapi.com/api/v3/super_resolution", 
        token: process.env.SDAPI_KEY, 
        payloadKey: "image_url",
        type: "json"
      },
      { 
        name: "Replicate Waifu2x", 
        url: "https://api.replicate.com/v1/predictions", 
        token: process.env.REPLICATE_TOKEN_2, 
        payloadKey: "input",
        type: "async",
        modelVer: "a68f758e7f5f0a58e8ad2a6e5f0b0f8e5c5f5e5d5c5b5a595857565554535251"
      },
      { 
        name: "Pixelcut Upscaler", 
        url: "https://api.pixelcut.ai/v1/upscaler", 
        token: process.env.PIXELCUT_KEY, 
        payloadKey: "image",
        type: "json",
        scale: 4
      }
    ];

    // Validate API index
    if (apiIndex >= API_POOL.length) {
      return new Response(JSON.stringify({ error: 'Invalid API index', exhausted: true }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const api = API_POOL[apiIndex];
    
    // Check if token is configured
    if (!api.token || api.token.includes('YOUR_KEY') || api.token === '') {
      return new Response(JSON.stringify({ 
        error: `API token not configured for ${api.name}`, 
        api: api.name,
        skip: true 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convert image to base64 for APIs that need it
    const arrayBuffer = await image.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = image.type || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    let response;

    // Handle different API types
    if (api.type === 'async') {
      // Replicate async APIs
      const body = JSON.stringify({
        version: api.modelVer,
        input: { image: dataUrl }
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

    } else if (api.type === 'json') {
      // JSON-based APIs (Stable Diffusion API, Pixelcut)
      let body;
      if (api.url.includes('stablediffusionapi')) {
        body = JSON.stringify({
          key: api.token,
          image_url: dataUrl,
          output_format: 'png'
        });
      } else if (api.url.includes('pixelcut')) {
        body = JSON.stringify({
          image: dataUrl,
          scale: api.scale || 4
        });
      }

      response = await fetch(api.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': api.token
        },
        body
      });

      if (response.ok) {
        const data = await response.json();
        const imgUrl = data.output ? (Array.isArray(data.output) ? data.output[0] : data.output) : data.url;
        if (!imgUrl) throw new Error('No output URL in response');
        
        const imgRes = await fetch(imgUrl);
        const imgBlob = await imgRes.blob();
        return new Response(imgBlob, {
          headers: {
            'Content-Type': 'image/png',
            'Content-Disposition': 'attachment; filename="upscaled.png"'
          }
        });
      }

    } else {
      // FormData-based APIs (Hugging Face, DeepAI, Cloudinary)
      const apiFormData = new FormData();
      apiFormData.append(api.payloadKey, image);
      
      if (api.transformation) {
        apiFormData.append('transformation', api.transformation);
      }
      if (api.url.includes('cloudinary')) {
        apiFormData.append('upload_preset', 'cloud_upscaler'); // Create this preset in Cloudinary
      }

      const headers = {};
      if (api.url.includes('huggingface')) {
        headers['Authorization'] = `Bearer ${api.token}`;
      } else if (api.url.includes('deepai')) {
        headers['api-key'] = api.token;
      }

      response = await fetch(api.url, {
        method: 'POST',
        headers,
        body: apiFormData
      });

      if (response.ok) {
        const imageBlob = await response.blob();
        return new Response(imageBlob, {
          headers: {
            'Content-Type': 'image/png',
            'Content-Disposition': 'attachment; filename="upscaled.png"'
          }
        });
      }
    }

    // Handle errors
    const errorText = await response.text();
    
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

    return new Response(JSON.stringify({ 
      error: `HTTP ${response.status}: ${errorText}`,
      apiIndex,
      switchApi: response.status === 400 || response.status === 401 || response.status === 429
    }), { 
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Upscale error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
