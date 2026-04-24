const puppeteer = require('puppeteer');

const generatePdf = async (html) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true
  });

  await browser.close();
  return pdf;
};

module.exports = { generatePdf };
