const http = require('http');
const puppeteer = require('puppeteer');
const { MongoClient } = require('mongodb');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');


const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write('I am alive');
    res.end();
});

server.listen(8080, () => {
    console.log('Server is running at http://localhost:8080/');
});


// MongoDB connection URI
const uri = 'mongodb+srv://kongaleela123:Nitishkumar2002@cluster1.peswbwo.mongodb.net/';

// Database name
const dbName = 'test_database';

// Telegram bot API key and channel ID
const bot = new TelegramBot('6901177738:AAGxD0U452Gks2fzLCnm32PmUg6Qbcv-LRQ', { polling: false });
const channelId = '-1002134255316';

// Function to get the current time
function getCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour12: true });
    return timeString;
}

// Function to send message to Telegram channel
function sendMessageToChannel(message) {
    // Send message to the Telegram channel
    bot.sendMessage(channelId, message)
        .then(() => {})
        .catch(() => {});
}

async function emulateHumanBehavior() {
    // Random delay between 2 to 5 seconds
    const delay = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
    await delayExecution(delay);
}

function delayExecution(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to create the screenshots folder if it doesn't exist
 
// const folderPath = path.join(__dirname, 'screenshots');
// if (!fs.existsSync(folderPath)) {
//     fs.mkdirSync(folderPath);
//     }

// async function scrapeProductPage(page, url, title) {
//     const clip = {
//         x: 0,
//         y: 0,
//         width: 750,
//         height: 700
//     };

//     try {
//         // Set user agent
//         await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
//         // Set viewport
//         await page.setViewport({ width: 1366, height: 768 });
//         // Emulate human-like behavior
//         await emulateHumanBehavior();
//         await page.goto(url);
//         await page.waitForSelector("#imgTagWrapperId img");        
//         // Take screenshot
//         const screenshotPath = path.join(folderPath, `${title}.png`);
//         await page.screenshot({ path: screenshotPath, clip: clip });
//         return screenshotPath;
//     } catch (error) {
//         console.error('Error scraping product page:', error);
//         return null;
//     }
// }

// async function sendMessageWithImage(page, message, link, title) {
//     try {
//         // Send image
//         const image = await scrapeProductPage(page, link, title);
//         await bot.sendPhoto(channelId, image, { caption: message });

//         console.log('Message and image sent successfully:', message);
//     } catch (error) {
//         console.error('Error sending message and image:', error);
//     }
// }

async function scrapeAmazonProductPage(url, page) {
    try {
        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        // Set viewport
        await page.setViewport({ width: 1366, height: 768 });
        // Emulate human-like behavior
        await emulateHumanBehavior();
        await page.goto(url, { waitUntil: 'domcontentloaded' , timeout:120000});

        // Extract title
        const title = await page.$eval('div#titleSection span.a-size-large', element => element.textContent.trim());

        // Extract price
        let price = await page.$eval('span.a-price-whole', element => element.textContent.trim());

        if (!price) {
            price = await page.$eval('#priceblock_dealprice', element => element.textContent.trim());
        }

        return { title, price };
    } catch (error) {
        console.error('Error scraping product page:', error);
        return null;
    }
}

async function retrieveDataAndScrape() {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const currentTime = getCurrentTime();
    const mess_age = `Start time: ${currentTime}`;
    sendMessageToChannel(mess_age);
    try {
        await client.connect();
        const database = client.db(dbName);
        const originalPriceCollection = database.collection('test_collection');
        const priceDataCollection = database.collection('price_data');

        // Retrieve all documents from the original_price collection
        const products = await originalPriceCollection.find().toArray();

        // Store all links in an array
        const links = products.map(product => product.link);

        // Launch the browser
        const browser = await puppeteer.launch();

        let c = 0;
        // Iterate through each link
        for (const link of links) {
            c++;
            const page = await browser.newPage();
            console.log(`Scraping ${c}/${links.length} `);

            const { title, price } = await scrapeAmazonProductPage(link, page);

            // Check if the title exists in price_data collection
            const existingProduct = await priceDataCollection.findOne({ title });

            if (existingProduct) {
                console.log(`Title already exists in price_data collection`);

                // Compare prices
                const existingPrice = existingProduct.price;
                const existingPriceNumeric = parseFloat(existingPrice.replace(',', ''));
                const priceNumeric = parseFloat(price.replace(',', ''));
                if (existingPriceNumeric === priceNumeric) {
                    console.log(`Price for "${c}" is unchanged`);
                } else if (existingPriceNumeric > priceNumeric) {
                    console.log(`Price for "${c}" has decreased from ${existingPrice} to ${price}`);

                    const msg = `"${title}"\n\nPrice drop from ${existingPrice} to ${price}\n\n${link}`;
                    sendMessageToChannel(msg);


                    //await sendMessageWithImage(page, msg, link, title);
                    // Update the price in the collection
                    await priceDataCollection.updateOne(
                        { title },
                        { $set: { price } }
                    );
                    console.log(`Price updated for "${c}"`);
                } else if (existingPriceNumeric < priceNumeric){
                    console.log(`Price for "${c}" has increased from ${existingPrice} to ${price}`);
                    // Update the price in the collection
                    await priceDataCollection.updateOne(
                        { title },
                        { $set: { price } }
                    );
                    console.log(`Price updated for "${c}"`);
                }
            } else {
                console.log(`Title "${c}" does not exist in price_data collection, inserting...`);
                await priceDataCollection.insertOne({ title, price, link });

            }

            // Close the page after scraping
            await page.close();
        }

        // Close the browser after scraping all links
        await browser.close();

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}
async function a(){
    await retrieveDataAndScrape()
    const currentTime = getCurrentTime();
    const messa_ge = `End time: ${currentTime}`;
    await sendMessageToChannel(messa_ge);
}
a()

// Call the main function
// retrieveDataAndScrape()
//     .then(() => {
//         // After completing all operations, delete the screenshots folder
//         deleteScreenshotsFolder();
//     });

// Function to delete the screenshots folder
// function deleteScreenshotsFolder() {
//     const folderPath = path.join(__dirname, 'screenshots');
//     if (fs.existsSync(folderPath)) {
//         fs.rmdirSync(folderPath, { recursive: true });
//     }
    
// }


