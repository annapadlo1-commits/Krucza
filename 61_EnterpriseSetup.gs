/**
 * Inventory PRO Enterprise v2.1
 * Konfiguracja arkuszy Enterprise.
 */
function enterpriseSetup() {
  const startedAt = Date.now();

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    invalidateProductCatalogCache_();

    getOrCreateBusinessHistorySheet_();
    ensureTechnicalLogHeaders_(getOrCreateTechnicalLogSheet_());
    getOrCreateTechnicalHistorySheet_();
    ensureQualitySettingsSheet_();
    getOrCreateNewProductsSheet_();
    ensureActiveInventorySession_();
    repairDictionaryCategoriesFromInventory();
    applyInventoryTheme();
    applySavedWorkspaceMode();

    logInfo(
      'EnterpriseSetup',
      'enterpriseSetup',
      'Inventory PRO ' + CONFIG.VERSION + ' zostal zainicjalizowany',
      {
        spreadsheetName: spreadsheet.getName(),
        spreadsheetId: spreadsheet.getId()
      },
      Date.now() - startedAt
    );

    spreadsheet.toast(
      'Enterprise v' + CONFIG.VERSION + ' gotowy.',
      'Inventory PRO',
      8
    );

    return {
      success: true,
      version: CONFIG.VERSION,
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    try {
      logError(
        'EnterpriseSetup',
        'enterpriseSetup',
        error,
        null,
        Date.now() - startedAt
      );
    } catch (loggingError) {
      console.error(loggingError);
    }

    throw error;
  }
}