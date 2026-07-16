/**
 * Inventory PRO 4.3.1 — bezpieczna odbudowa formuł Kruczej.
 *
 * Naprawa:
 *  - obejmuje wyłącznie komórki wynikające z fizycznego katalogu produktów,
 *  - przed pierwszą zmianą tworzy ukrytą kopię całej zakładki,
 *  - wykonuje zapis blokami R1C1,
 *  - po zapisie ponownie audytuje kontrakt,
 *  - przy błędzie przywraca poprzednią zawartość zmienianych komórek.
 */

function buildInventoryFormulaRepairPlan_(sheet, products) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const width = 9;
  const range = sheet.getRange(1, 1, lastRow, width);
  const formulas = range.getFormulas();
  const values = range.getValues();
  const displayValues = range.getDisplayValues();
  const plan = [];

  (products || []).forEach(product => {
    getInventoryFormulaContract_(product).forEach(contract => {
      const row = Number(product.inventoryRow);
      const columnNumber = inventoryColumnLetterToNumber_(contract.column);
      const actualFormula = formulas[row - 1] && formulas[row - 1][columnNumber - 1] || '';
      const displayed = displayValues[row - 1] && displayValues[row - 1][columnNumber - 1] || '';
      const isCanonical = normalizeInventoryFormula_(actualFormula) ===
        normalizeInventoryFormula_(contract.formula);
      const hasCalculationError = actualFormula && isSpreadsheetFormulaError_(displayed);

      if (!isCanonical || hasCalculationError) {
        plan.push({
          row: row,
          column: contract.column,
          columnNumber: columnNumber,
          a1: contract.column + row,
          formula: contract.formula,
          r1c1: contract.r1c1,
          previousFormula: actualFormula,
          previousValue: values[row - 1] && values[row - 1][columnNumber - 1],
          product: product.name,
          category: product.category,
          type: product.type
        });
      }
    });
  });

  return plan.sort((left, right) =>
    left.columnNumber - right.columnNumber || left.row - right.row
  );
}

function buildFormulaRepairSegments_(plan) {
  const groups = {};
  (plan || []).forEach(change => {
    const key = change.columnNumber + '|' + change.r1c1;
    if (!groups[key]) groups[key] = [];
    groups[key].push(change);
  });

  const segments = [];
  Object.keys(groups).forEach(key => {
    const changes = groups[key].sort((a, b) => a.row - b.row);
    let start = null;
    let previous = null;
    changes.forEach(change => {
      if (!start || change.row !== previous.row + 1) {
        if (start) {
          segments.push({
            startRow: start.row,
            endRow: previous.row,
            columnNumber: start.columnNumber,
            r1c1: start.r1c1
          });
        }
        start = change;
      }
      previous = change;
    });
    if (start) {
      segments.push({
        startRow: start.row,
        endRow: previous.row,
        columnNumber: start.columnNumber,
        r1c1: start.r1c1
      });
    }
  });

  return segments.sort((left, right) =>
    left.columnNumber - right.columnNumber || left.startRow - right.startRow
  );
}

function createFormulaRepairBackupSheet_(sheet) {
  const spreadsheet = sheet.getParent();
  const timestamp = Utilities.formatDate(
    new Date(),
    spreadsheet.getSpreadsheetTimeZone() || 'Europe/Warsaw',
    'yyyyMMdd-HHmmss'
  );
  const base = 'BACKUP FORMULY ' + timestamp;
  let name = base;
  let suffix = 2;
  while (spreadsheet.getSheetByName(name)) {
    name = base + '-' + suffix;
    suffix++;
  }
  const copy = sheet.copyTo(spreadsheet).setName(name);
  copy.hideSheet();
  return name;
}

function applyInventoryFormulaRepairPlan_(sheet, plan) {
  const segments = buildFormulaRepairSegments_(plan);
  segments.forEach(segment => {
    sheet.getRange(
      segment.startRow,
      segment.columnNumber,
      segment.endRow - segment.startRow + 1,
      1
    ).setFormulaR1C1(segment.r1c1);
  });
  return segments.length;
}

function rollbackInventoryFormulaRepairPlan_(sheet, plan) {
  (plan || []).slice().reverse().forEach(change => {
    const range = sheet.getRange(change.row, change.columnNumber);
    if (change.previousFormula) {
      range.setFormula(change.previousFormula);
    } else if (
      change.previousValue === '' ||
      change.previousValue === null ||
      change.previousValue === undefined
    ) {
      range.clearContent();
    } else {
      range.setValue(change.previousValue);
    }
  });
}

