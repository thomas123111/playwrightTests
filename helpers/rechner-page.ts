import { type Page, type FrameLocator } from '@playwright/test';
import type { DeviceMode } from '../fixtures/test-data';

/**
 * Gesammelte Informationen über einen fehlgeschlagenen Netzwerk-Request
 */
export interface NetworkFailure {
    url: string;
    method: string;
    errorText: string;
    timestamp: string;
}

/**
 * Page Object Model für den E-Bike-Versicherungsrechner (enscompare).
 *
 * Der Rechner ist eine React/Mantine-SPA, die als WordPress-Plugin
 * (enscompare) ausgeliefert wird. Die App rendert im Shadow DOM
 * unter der Klasse "ensShadowMain" und hat ein Portal-Root "ensPortalRoot".
 *
 * Navigationsschritte (Redux state):
 *   devicemode_selected → bikeInput → ensuranceList → (checkout/summary/payment)
 *
 * Bike-Daten werden im Redux-Store unter userData.bikes[bikeId] gespeichert.
 * Globale Felder (plz, birthday) liegen unter userData direkt.
 *
 * HINWEIS: Einige Selektoren können sich ändern, da die App CSS-Module
 * und Mantine-Klassen verwendet. Bei Änderungen die betroffenen
 * Selektoren in dieser Datei anpassen.
 */
export class RechnerPage {
    readonly page: Page;

    /** Gesammelte console.error-Einträge während der Session */
    consoleErrors: string[] = [];

    /** Gesammelte fehlgeschlagene Netzwerk-Requests */
    networkFailures: NetworkFailure[] = [];

    // ======================================================================
    // Selektoren
    // Die App ist eine React-SPA. Formularfelder werden über Mantine-
    // Komponenten gerendert. Selektoren basieren auf der JS-Bundle-Analyse.
    // ======================================================================

    /** Hauptcontainer — die App rendert ggf. im Shadow DOM */
    // Die SPA mountet mit classList.add("ensShadowMain") und "ensPortalRoot"
    private readonly containerSelector = '.ensShadowMain, .ensPortalRoot, #ens_compare_table_input_fields';

    /**
     * Gerätetyp-Auswahl (Pedelec, E-Bike, Fahrrad, S-Pedelec).
     * Wird als Mantine Select oder als Button-Gruppe gerendert.
     * Die Option "devicekey":"select" in ensOptions zeigt eine Select-Komponente.
     */
    // TODO: Anpassen — der genaue Selektor hängt vom Rendering ab
    // Mögliche Varianten: Mantine Select (.mantine-Select-input), Radio-Buttons, oder Karten
    private readonly deviceModeSelector = '.nav_top_select, [class*="nav_top_select"], input[class*="mantine-Select-input"]';

    /**
     * Kaufpreis-Feld.
     * Redux-Key: userData.bikes[bikeId].price
     * Label: "Kaufpreis"
     */
    // TODO: Anpassen — Mantine NumberInput oder TextInput mit label "Kaufpreis"
    private readonly purchasePriceSelector = 'input[aria-label*="Kaufpreis" i], input[placeholder*="Kaufpreis" i], label:has-text("Kaufpreis") + input, label:has-text("Kaufpreis") ~ input';

    /**
     * Geburtsdatum-Feld.
     * Redux-Key: userData.birthday (via field:"birthday", isBday:true)
     * Label: "Geburtsdatum"
     */
    // TODO: Anpassen — Mantine DateInput oder DatePicker
    private readonly birthDateSelector = 'input[aria-label*="Geburtsdatum" i], input[placeholder*="Geburtsdatum" i], label:has-text("Geburtsdatum") + input, label:has-text("Geburtsdatum") ~ input';

    /**
     * Kaufdatum-Feld.
     * Redux-Key: userData.bikes[bikeId].buyDate
     * In der App-Logik wird das Kaufdatum teils automatisch auf heute gesetzt.
     */
    // TODO: Anpassen — Kaufdatum-Feld, ggf. als DatePicker
    private readonly purchaseDateSelector = 'input[aria-label*="Kaufdatum" i], input[placeholder*="Kaufdatum" i], label:has-text("Kaufdatum") + input, label:has-text("Kaufdatum") ~ input';

