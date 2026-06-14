const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

app.get('/capture-chart', async (req, res) => { 
    const url = 'http://127.0.0.1:5000/adv4'; // Change to your actual chart page

    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        // Navigate to the page where your TradingView chart is
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Wait for the chart to be fully loaded
        await page.waitForSelector('#chart-container'); // Adjust this selector to your chart container ID

        // Take a screenshot of the chart
        const chartElement = await page.$('#chart-container');
        const screenshotPath = path.join(__dirname, 'chart.png');
        await chartElement.screenshot({ path: screenshotPath });

        // Send the screenshot to the client
        res.sendFile(screenshotPath, err => {
            if (err) {
                console.log('Error sending file:', err);
            }
            // Delete the file after sending it
            fs.unlink(screenshotPath, err => {
                if (err) console.error('Error deleting screenshot:', err);
            });
        });

        await browser.close();
    } catch (error) {
        console.error('Error capturing the chart:', error);
        res.status(500).send('Error capturing the chart');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

