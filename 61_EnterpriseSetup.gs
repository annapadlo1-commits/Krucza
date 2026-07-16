/**
 * Inventory PRO 4.3.1
 * Konfiguracja arkuszy Enterprise z kontrolą kontraktu formuł.
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

    const formulaAuditBefore = auditInventoryFormulaCoverage_();
    const formulaRepair = formulaAuditBefore.safe
      ? { changedCells: 0, backupSheetName: '', audit: formulaAuditBefore }
      : repairInventoryFormulas_({
          createBackup: true,
          source: 'enterpriseSetup'
        });

    repairDictionaryCategoriesFromInventory();
    applyInventoryTheme();
    applySavedWorkspaceMode();

    logInfo(
      'EnterpriseSetup',
      'enterpriseSetup',
      'Inventory PRO ' + CONFIG.VERSION + ' zostal zainicjalizowany',
      {
        spreadsheetName: spreadsheet.getName(),
        spreadsheetId: spreadsheet.getId(),
        repairedFormulaCells: formulaRepair.changedCells,
        formulaBackupSheet: formulaRepair.backupSheetName,
        formulasSafe: formulaRepair.audit && formulaRepair.audit.safe
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
      repairedFormulaCells: formulaRepair.changedCells,
      formulaBackupSheet: formulaRepair.backupSheetName,
      formulasSafe: formulaRepair.audit && formulaRepair.audit.safe,
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