function repairInventoryFormulas_(options) {
  const settings = options || {};
  const lock = LockService.getDocumentLock();
  const startedAt = Date.now();
  let plan = [];
  let sheet = null;
  let backupSheetName = '';

  try {
    lock.waitLock(30000);
    sheet = settings.sheet || getSheetByConfiguredName_(CONFIG.SHEETS.INVENTORY);
    if (!sheet) throw new Error('Nie znaleziono arkusza: ' + CONFIG.SHEETS.INVENTORY);
    const products = settings.products || scanInventoryProducts_();
    plan = buildInventoryFormulaRepairPlan_(sheet, products);

    if (!plan.length) {
      const audit = buildInventoryFormulaAudit_(sheet, products);
      return {
        success: true,
        changedCells: 0,
        segments: 0,
        backupSheetName: '',
        audit: audit,
        durationMs: Date.now() - startedAt
      };
    }

    if (settings.createBackup !== false) {
      backupSheetName = createFormulaRepairBackupSheet_(sheet);
    }

    const segments = applyInventoryFormulaRepairPlan_(sheet, plan);
    SpreadsheetApp.flush();
    const audit = buildInventoryFormulaAudit_(sheet, products);
    if (!audit.safe) {
      throw new Error(
        'Kontrola po naprawie nie przeszła: brakujące=' + audit.missingFormulaCells +
        ', nieprawidłowe=' + audit.invalidFormulaCells +
        ', błędy=' + audit.errorFormulaCells + '.'
      );
    }

    const result = {
      success: true,
      changedCells: plan.length,
      segments: segments,
      backupSheetName: backupSheetName,
      audit: audit,
      durationMs: Date.now() - startedAt,
      source: settings.source || 'manual'
    };

    logInfo(
      'FormulaRepair',
      'repairInventoryFormulas_',
      'Odbudowano formuły inwentury.',
      {
        sheet: sheet.getName(),
        changedCells: result.changedCells,
        segments: result.segments,
        backupSheetName: result.backupSheetName,
        source: result.source
      },
      result.durationMs
    );
    return result;
  } catch (error) {
    if (sheet && plan.length) {
      try {
        rollbackInventoryFormulaRepairPlan_(sheet, plan);
        SpreadsheetApp.flush();
      } catch (rollbackError) {
        logError('FormulaRepair', 'repairInventoryFormulas_.rollback', rollbackError, null, 0);
      }
    }
    logError(
      'FormulaRepair',
      'repairInventoryFormulas_',
      error,
      { changedCellsPlanned: plan.length, backupSheetName: backupSheetName },
      Date.now() - startedAt
    );
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function repairInventoryFormulasWithDialog() {
  return runSafely_(
    'FormulaRepair',
    'repairInventoryFormulasWithDialog',
    function() {
      const auditBefore = auditInventoryFormulaCoverage_();
      if (auditBefore.safe) {
        SpreadsheetApp.getUi().alert(
          'Inventory PRO — formuły',
          'Wszystkie oczekiwane formuły są już obecne i poprawne.',
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        return { success: true, changedCells: 0, audit: auditBefore };
      }

      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        'Przywrócić formuły Kruczej?',
        'Wykryto ' + auditBefore.missingFormulaCells + ' brakujących, ' +
          auditBefore.invalidFormulaCells + ' nieprawidłowych formuł oraz ' +
          auditBefore.errorFormulaCells + ' błędów obliczeń.\n\n' +
          'Przed zmianą zostanie utworzona ukryta kopia całej zakładki.',
        ui.ButtonSet.YES_NO
      );
      if (response !== ui.Button.YES) return { success: false, cancelled: true };

      const result = repairInventoryFormulas_({ createBackup: true, source: 'menu' });
      ui.alert(
        'Inventory PRO — formuły przywrócone',
        'Zmienione komórki: ' + result.changedCells + '\n' +
          'Bloki zapisu: ' + result.segments + '\n' +
          'Kopia bezpieczeństwa: ' + (result.backupSheetName || 'nie była potrzebna') + '\n' +
          'Status końcowy: OK',
        ui.ButtonSet.OK
      );
      return result;
    },
    'Nie udało się przywrócić formuł.'
  );
}
