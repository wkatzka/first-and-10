/**
 * Generates font-preview.png from font-preview.html so you can view
 * the sprite font sample without opening a browser.
 *
 * Run from project root: node scripts/font-preview-screenshot.mjs
 * Output: first-and-10/public/font-preview.png
 */

import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const htmlPath = path.join(projectRoot, "public", "font-preview.html");
const outputPath = path.join(projectRoot, "public", "font-preview.png");
const fileUrl = "file://" + htmlPath;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });

  await page.goto(fileUrl, { waitUntil: "domcontentloaded" });
  // Wait for image + canvas rendering (sheet onload runs the script)
  await page.waitForFunction(
    () => {
      const c = document.getElementById("sample1");
      return c && c.width > 0 && c.height > 0;
    },
    { timeout: 5000 }
  ).catch(() => {});

  await page.waitForTimeout(300);

  // Screenshot just the sample-text section so the image is compact
  const section = await page.$(".preview-section:first-of-type");
  if (section) {
    await section.screenshot({ path: outputPath });
    console.log("Saved:", outputPath);
  } else {
    await page.screenshot({ path: outputPath, fullPage: true });
    console.log("Saved (full page):", outputPath);
  }

  await browser.close();
})();
