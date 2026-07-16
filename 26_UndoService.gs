/**
 * Inventory PRO Enterprise v2.1
 * Cofanie ostatniego importu.
 */

function undoLastImport() {
  const ui = SpreadsheetApp.getUi();
  const importId = getLastActiveImportId_();

  if (!importId) {
    ui.alert('Nie znaleziono importu do cofniecia.');
    return;
  }

  const response = ui.alert(
    'Cofnij ostatni import',
    'Czy na pewno cofnac import:\n' + importId + '?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const result = undoImportById_(importId);

  ui.alert(
    'Cofanie importu',
    'Przywrocono pozycji: ' + result.restoredCount +
      '\nPrzywrocono komorek: ' + result.restoredCellCount +
      '\nPominieto: ' + result.skippedCount,
    ui.ButtonSet.OK
  );
}

function undoImportById_(importId) {
  const lock = LockService.getDocumentLock();

  try {
    lock.waitLock(30000);

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const inventorySheet = getSheetByConfiguredName_(CONFIG.SHEETS.INVENTORY);
    const historySheet = getOrCreateTechnicalHistorySheet_();

    if (!inventorySheet) {
      throw new Error('Nie znaleziono arkusza Inwentura.');
    }

    const lastRow = historySheet.getLastRow();
    if (lastRow < 2) {
      return { importId, restoredCount: 0, skippedCount: 0 };
    }
    const values = historySheet.getRange(2, 1, lastRow - 1, 16).getValues();

    const undoneAt = new Date();
    const undoneBy = getCurrentUserEmail_();
    const plan = buildUndoPlan_(values, importId);
    const inventorySnapshots = plan.changes.map(change => {
      const range = inventorySheet.getRange(change.column + change.row);
      return { range: range, value: range.getValue() };
    });
    const auditRows = plan.auditRows.concat(plan.invalidAuditRows);
    const auditSnapshots = auditRows.map(historyRow => ({
      historyRow: historyRow,
      values: historySheet.getRange(historyRow, 13, 1, 3).getValues()
    }));

    try {
      plan.changes.forEach(change => {
        inventorySheet.getRange(change.column + change.row).setValue(change.previousValue);
      });
      SpreadsheetApp.flush();

      plan.auditRows.forEach(historyRow => {
        historySheet.getRange(historyRow, 13, 1, 3)
          .setValues([['UNDONE', undoneAt, undoneBy]]);
      });
      plan.invalidAuditRows.forEach(historyRow => {
        historySheet.getRange(historyRow, 13, 1, 3)
          .setValues([['UNDO_SKIPPED', undoneAt, undoneBy]]);
      });
      SpreadsheetApp.flush();
    } catch (error) {
      inventorySnapshots.forEach(snapshot => snapshot.range.setValue(snapshot.value));
      auditSnapshots.forEach(snapshot => {
        historySheet.getRange(snapshot.historyRow, 13, 1, 3).setValues(snapshot.values);
      });
      SpreadsheetApp.flush();
      throw error;
    }

    const restoredCount = plan.auditRows.length;
    const restoredCellCount = plan.changes.length;
    const skippedCount = plan.invalidAuditRows.length;

    logInfo(
      'UndoService',
      'undoImportById_',
      'Cofnieto import',
      { importId, restoredCount, restoredCellCount, skippedCount }
    );

    return { importId, restoredCount, restoredCellCount, skippedCount };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Buduje plan cofnięcia niezależny od arkusza. Jeżeli kilka pozycji jednego
 * importu zapisało się do tej samej komórki, przywracamy stan sprzed
 * pierwszego zapisu i oznaczamy wszystkie odpowiadające wiersze audytu.
 */
function buildUndoPlan_(historyValues, importId) {
  const groups = {};
  const auditRows = [];
  const invalidAuditRows = [];

  (historyValues || []).forEach((row, index) => {
    const rowImportId = String(row[0] || '').trim();
    const status = String(row[12] || '').trim();
    const alreadyUndone = row[13];
    if (rowImportId !== importId || status !== 'SAVED' || alreadyUndone) return;

    const historyRow = index + 2;
    const targetRow = Number(row[8]);
    const targetColumn = String(row[9] || '').trim().toUpperCase();
    if (!Number.isInteger(targetRow) || targetRow < 1 || !/^[A-Z]{1,3}$/.test(targetColumn)) {
      invalidAuditRows.push(historyRow);
      return;
    }

    const key = targetColumn + targetRow;
    if (!groups[key]) {
      groups[key] = {
        row: targetRow,
        column: targetColumn,
        previousValue: row[10],
        auditRows: []
      };
    }
    groups[key].auditRows.push(historyRow);
    auditRows.push(historyRow);
  });

  return {
    changes: Object.keys(groups).map(key => groups[key]),
    auditRows: auditRows,
    invalidAuditRows: invalidAuditRows
  };
}