/**
 * AI Image Generator using OpenAI DALL-E 3
 * Generates unique trading card artwork for each player.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const { buildPhotorealisticPrompt, getTierConfig, getEraConfig, TIER_BACKGROUNDS } = require("./era-tier-prompts.js");

// OpenAI API configuration
const OPENAI_API_URL = "https://api.openai.com/v1/images/generations";

function looksLikeText(text) {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  // Any letters or digits = treat as text present
  return /[A-Za-z0-9]/.test(normalized);
}

async function detectAnyTextInImage(imagePath) {
  // Lazy-load to avoid overhead when disabled
  const { createWorker } = require("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(imagePath);

    // If tesseract returns obvious alphanumerics, fail.
    if (looksLikeText(data?.text)) return { hasText: true, raw: data?.text || "" };

    // More conservative: any word-like token with decent confidence
    const words = Array.isArray(data?.words) ? data.words : [];
    for (const w of words) {
      const conf = typeof w.confidence === "number" ? w.confidence : 0;
      const txt = (w.text || "").trim();
      if (conf >= 60 && looksLikeText(txt)) {
        return { hasText: true, raw: txt };
      }
    }

    return { hasText: false, raw: "" };
  } finally {
    await worker.terminate();
  }
}

/**
 * Generate a card image using OpenAI DALL-E 3
 * @param {object} player - Player data { name, team, position, season, tier, stats }
 * @param {string} outputPath - Where to save the generated image
 * @param {object} options - { apiKey, size, quality, useSimplePrompt }
 * @returns {Promise<{ path: string, prompt: string, revisedPrompt: string }>}
 */
async function generateCardWithAI(player, outputPath, options = {}) {
  const {
    apiKey = process.env.OPENAI_API_KEY,
    size = "1024x1792", // Trading card proportions (portrait)
    quality = "standard", // "standard" or "hd"
    /**
     * OCR mode:
     * - "off": don't run OCR
     * - "audit": run OCR once, report result, do NOT retry
     * - "enforce": run OCR and retry if any text detected
     */
    ocrMode = String(process.env.OCR_MODE || "off").toLowerCase(),
    ocrMaxTries = Number(process.env.OCR_MAX_TRIES || process.env.TEXT_FILTER_MAX_TRIES || 3),
  } = options;

  if (!apiKey) {
    throw new Error("OpenAI API key required. Set OPENAI_API_KEY environment variable or pass apiKey option.");
  }

  // Build the photorealistic prompt
  const prompt = buildPhotorealisticPrompt(player);
  const tierConfig = getTierConfig(player.tier || 5);
  const eraConfig = getEraConfig(player.season || 2020);

  console.log(`Generating AI image for ${player.name} (Tier ${player.tier}: ${tierConfig.name}, ${eraConfig.name})...`);

  const enforce = ocrMode === "enforce";
  const audit = ocrMode === "audit";
  const tries = enforce ? Math.max(1, ocrMaxTries) : 1;
  let lastRevisedPrompt = undefined;
  let lastError = undefined;

  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      // Call OpenAI API
      const response = await callOpenAI(apiKey, {
        model: "dall-e-3",
        prompt,
        n: 1,
        size,
        quality,
        response_format: "url",
      });

      if (!response.data || !response.data[0]) {
        throw new Error("No image returned from OpenAI");
      }

      const imageUrl = response.data[0].url;
      lastRevisedPrompt = response.data[0].revised_prompt;

      // Download and save the image
      await downloadImage(imageUrl, outputPath);

      let ocrResult = undefined;
      if (enforce || audit) {
        ocrResult = await detectAnyTextInImage(outputPath);
        if (enforce && ocrResult.hasText) {
          // Remove and retry
          try {
            fs.unlinkSync(outputPath);
          } catch {}
          throw new Error(`OCR detected text ('${String(ocrResult.raw).slice(0, 40)}...')`);
        }
      }

      console.log(`Saved: ${outputPath}`);
      return {
        path: outputPath,
        prompt,
        revisedPrompt: lastRevisedPrompt,
        ocr: ocrResult,
      };
    } catch (e) {
      lastError = e;
      if (attempt < tries) {
        console.log(`Retrying generation (attempt ${attempt + 1}/${tries}) due to: ${e.message}`);
        continue;
      }
      break;
    }
  }

  throw lastError || new Error("AI generation failed");
}

