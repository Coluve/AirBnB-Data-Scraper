const puppeteer = require('puppeteer');
const fs = require('fs').promises;

(async () => {
    // Read and parse the airbnb_urls.txt file
    const cityUrlsContent = await fs.readFile('airbnb_urls.txt', 'utf8');
    const cityUrlPairs = cityUrlsContent.split('\n').reduce((acc, line, index) => {
        if (line.trim() === '') return acc; // Skip empty lines

        const splitIndex = line.indexOf(': ');
        if (splitIndex === -1) {
            console.error(`Invalid line format at line ${index + 1}: ${line}`);
            return acc;
        }

        const city = line.substring(0, splitIndex).trim();
        const url = line.substring(splitIndex + 2).trim();
        acc.push({ city, url });
        return acc;
    }, []);

    const browser = await puppeteer.launch({ headless: false });

    // Iterate over each city and its URL
    for (const { city, url } of cityUrlPairs) {
        const page = await browser.newPage();
        let collectedUrls = [];
        let currentPage = url;

        do {
            await page.goto(currentPage, { waitUntil: 'networkidle2' });
            await page.waitForSelector('a[href*="/rooms/"]', { visible: true });

            await autoScroll(page);

            const urls = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href*="/rooms/"]'));
                return links.map(link => link.href);
            });

            collectedUrls.push(...urls); // Collect all URLs

            const nextPageButton = await page.$('a[aria-label="Next page"]');
            if (nextPageButton && !await page.evaluate(el => el.disabled, nextPageButton)) {
                await nextPageButton.click();
                await page.waitForNavigation({ waitUntil: 'networkidle2' });
                currentPage = await page.url();
            } else {
                break;
            }

            // Introduce a delay
            await page.waitForTimeout(2000);
        } while (true);

        // Remove duplicates and save the URLs
        const uniqueUrls = [...new Set(collectedUrls)];
        const fileName = `url_list_${city.replace(/\s/g, '_')}.txt`;
        await fs.writeFile(fileName, uniqueUrls.join('\n'));

        // Close the page
        await page.close();
    }

    // Close the browser
    await browser.close();
})();

async function autoScroll(page){
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= document.body.scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}
