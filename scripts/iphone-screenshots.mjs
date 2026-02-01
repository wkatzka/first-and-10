import { chromium, devices } from "playwright";

const iPhone = devices["iPhone 14 Pro"];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage(iPhone);

  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200); // allow font + first animations

  // Take a few frames spaced out in time so you can verify number sequence
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(800);
    await page.screenshot({ path: `iphone-frame-${i}.png`, fullPage: true });
    console.log("Saved", `iphone-frame-${i}.png`);
  }

  await browser.close();
})();

