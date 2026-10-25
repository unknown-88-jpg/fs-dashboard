/**
 * Endpoint data untuk Dashboard Keuangan.
 * Tempel di spreadsheet: Extensions > Apps Script, lalu Deploy > New deployment > Web app.
 *
 * GANTI nilai TOKEN di bawah dengan teks acak panjang (sama dengan SHEETS_TOKEN di Vercel).
 */
var TOKEN = 'GANTI-DENGAN-TOKEN-ACAK-PANJANG';

// Tab yang diekspos: [nama tab, jumlah baris maks, jumlah kolom maks]
var TABS = [
  ['PL', 90, 8],
  ['BS', 90, 8],
  ['CF', 90, 8],
  ['AR', 220, 14],
  ['AP', 220, 14],
];

function doGet(e) {
  if (!e || !e.parameter || e.parameter.token !== TOKEN || TOKEN.indexOf('GANTI') === 0) {
    return json_({ error: 'unauthorized' });
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var out = {};
  TABS.forEach(function (t) {
    var sh = ss.getSheetByName(t[0]);
    if (!sh) { out[t[0]] = []; return; }
    var rows = Math.min(sh.getLastRow(), t[1]);
    var cols = Math.min(sh.getLastColumn(), t[2]);
    out[t[0]] = rows > 0 && cols > 0 ? sh.getRange(1, 1, rows, cols).getValues() : [];
  });
  return json_(out);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
