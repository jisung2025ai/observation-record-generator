import { chromium } from 'playwright';

async function main() {
    const userDataDir = 'C:\\Users\\onandon\\AppData\\Local\\notebooklm-mcp';
    console.log("Launching Chrome. Please log in to your Google Account and go to NotebookLM.");

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        channel: 'chrome',
        args: ['--disable-blink-features=AutomationControlled']
    });

    const page = await context.newPage();
    await page.goto('https://notebooklm.google.com/');

    console.log("Waiting for manual login. Close the browser window when you are fully logged in and can see your notebooks.");

    context.on('close', () => {
        console.log("Browser closed. Authentication setup complete!");
        process.exit(0);
    });
}

main().catch(console.error);