/**
 * Call OpenAI API
 */
function callOpenAI(apiKey, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);

    const url = new URL(OPENAI_API_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode !== 200) {
            reject(new Error(`OpenAI API error: ${parsed.error?.message || responseData}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Failed to parse OpenAI response: ${responseData}`));
        }
      });
    });

    req.on("error", (e) => {
      reject(new Error(`OpenAI request failed: ${e.message}`));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Download image from URL and save to file
 */
function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(outputPath);

    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, (res) => {
          res.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve(outputPath);
          });
        }).on("error", reject);
        return;
      }

      response.pipe(file);

      file.on("finish", () => {
        file.close();
        resolve(outputPath);
      });
    }).on("error", (err) => {
      fs.unlink(outputPath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

/**
 * Generate metadata for an AI-generated card
 */
function generateAICardMetadata(tokenId, player, imageUrl, generationInfo = {}) {
  const tierConfig = getTierConfig(player.tier || 5);
  const eraConfig = getEraConfig(player.season || 2020);

  const attributes = [
    { trait_type: "Player", value: player.name ?? "Unknown" },
    { trait_type: "Season", value: Number(player.season) },
    { trait_type: "Era", value: eraConfig.name },
    { trait_type: "Team", value: player.team ?? "—" },
    { trait_type: "Position", value: player.position ?? "—" },
    { trait_type: "Tier", value: player.tier },
    { trait_type: "Tier Name", value: tierConfig.name },
    { trait_type: "Art Style", value: "AI Generated Photorealistic" },
  ];

  // Add HOF flag if applicable
  if (player.isHOF || player.tier === 11) {
    attributes.push({ trait_type: "Hall of Fame", value: "Yes" });
  }

  // Add score if available
  if (player.score != null) {
    attributes.push({ trait_type: "Score", value: Math.round(player.score) });
  }

  // Add stats as traits
  const stats = player.stats || {};
  for (const [key, value] of Object.entries(stats)) {
    if (value != null) {
      const traitName = key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      attributes.push({
        trait_type: traitName,
        value: typeof value === "number" ? value : String(value),
      });
    }
  }

  return {
    name: `${player.season} ${player.name} (${tierConfig.name})`,
    description: `${player.name} · ${player.season} season · ${player.team} · ${tierConfig.name} · ${eraConfig.name} · AI-generated photorealistic artwork`,
    image: imageUrl,
    attributes,
    properties: {
      tier: player.tier,
      tierName: tierConfig.name,
      era: eraConfig.name,
      isHOF: player.isHOF || player.tier === 11,
      score: player.score,
      generatedWith: "DALL-E 3",
    },
  };
}

/**
 * Estimate cost for generating images
 * @param {number} count - Number of images
 * @param {string} quality - "standard" or "hd"
 * @param {string} size - Image size
 * @returns {object} - Cost estimate
 */
function estimateCost(count, quality = "standard", size = "1024x1792") {
  // DALL-E 3 pricing (as of 2024)
  const prices = {
    "standard": {
      "1024x1024": 0.04,
      "1024x1792": 0.08,
      "1792x1024": 0.08,
    },
    "hd": {
      "1024x1024": 0.08,
      "1024x1792": 0.12,
      "1792x1024": 0.12,
    },
  };

  const pricePerImage = prices[quality]?.[size] || 0.08;
  const totalCost = count * pricePerImage;

  return {
    count,
    quality,
    size,
    pricePerImage,
    totalCost,
    formatted: `$${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  };
}

module.exports = {
  generateCardWithAI,
  generateAICardMetadata,
  estimateCost,
  downloadImage,
};
