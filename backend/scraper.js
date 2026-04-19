const axios = require("axios");
const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-IN,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  Referer: "https://www.bookswagon.com/",
  Connection: "keep-alive",
};

function parsePrice(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[₹,\s]/g, "").replace(/Rs\.?/i, "").trim();
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

function extractPriceFromEl($, el) {
  if (!el || !el.length) return null;
  for (const attr of ["content", "data-price", "data-amount", "value"]) {
    const p = parsePrice(el.attr(attr));
    if (p && p > 0) return p;
  }
  const p = parsePrice(el.text().trim());
  return p && p > 0 ? p : null;
}

async function scrapeBook(url) {
  const response = await axios.get(url, { headers: HEADERS, timeout: 20000, maxRedirects: 5 });
  const $ = cheerio.load(response.data);

  // ── Title ─────────────────────────────────────────────────────────────────
  let title = "Unknown Title";
  for (const sel of ["h1.product-title","h1[itemprop='name']",".product-name h1","h1"]) {
    const text = $(sel).first().text().trim();
    if (text && text.length > 2) { title = text; break; }
  }

  // ── Price ─────────────────────────────────────────────────────────────────
  // Confirmed BooksWagon selectors (from page inspection)
  const priceSelectors = [
    "#ctl00_phBody_ProductDetail_lblourPrice",
    "#ctl00_phBody_ProductDetail_lblOurPrice",
    "#ctl00_phBody_ProductDetail_lblSellingPrice",
    ".desktopprice .originalprice label",
    ".desktopprice .originalprice",
    ".mobileprice .a-price",
    ".a-price",
    ".originalprice label",
    ".originalprice",
    "#ctl00_phBody_ProductDetail1_lblourPrice",
    "#ctl00_phBody_ProductDetail1_lblOurPrice",
    "#lblOurPrice","#lblSellingPrice","#lblPrice",
    ".our-price",".ourprice",".selling-price",".sale-price",
    ".special-price",".discounted-price",".final-price",".product-price",
    "[itemprop='price']","meta[itemprop='price']",
  ];

  let price = null, matchedSelector = null;
  for (const sel of priceSelectors) {
    const el = $(sel).first();
    if (!el.length) continue;
    const p = extractPriceFromEl($, el);
    if (p && p > 0) { price = p; matchedSelector = sel; break; }
  }

  // Fallback: body text scan for ₹
  if (!price) {
    const matches = $("body").text().match(/₹\s*[\d,]+(?:\.\d+)?/g);
    if (matches) { price = parsePrice(matches[0]); matchedSelector = "body-scan"; }
  }

  // Fallback: JSON-LD
  if (!price) {
    $('script[type="application/ld+json"]').each((_, el) => {
      if (price) return;
      try {
        const json = JSON.parse($(el).html());
        const offers = json.offers;
        if (offers) { const p = parseFloat(offers.price || 0); if (p > 0) { price = p; matchedSelector = "json-ld"; } }
      } catch (_) {}
    });
  }

  console.log(`[SCRAPER] "${title.substring(0,60)}" → ₹${price ?? "NOT FOUND"} (${matchedSelector ?? "none"})`);

  if (!price) {
    console.warn("[SCRAPER] ⚠ Dumping ₹ elements:");
    $("*").each((_, el) => {
      const text = $(el).text().trim();
      if (text.includes("₹") && text.length < 80 && !$(el).children("*").length) {
        console.warn(`  <${el.tagName}#${$(el).attr("id")||""}> "${text}"`);
      }
    });
  }

  // ── Image ─────────────────────────────────────────────────────────────────
  const BASE = "https://www.bookswagon.com";

  const rawImage =
    $("img#imgProduct").attr("src") ||
    $("img#imgBook").attr("src") ||
    $("img#ctl00_phBody_ProductDetail_imgProduct").attr("src") ||
    $("img[id*='imgProduct']").first().attr("src") ||
    $("img[id*='imgBook']").first().attr("src") ||
    $("img.product-image").first().attr("src") ||
    $("img.book-cover").first().attr("src") ||
    $("img.bookimage").first().attr("src") ||
    $("[itemprop='image']").first().attr("src") ||
    $("[itemprop='image']").first().attr("content") ||
    $("meta[property='og:image']").attr("content") ||
    $("meta[name='twitter:image']").attr("content") ||
    null;

  // Resolve relative URLs → absolute
  let imageUrl = null;
  if (rawImage) {
    const trimmed = rawImage.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      imageUrl = trimmed;
    } else if (trimmed.startsWith("//")) {
      imageUrl = "https:" + trimmed;
    } else if (trimmed.startsWith("/")) {
      imageUrl = BASE + trimmed;
    } else if (trimmed.length > 0) {
      imageUrl = BASE + "/" + trimmed;
    }
  }

  console.log(`[SCRAPER] Image : ${imageUrl ?? "NOT FOUND"}`);

  return {
    title: title.replace(/\s+/g, " ").trim().substring(0, 300),
    price,
    imageUrl,
  };
}

module.exports = { scrapeBook };