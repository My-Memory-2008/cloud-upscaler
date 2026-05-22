// api/upscale.js - Vercel Serverless Key Rotator Proxy
export const config = {
  api: {
    bodyParser: false, // Disables standard body parsing so the raw image stream passes cleanly
  },
};

const apiKeys = [
  "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",
  "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",
  "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"
  // Paste all 20 to 50 of your tokens cleanly here separated by commas
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
  // Set explicit CORS permissions to allow your frontend interface to connect securely
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Collect the raw image buffer payload stream passing from the frontend webpage
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const rawImageBuffer = Buffer.concat(buffers);
    const contentType = req.headers['content-type'] || 'image/png';

    let success = false;
    let finalOutputData = null;
    let lastErrorMsg = "No nodes responded";

    // Failover cycle loops through multiple active models and keys
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
              "Content-Type": contentType
            },
            body: rawImageBuffer
          });

          if (hfResponse.status === 503) {
            // Model cold-starting: wait 2.5 seconds and continue the loop cycle
            await new Promise(r => setTimeout(r, 2500));
            continue;
          }

          if (hfResponse.ok) {
            finalOutputData = await hfResponse.arrayBuffer();
            success = true;
            break;
          }

          lastErrorMsg = `Status code: ${hfResponse.status}`;
        } catch (err) {
          lastErrorMsg = err.message;
        }
      }
      if (success) break;
    }

    if (success && finalOutputData) {
      res.setHeader('Content-Type', contentType);
      return res.status(200).send(Buffer.from(finalOutputData));
    } else {
      return res.status(502).json({ error: true, details: lastErrorMsg });
    }

  } catch (globalError) {
    return res.status(500).json({ error: true, details: globalError.message });
  }
}
