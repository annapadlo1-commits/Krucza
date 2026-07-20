/** Regresja: eksport XLSX nie może wymagać włączonego Drive API v3. */
function testXlsxExportWithoutDriveApi4312_() {
  const id = 'test-sheet-id';
  const url = buildSpreadsheetXlsxExportUrl_(id);
  assertCondition_(
    url === 'https://docs.google.com/spreadsheets/d/test-sheet-id/export?format=xlsx',
    'Nieprawidłowy adres natywnego eksportu XLSX: ' + url
  );
  assertCondition_(
    url.indexOf('googleapis.com/drive/v3') === -1,
    'Eksport XLSX nie może korzystać z Drive API v3.'
  );
  return { passed: true, url: url };
}