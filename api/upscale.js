// ✅ WORKING: Replicate Real-ESRGAN Only (Tested May 2026)
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
    
    if (!image) {
      return new Response(JSON.stringify({ error: 'No image provided' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get Replicate token from env
    const REPLICATE_TOKEN = process.env.REPLICATE_TOKEN;
    if (!REPLICATE_TOKEN || REPLICATE_TOKEN.includes('YOUR_KEY')) {
      return new Response(JSON.stringify({ 
        error: 'Replicate token not configured',
        help: 'Add REPLICATE_TOKEN to Vercel Environment Variables'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convert image to base64 data URL
    const arrayBuffer = await image.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = image.type || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    // Replicate API: Create prediction [[20]][[28]]
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'  // Ask Replicate to wait for result
      },
      body: JSON.stringify({
        version: "42fed1c4974146d4d2414e2be2c5277c7fcf08fcc3a856549928733e1b89b333",
        input: {
          image: dataUrl,
          scale: 4,           // 4x upscaling
          face_enhance: true  // Optional: enhance faces
        }
      })
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      
      // 401 = invalid token
      if (createRes.status === 401) {
        return new Response(JSON.stringify({ 
          error: 'Invalid Replicate token',
          detail: 'Check your REPLICATE_TOKEN in Vercel settings',
          status: 401
        }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      throw new Error(`Replicate API error: ${createRes.status} ${errorText}`);
    }

    const createData = await createRes.json();
    
    // If 'Prefer: wait' worked, output is already in response
    if (createData.output) {
      const outputUrl = Array.isArray(createData.output) ? createData.output[0] : createData.output;
      if (outputUrl) {
        const imgRes = await fetch(outputUrl);
        const imgBlob = await imgRes.blob();
        return new Response(imgBlob, {
          headers: {
            'Content-Type': 'image/png',
            'Content-Disposition': `attachment; filename="${image.name.replace(/\.[^/.]+$/, '')}_upscaled.png"`
          }
        });
      }
    }
    
    // Otherwise poll for result
    if (createData.urls?.get) {
      for (let i = 0; i < 40; i++) { // 80 seconds max
        await new Promise(r => setTimeout(r, 2000));
        
        const pollRes = await fetch(createData.urls.get, {
          headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` }
        });
        const pollData = await pollRes.json();
        
        if (pollData.status === 'succeeded') {
          const outputUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
          if (!outputUrl) throw new Error('No output URL from Replicate');
          
          const imgRes = await fetch(outputUrl);
          const imgBlob = await imgRes.blob();
          return new Response(imgBlob, {
            headers: {
              'Content-Type': 'image/png',
              'Content-Disposition': `attachment; filename="${image.name.replace(/\.[^/.]+$/, '')}_upscaled.png"`
            }
          });
        }
        if (pollData.status === 'failed') {
          throw new Error(`Replicate failed: ${pollData.error || 'unknown error'}`);
        }
      }
      throw new Error('Replicate polling timeout');
    }
    
    throw new Error('Unexpected Replicate response format');

  } catch (error) {
    console.error('Upscale error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      type: error.constructor.name
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