    /**
     * PLZ-Feld.
     * Redux-Key: userData.plz
     * Label: "Postleitzahl"
     * Validierung: digits_between:5,5 (DE) oder digits_between:4,4 (AT)
     */
    private readonly postalCodeSelector = 'input[aria-label*="Postleitzahl" i], input[placeholder*="Postleitzahl" i], label:has-text("Postleitzahl") + input, label:has-text("Postleitzahl") ~ input';

    /**
     * Hersteller-Feld (optional).
     * Redux-Key: userData.bikes[bikeId].bikeMarke
     * Label: "Hersteller"
     */
    private readonly manufacturerSelector = 'input[aria-label*="Hersteller" i], label:has-text("Hersteller") + input, label:has-text("Hersteller") ~ input';

    /**
     * Modell-Feld (optional).
     * Redux-Key: userData.bikes[bikeId].bikeTypeName
     * Label: "Modellbezeichnung"
     */
    private readonly modelSelector = 'input[aria-label*="Modell" i], label:has-text("Modellbezeichnung") + input, label:has-text("Modellbezeichnung") ~ input';

    /**
     * "Jetzt vergleichen" / "Angebot anfordern" Button.
     * CSS-Klasse: vergleicherButton (CSS-Module-Hash)
     */
    // TODO: Anpassen — der Button-Text variiert je nach Kontext
    private readonly compareButtonSelector = 'button:has-text("Jetzt vergleichen"), button:has-text("Angebot anfordern"), button[class*="vergleicherButton"]';

    /**
     * Ergebnis-Container — die Vergleichstabelle mit Tarifen.
     * ID: ens_compare_table_input_fields (im JS sichtbar)
     * CSS-Klasse: compareTable / compareTableTop
     */
    private readonly resultsContainerSelector = '#ens_compare_table_input_fields, [class*="compareTable"], .ensuranceList';

    /**
     * Einzelner Tarif in der Ergebnisliste.
     * Jeder Tarif wird als Karte/Zeile mit ensName und priceContainer dargestellt.
     */
    // TODO: Anpassen — Selektor für einzelne Tarif-Einträge
    private readonly resultItemSelector = '[class*="ensName"], [class*="addEnsItem"], [class*="headerBox"]';

    /**
     * Preis-Anzeige in der Ergebnisliste
     */
    private readonly priceSelector = '[class*="priceContainer"], [class*="priceText"]';

    /**
     * Fehlermeldungen
     * Die App verwendet Mantine Alert-Komponenten und ensurance_error_field
     */
    private readonly errorMessageSelector = '[class*="Alert-message"], [class*="ensurance_error_field"], [class*="error"], .mantine-Alert-root';

    /**
     * Sortierungs-Dropdown in der Ergebnisliste.
     * Optionen: price, priceValueRatio, popularity, valuation
     */
    private readonly sortingSelector = '[aria-label*="Sortierung" i], label:has-text("Sortierung") ~ select';

    /** Zeitstempel für Performance-Messungen */
    private apiCallStartTime = 0;
    private apiCallEndTime = 0;

    constructor(page: Page) {
        this.page = page;
        this.setupListeners();
    }

    /**
     * Registriert Event-Listener für Konsolen-Fehler und Netzwerk-Failures.
     * Wird im Konstruktor automatisch aufgerufen.
     */
    private setupListeners(): void {
        // Konsolen-Fehler sammeln
        this.page.on('console', (msg) => {
            if (msg.type() === 'error') {
                this.consoleErrors.push(
                    `[${new Date().toISOString()}] ${msg.text()}`
                );
            }
        });

        // Fehlgeschlagene Netzwerk-Requests loggen
        this.page.on('requestfailed', (request) => {
            this.networkFailures.push({
                url: request.url(),
                method: request.method(),
                errorText: request.failure()?.errorText ?? 'Unbekannter Fehler',
                timestamp: new Date().toISOString(),
            });
        });
    }

    // ========== Navigation ==========

    /** Rechner direkt aufrufen */
    async goto(): Promise<void> {
        await this.page.goto('/', { waitUntil: 'domcontentloaded' });
        // Warten bis die React-App gerendert hat
        await this.page.waitForSelector(this.containerSelector, {
            state: 'visible',
            timeout: 20_000,
        });
    }

