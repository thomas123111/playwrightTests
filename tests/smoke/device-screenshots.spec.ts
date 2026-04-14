import { test } from '@playwright/test';
import { RechnerPage } from '../../helpers/rechner-page';
import { TEST_DATA } from '../../fixtures/test-data';
import * as fs from 'fs';
import * as path from 'path';

const screenshotDir = path.resolve(__dirname, '..', '..', 'reports', 'device-screenshots');

test.describe('Device-Screenshots für visuelle Prüfung', () => {
    let rechnerPage: RechnerPage;

    test.beforeAll(() => {
        fs.mkdirSync(screenshotDir, { recursive: true });
    });

    test.beforeEach(async ({ page }) => {
        rechnerPage = new RechnerPage(page);
    });

    test('Screenshots: Startseite + Formular + Ergebnisse', async ({ page }, testInfo) => {
        const device = testInfo.project.name;

        // Startseite
        await rechnerPage.goto();
        await page.screenshot({
            path: path.join(screenshotDir, `01-startseite-${device}.png`),
            fullPage: true,
        });

        // Formular (E-Bike)
        await rechnerPage.selectCategory('ebike');
        await page.waitForTimeout(1000);
        await page.screenshot({
            path: path.join(screenshotDir, `02-formular-${device}.png`),
            fullPage: true,
        });

        // Formular ausfüllen
        const input = TEST_DATA.validInputs[0];
        await rechnerPage.enterPurchasePrice(input.purchasePrice);
        await rechnerPage.enterPostalCode(input.plz);
        await rechnerPage.enterPurchaseDate(input.purchaseDay, input.purchaseMonth, input.purchaseYear);
        await rechnerPage.enterBirthDate(input.birthDay, input.birthMonth, input.birthYear);
        await page.screenshot({
            path: path.join(screenshotDir, `03-ausgefuellt-${device}.png`),
            fullPage: true,
        });

        // Ergebnisse
        await rechnerPage.clickViewOffers();
        await rechnerPage.waitForResults();
        await page.waitForTimeout(2000);
        await page.screenshot({
            path: path.join(screenshotDir, `04-ergebnisse-${device}.png`),
            fullPage: true,
        });
    });
});
