var SPREADSHEET_ID = '1Br_3NufEfedWM21c2pWyfQv14sEWM_F2mdFUm9gQubk';

function doGet(e) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = findDataSheet(ss);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      var h = String(headers[j]).trim();
      if (h !== '') row[h] = data[i][j];
    }
    result.push(row);
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  if (body.action === 'save') {
    guardarRegistro(body.eq);
    return ContentService.createTextOutput('Ok');
  }
  if (body.action === 'delete') {
    eliminarRegistro(body.id);
    return ContentService.createTextOutput('Eliminado');
  }
  return ContentService.createTextOutput('Accion no valida');
}

function findDataSheet(ss) {
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var h = sheets[s].getRange(1, 1, 1, 50).getValues()[0];
    var hasId = false, hasUsr = false;
    for (var j = 0; j < h.length; j++) {
      var v = String(h[j]).trim().toLowerCase();
      if (v === 'id') hasId = true;
      if (v === 'usuario') hasUsr = true;
    }
    if (hasId && hasUsr) return sheets[s];
  }
  return sheets[0];
}

function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function colIndex(headers, name) {
  for (var j = 0; j < headers.length; j++) {
    if (String(headers[j]).trim().toLowerCase() === name.toLowerCase()) return j;
  }
  return -1;
}

function ensureColumn(sheet, headers, name) {
  var idx = colIndex(headers, name);
  if (idx >= 0) return idx;
  var newCol = headers.length + 1;
  sheet.getRange(1, newCol).setValue(name);
  headers.push(name);
  return headers.length - 1;
}

function guardarRegistro(eq) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = findDataSheet(ss);
  var headers = getHeaders(sheet);
  var idCol = ensureColumn(sheet, headers, 'id');
  var regCol = ensureColumn(sheet, headers, 'registrado_por');
  var id = eq.id || '';
  var targetRow = -1;
  if (id !== '') {
    var idVals = sheet.getRange(2, idCol + 1, sheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < idVals.length; i++) {
      if (String(idVals[i][0]) === id) { targetRow = i + 2; break; }
    }
  }
  if (targetRow === -1) {
    targetRow = sheet.getLastRow() + 1;
  }
  for (var j = 0; j < headers.length; j++) {
    var name = String(headers[j]).trim();
    if (name === '') continue;
    var val = eq[name];
    if (val === undefined) continue;
    sheet.getRange(targetRow, j + 1).setValue(val);
  }
  if (eq.registrado_por !== undefined) {
    sheet.getRange(targetRow, regCol + 1).setValue(eq.registrado_por);
  }
}

function eliminarRegistro(id) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = findDataSheet(ss);
  var headers = getHeaders(sheet);
  var idCol = colIndex(headers, 'id');
  if (idCol < 0) return;
  var idVals = sheet.getRange(2, idCol + 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < idVals.length; i++) {
    if (String(idVals[i][0]) === String(id)) {
      sheet.deleteRow(i + 2);
      return;
    }
  }
}