    /** Rechner im iFrame-Kontext auf einer Host-Seite öffnen */
    async gotoEmbedded(hostUrl: string): Promise<void> {
        await this.page.goto(hostUrl, { waitUntil: 'domcontentloaded' });
        const iframeLocator = this.page.frameLocator(
            'iframe[src*="rechner"], iframe[src*="vergleichsrechner"], iframe#rechner-iframe'
        );
        await iframeLocator
            .locator(this.containerSelector)
            .waitFor({ state: 'visible', timeout: 20_000 });
    }

    // ========== Eingaben ==========

    /**
     * Gerätetyp auswählen (Pedelec, E-Bike, Fahrrad, S-Pedelec).
     * Die ensOptions-Konfiguration zeigt devicekey:"select", d.h. es wird
     * wahrscheinlich ein Mantine Select gerendert.
     */
    async selectDeviceMode(mode: DeviceMode): Promise<void> {
        const labels: Record<DeviceMode, string> = {
            pedelec: 'Pedelec',
            ebike: 'E-Bike',
            bike: 'Fahrrad',
            spedelec: 'S-Pedelec',
        };

        // Variante 1: Mantine Select — klicken und Option wählen
        const selectInput = this.page.locator(this.deviceModeSelector).first();
        if (await selectInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await selectInput.click();
            await this.page.locator(`[role="option"]:has-text("${labels[mode]}")`).click();
            return;
        }

        // Variante 2: Button/Karte mit dem Gerätetyp-Label klicken
        // TODO: Anpassen — falls der Rechner Karten statt Select nutzt
        const button = this.page.locator(
            `button:has-text("${labels[mode]}"), [role="button"]:has-text("${labels[mode]}"), a:has-text("${labels[mode]}")`
        ).first();
        if (await button.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await button.click();
            return;
        }

        // Variante 3: Radio-Button oder anderes Element
        await this.page.getByText(labels[mode], { exact: false }).first().click();
    }

    /** Kaufpreis eingeben (in Euro, ohne Nachkommastellen) */
    async enterPurchasePrice(price: number): Promise<void> {
        // TODO: Anpassen — Mantine NumberInput hat ggf. eigenes Verhalten
        const input = this.page.locator(this.purchasePriceSelector).first();
        await input.click();
        await input.fill(String(price));
    }

    /** Geburtsdatum eingeben (Format: TT.MM.JJJJ) */
    async enterBirthDate(date: string): Promise<void> {
        // TODO: Anpassen — Mantine DateInput erwartet ggf. Klick + Kalender-Auswahl
        const input = this.page.locator(this.birthDateSelector).first();
        await input.click();
        await input.fill(date);
        // Tab drücken um das Feld zu verlassen (löst Validierung aus)
        await input.press('Tab');
    }

    /** Kaufdatum eingeben (Format: TT.MM.JJJJ) */
    async enterPurchaseDate(date: string): Promise<void> {
        // TODO: Anpassen — Mantine DateInput
        const input = this.page.locator(this.purchaseDateSelector).first();
        await input.click();
        await input.fill(date);
        await input.press('Tab');
    }

    /** Postleitzahl eingeben */
    async enterPostalCode(plz: string): Promise<void> {
        const input = this.page.locator(this.postalCodeSelector).first();
        await input.click();
        await input.fill(plz);
    }

    /** Hersteller eingeben (optional) */
    async enterManufacturer(name: string): Promise<void> {
        const input = this.page.locator(this.manufacturerSelector).first();
        if (await input.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await input.click();
            await input.fill(name);
        }
    }

    /** Modellbezeichnung eingeben (optional) */
    async enterModel(name: string): Promise<void> {
        const input = this.page.locator(this.modelSelector).first();
        if (await input.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await input.click();
            await input.fill(name);
        }
    }

    // ========== Aktionen ==========

    /** "Jetzt vergleichen" Button klicken und Performance-Messung starten */
    async clickCompare(): Promise<void> {
        this.apiCallStartTime = Date.now();
        await this.page.locator(this.compareButtonSelector).first().click();
    }

