import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

// .env-Datei laden (falls vorhanden)
dotenv.config({ path: path.resolve(__dirname, '.env') });

const BASE_URL =
    process.env.RECHNER_URL || 'https://ebikeversicherungen.net/vergleichsrechner/';

/**
 * Proxy-Konfiguration aus Umgebungsvariablen.
 * In CI-Umgebungen oder Containern wird ggf. ein Proxy benötigt.
 */
function getProxyConfig() {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (!proxyUrl) return undefined;
    try {
        const url = new URL(proxyUrl);
        return {
            server: `${url.protocol}//${url.hostname}:${url.port}`,
            username: url.username || undefined,
            password: url.password || undefined,
        };
    } catch {
        return undefined;
    }
}

const proxy = getProxyConfig();

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 2 : undefined,
    timeout: 60_000,
    expect: {
        timeout: 15_000,
        toHaveScreenshot: {
            maxDiffPixelRatio: 0.002,
        },
    },

    reporter: [
        ['html', { outputFolder: 'reports/html', open: 'never' }],
        ['json', { outputFile: 'reports/results.json' }],
        ['list'],
    ],

    use: {
        baseURL: BASE_URL,
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'retain-on-failure',
        actionTimeout: 15_000,
        navigationTimeout: 60_000,
        ignoreHTTPSErrors: true,
        // Proxy muss auf Browser-Ebene gesetzt werden (nicht Context-Ebene),
        // damit Chromium den Proxy-Tunnel korrekt aufbaut.
        // --no-sandbox und --ignore-certificate-errors werden pro Projekt gesetzt,
        // da WebKit diese Chromium-Flags nicht versteht.
        launchOptions: {
            ...(proxy ? { proxy } : {}),
        },
    },

    /* Browser- und Device-Matrix */
    projects: [
        // --- Desktop-Browser ---
        {
            name: 'chromium-desktop',
            use: {
                ...devices['Desktop Chrome'],
                launchOptions: {
                    args: ['--no-sandbox', '--ignore-certificate-errors'],
                    ...(proxy ? { proxy } : {}),
                },
            },
        },
        {
            name: 'firefox-desktop',
            use: {
                ...devices['Desktop Firefox'],
                launchOptions: { ...(proxy ? { proxy } : {}) },
            },
        },
        {
            name: 'webkit-desktop',
            use: {
                ...devices['Desktop Safari'],
                launchOptions: { ...(proxy ? { proxy } : {}) },
            },
        },

        // --- Mobile Devices ---
        {
            name: 'iPhone 14',
            use: {
                ...devices['iPhone 14'],
                launchOptions: { ...(proxy ? { proxy } : {}) },
            },
        },
        {
            name: 'iPhone SE',
            use: {
                ...devices['iPhone SE'],
                launchOptions: { ...(proxy ? { proxy } : {}) },
            },
        },
        {
            name: 'Pixel 7',
            use: {
                ...devices['Pixel 7'],
                launchOptions: {
                    args: ['--no-sandbox', '--ignore-certificate-errors'],
                    ...(proxy ? { proxy } : {}),
                },
            },
        },
        {
            name: 'Galaxy S21',
            use: {
                userAgent:
                    'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                viewport: { width: 360, height: 800 },
                deviceScaleFactor: 3,
                isMobile: true,
                hasTouch: true,
                defaultBrowserType: 'chromium',
                launchOptions: {
                    args: ['--no-sandbox', '--ignore-certificate-errors'],
                    ...(proxy ? { proxy } : {}),
                },
            },
        },

        // --- Tablet ---
        {
            name: 'iPad Pro 11',
            use: {
                ...devices['iPad Pro 11'],
                launchOptions: { ...(proxy ? { proxy } : {}) },
            },
        },
    ],
});
