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
  if (body.action === 'migrar_f_asig') {
    var n = migrarFAsig();
    return ContentService.createTextOutput('Migrados: ' + n);
  }
  return ContentService.createTextOutput('Accion no valida');
}

function limpiarFecha(v) {
  var s = String(v || '').trim();
  if (!s || s === 'SI' || s === 'NO' || s === '-') return '';
  var t = s.split('T')[0].trim();
  var idx = t.indexOf(',');
  if (idx >= 0) t = t.substring(0, idx).trim();
  var m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    var d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return String(mo).padStart(2, '0') + '/' + String(d).padStart(2, '0') + '/' + String(y).slice(-2);
    }
  }
  var iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return iso[2] + '/' + iso[3] + '/' + iso[1].slice(-2);
  }
  return '';
}

function migrarFAsig() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = findDataSheet(ss);
  var headers = getHeaders(sheet);
  var cMouse = colIndex(headers, 'f_asig_mouse');
  var cTecl = colIndex(headers, 'f_asig_teclado');
  var cMon = colIndex(headers, 'f_asig_monitor');
  var cLu = colIndex(headers, 'last_update');
  if (cMouse < 0 || cTecl < 0 || cMon < 0 || cLu < 0) return 0;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var updated = 0;
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var lu = limpiarFecha(row[cLu]);
    if (!lu) continue;
    var changed = false;
    var cols = [cMouse, cTecl, cMon];
    for (var k = 0; k < cols.length; k++) {
      var cur = String(row[cols[k]] || '').trim();
      if (cur === '') {
        row[cols[k]] = lu;
        changed = true;
      }
    }
    if (changed) {
      for (var k2 = 0; k2 < cols.length; k2++) {
        if (String(row[cols[k2]] || '').trim() !== '') {
          sheet.getRange(i + 2, cols[k2] + 1).setValue(row[cols[k2]]);
        }
      }
      updated++;
    }
  }
  return updated;
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
  var campos = ['f_asig_mouse', 'f_asig_teclado', 'f_asig_monitor'];
  var lu = limpiarFecha(eq.last_update);
  for (var k = 0; k < campos.length; k++) {
    var cIdx = colIndex(headers, campos[k]);
    if (cIdx < 0) continue;
    var cur = sheet.getRange(targetRow, cIdx + 1).getValue();
    if ((String(cur || '').trim() === '') && lu !== '') {
      sheet.getRange(targetRow, cIdx + 1).setValue(lu);
    }
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