    /** Warten bis die Ergebnisliste / Vergleichstabelle geladen ist */
    async waitForResults(): Promise<void> {
        await this.page.locator(this.resultsContainerSelector).first().waitFor({
            state: 'visible',
            timeout: 30_000,
        });
        this.apiCallEndTime = Date.now();
    }

    /** Einen bestimmten Tarif aus der Ergebnisliste auswählen */
    async selectTariff(index: number): Promise<void> {
        const items = this.page.locator(this.resultItemSelector);
        await items.nth(index).click();
    }

    // ========== Assertions / Diagnostics ==========

    /** Anzahl der angezeigten Ergebnisse ermitteln */
    async getResultCount(): Promise<number> {
        return this.page.locator(this.resultItemSelector).count();
    }

    /** Prüfen ob sichtbare Fehlermeldungen vorhanden sind */
    async hasErrors(): Promise<boolean> {
        return this.page
            .locator(this.errorMessageSelector)
            .first()
            .isVisible({ timeout: 2_000 })
            .catch(() => false);
    }

    /** Alle sichtbaren Fehlermeldungen auslesen */
    async getVisibleErrorMessages(): Promise<string[]> {
        const errorElements = this.page.locator(this.errorMessageSelector);
        const count = await errorElements.count();
        const messages: string[] = [];
        for (let i = 0; i < count; i++) {
            const text = await errorElements.nth(i).textContent();
            if (text) messages.push(text.trim());
        }
        return messages;
    }

    /** Aktuellen Zustand des Rechners für Debugging erfassen (aus dem Redux-Store) */
    async captureState(): Promise<object> {
        return this.page.evaluate(() => {
            const win = window as unknown as Record<string, unknown>;
            return {
                url: window.location.href,
                title: document.title,
                // enscompare exponiert ggf. State über window-Objekte
                ensOptions: win.ensOptions ?? null,
                ensFieldsPreload: win.ensFieldsPreload ? 'vorhanden' : null,
                // Versuche den Redux-Store zu lesen (falls exponiert)
                reduxState: typeof (win as Record<string, unknown>).__REDUX_DEVTOOLS_EXTENSION__
                    === 'function' ? 'DevTools verfügbar' : null,
                visibleText: document.body?.innerText?.substring(0, 500) ?? '',
            };
        });
    }

    /** Dauer des letzten API-Calls in Millisekunden */
    async getApiCallDuration(): Promise<number> {
        if (this.apiCallStartTime === 0) return -1;
        return this.apiCallEndTime - this.apiCallStartTime;
    }

    /** Prüft ob Preise in den Ergebnissen angezeigt werden */
    async resultsContainPrices(): Promise<boolean> {
        const priceElements = this.page.locator(this.priceSelector);
        const count = await priceElements.count();
        return count > 0;
    }

    /**
     * Gesammelten Fehler-State zurücksetzen.
     * Nützlich wenn ein Test mehrere Szenarien nacheinander durchläuft.
     */
    resetErrorCollectors(): void {
        this.consoleErrors = [];
        this.networkFailures = [];
        this.apiCallStartTime = 0;
        this.apiCallEndTime = 0;
    }

    /**
     * Kompletten Rechner-Flow für den E-Bike-Versicherungsvergleich durchlaufen.
     *
     * Schritte:
     *   1. Gerätetyp wählen
     *   2. Kaufpreis eingeben
     *   3. Geburtsdatum eingeben
     *   4. Kaufdatum eingeben
     *   5. PLZ eingeben
     *   6. "Jetzt vergleichen" klicken
     *   7. Auf Ergebnisse warten
     */
    async completeFlow(input: {
        deviceMode: DeviceMode;
        purchasePrice: number;
        birthDate: string;
        purchaseDate: string;
        plz: string;
    }): Promise<void> {
        await this.selectDeviceMode(input.deviceMode);
        await this.enterPurchasePrice(input.purchasePrice);
        await this.enterBirthDate(input.birthDate);
        await this.enterPurchaseDate(input.purchaseDate);
        await this.enterPostalCode(input.plz);
        await this.clickCompare();
        await this.waitForResults();
    }
}
