
// api/upscale.js - Vercel Serverless Key Rotator Proxy
export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' }, // Expand memory boundary window limit for processing image strings
  },
};

const apiKeys = [
  "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",
  "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",
  "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"
  // Expand this pool with your gathered 20-50 tokens cleanly separated by commas
];

const models = [
  "https://huggingface.co",
  "https://huggingface.co"
];

let activeKeyIndex = 0;

function getNextKey() {
  const key = apiKeys[activeKeyIndex];
  activeKeyIndex = (activeKeyIndex + 1) % apiKeys.length;
  return key;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Correctly parse text-based JSON body payload package
    const { image, mimeType } = req.body;
    if (!image) return res.status(400).json({ error: 'Missing image token matrix' });

    // Transform clean base64 string layout back into pure binary buffer array files
    const imageBuffer = Buffer.from(image, 'base64');
    let success = false;
    let finalOutputData = null;

    for (let currentModel of models) {
      let keysTested = 0;
      while (keysTested < apiKeys.length && !success) {
        const token = getNextKey();
        keysTested++;

        try {
          const hfResponse = await fetch(currentModel, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": mimeType || 'image/png'
            },
            body: imageBuffer
          });

          if (hfResponse.status === 503) {
            await new Promise(r => setTimeout(r, 3000)); // Model loading wait cycle buffer
            continue;
          }

          if (hfResponse.ok) {
            finalOutputData = await hfResponse.arrayBuffer();
            success = true;
            break;
          }
        } catch (err) {}
      }
      if (success) break;
    }

    if (success && finalOutputData) {
      res.setHeader('Content-Type', mimeType || 'image/png');
      return res.status(200).send(Buffer.from(finalOutputData));
    } else {
      return res.status(502).json({ error: true });
    }

  } catch (globalError) {
    return res.status(500).json({ error: true, details: globalError.message });
  }
}
