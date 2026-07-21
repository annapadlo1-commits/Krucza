/**
 * Inventory PRO — bezpieczna transkrypcja nagrań przez Gemini.
 * Klucz jest przechowywany wyłącznie w Script Properties.
 */
const GEMINI_TRANSCRIPTION_PROPERTY_ = 'INVENTORY_PRO_GEMINI_API_KEY';
const GEMINI_TRANSCRIPTION_MODELS_ = Object.freeze([
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite'
]);
const GEMINI_MAX_AUDIO_BYTES_ = 20000000;
const GEMINI_MAX_AUDIO_SECONDS_ = 605;
const GEMINI_AUDIO_JOB_PREFIX_ = 'INVENTORY_AUDIO_JOB_';
const GEMINI_AUDIO_JOB_TTL_MS_ = 24 * 60 * 60 * 1000;
const GEMINI_AUDIO_FOLDER_PROPERTY_ = 'INVENTORY_AUDIO_TEMP_FOLDER_ID';

function isGeminiTranscriptionConfigured_() {
  return Boolean(getGeminiApiKey_());
}

function getGeminiApiKey_() {
  const scriptKey = PropertiesService.getScriptProperties()
    .getProperty(GEMINI_TRANSCRIPTION_PROPERTY_);
  if (scriptKey) return scriptKey;
  try {
    const documentProperties = PropertiesService.getDocumentProperties();
    return documentProperties && documentProperties
      .getProperty(GEMINI_TRANSCRIPTION_PROPERTY_) || '';
  } catch (error) {
    return '';
  }
}

function configureGeminiTranscription() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Inventory PRO — Gemini',
    'Wklej klucz Gemini API. Klucz zostanie zapisany wyłącznie w ustawieniach skryptu i nie będzie widoczny w aplikacji mobilnej.',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const key = String(response.getResponseText() || '').trim();
  if (!isSupportedGeminiKeyFormat_(key)) {
    ui.alert('Klucz jest niepełny albo ma nieobsługiwany format. Skopiuj cały klucz przyciskiem kopiowania w Google AI Studio. Obsługiwane są nowe klucze AQ. oraz starsze AIza.');
    return;
  }
  const check = checkGeminiApiKey_(key);
  if (!check.ok) {
    ui.alert('Google odrzucił klucz. Nie zapisano zmian.\n\n' + check.message);
    return;
  }
  PropertiesService.getScriptProperties()
    .setProperty(GEMINI_TRANSCRIPTION_PROPERTY_, key);
  try {
    const documentProperties = PropertiesService.getDocumentProperties();
    if (documentProperties) documentProperties
      .setProperty(GEMINI_TRANSCRIPTION_PROPERTY_, key);
  } catch (error) {
    console.warn('Nie udało się zapisać zapasowej konfiguracji dokumentu: ' + String(error));
  }
  ui.alert('Transkrypcja Gemini została skonfigurowana. Zaktualizuj wdrożenie aplikacji mobilnej do nowej wersji.');
}

function showGeminiTranscriptionStatus() {
  const key = getGeminiApiKey_();
  const check = key ? checkGeminiApiKey_(key) : { ok: false, message: 'Brak zapisanego klucza.' };
  SpreadsheetApp.getUi().alert(
    'Inventory PRO — Gemini',
    check.ok
      ? 'Klucz API jest skonfigurowany i został zaakceptowany przez Gemini.'
      : 'Transkrypcja nie jest gotowa. ' + check.message,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function isSupportedGeminiKeyFormat_(key) {
  return /^(?:AIza[\w-]{20,}|AQ\.[A-Za-z0-9_-]{20,})$/.test(String(key || '').trim());
}

function checkGeminiApiKey_(key) {
  try {
    const response = UrlFetchApp.fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
      {
        method: 'get',
        headers: { 'x-goog-api-key': key },
        muteHttpExceptions: true
      }
    );
    const code = response.getResponseCode();
    if (code >= 200 && code < 300) return { ok: true, message: 'OK' };
    let body;
    try { body = JSON.parse(response.getContentText()); } catch (error) { body = {}; }
    const message = body && body.error && body.error.message;
    return { ok: false, message: 'HTTP ' + code + ': ' + (message || 'klucz nie został zaakceptowany.') };
  } catch (error) {
    return { ok: false, message: String(error && error.message || error) };
  }
}

function transcribeInventoryAudio(base64Audio, mimeType, durationSeconds) {
  registerInventorySpreadsheet_();
  const key = getGeminiApiKey_();
  if (!key) throw new Error('Transkrypcja Gemini nie została skonfigurowana przez administratora.');
  if (String(mimeType || '') !== 'audio/wav') throw new Error('Nieobsługiwany format nagrania. Wymagany jest WAV.');
  const duration = Number(durationSeconds);
  if (!Number.isFinite(duration) || duration <= 0 || duration > GEMINI_MAX_AUDIO_SECONDS_) {
    throw new Error('Nagranie ma nieprawidłową długość lub przekracza limit 10 minut.');
  }
  const cleanBase64 = String(base64Audio || '').replace(/^data:[^;]+;base64,/, '');
  if (!cleanBase64 || cleanBase64.length > Math.ceil(GEMINI_MAX_AUDIO_BYTES_ * 4 / 3) + 8) {
    throw new Error('Nagranie jest puste albo zbyt duże.');
  }
  const bytes = Utilities.base64Decode(cleanBase64);
  if (bytes.length > GEMINI_MAX_AUDIO_BYTES_) throw new Error('Nagranie przekracza bezpieczny limit 20 MB.');

  const resolver = getProductResolverData('');
  const catalog = (resolver.products || []).map(function(product) {
    return product.name;
  }).filter(Boolean).join('\n');
  const prompt = [
    'Jesteś modułem transkrypcji Inventory PRO dla lokalu KRUCZA.',
    'Przepisz polską mowę dokładnie na tekst. Zwróć WYŁĄCZNIE transkrypt, bez komentarzy i Markdown.',
    'Każdy wypowiedziany produkt umieść w osobnym wierszu razem z wypowiedzianą wartością.',
    'Zachowuj liczby dziesiętne oraz pojemności. „zero siedem” zapisuj jako 0,7; „jeden litr” jako 1 litr.',
    'Słowo „sztuk” pozostaw przy wartości. Nie dopisuj pojemności, której nie wypowiedziano.',
    'Nie wybieraj między produktami o różnych pojemnościach. Nie wymyślaj nazw ani wartości.',
    'Poniższy katalog jest pomocą w pisowni marek, a nie zgodą na uzupełnianie brakujących informacji:',
    catalog
  ].join('\n');
  const payload = {
    contents: [{ parts: [
      { text: prompt },
      { inlineData: { mimeType: 'audio/wav', data: cleanBase64 } }
    ] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'text/plain'
    }
  };
  let body = {};
  let code = 0;
  let selectedModel = '';
  for (let modelIndex = 0; modelIndex < GEMINI_TRANSCRIPTION_MODELS_.length; modelIndex++) {
    const model = GEMINI_TRANSCRIPTION_MODELS_[modelIndex];
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      model + ':generateContent';
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: { 'x-goog-api-key': key },
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    code = response.getResponseCode();
    try { body = JSON.parse(response.getContentText()); } catch (error) { body = {}; }
    if (code >= 200 && code < 300) {
      selectedModel = model;
      break;
    }
    if (code !== 404) break;
  }
  if (code < 200 || code >= 300) {
    const apiMessage = body && body.error && body.error.message;
    throw new Error('Gemini nie wykonał transkrypcji (HTTP ' + code + '). ' +
      (apiMessage ? String(apiMessage).slice(0, 300) : 'Spróbuj ponownie.'));
  }
  const candidates = body.candidates || [];
  const parts = candidates[0] && candidates[0].content && candidates[0].content.parts || [];
  const transcript = parts.map(function(part) { return part.text || ''; }).join('').trim();
  if (!transcript) throw new Error('Gemini nie zwrócił transkryptu. Nagraj próbkę ponownie.');
  return {
    transcript: transcript,
    durationSeconds: duration,
    model: selectedModel
  };
}

function getGeminiTranscriptionAvailability() {
  return {
    configured: isGeminiTranscriptionConfigured_(),
    maxSeconds: GEMINI_MAX_AUDIO_SECONDS_ - 5,
    maxBytes: GEMINI_MAX_AUDIO_BYTES_
  };
}

/**
 * Trwałe zadania audio. Po zapisaniu pliku transkrypcja nie zależy już od
 * otwartej karty telefonu. Token chroni odczyt zadania przed zgadywaniem ID.
 */
function queueInventoryAudioJob(base64Audio, mimeType, durationSeconds, originalName, requestedId, requestedToken) {
  registerInventorySpreadsheet_();
  if (!isGeminiTranscriptionConfigured_()) {
    throw new Error('Transkrypcja Gemini nie została skonfigurowana przez administratora.');
  }
  const duration = Number(durationSeconds);
  if (!Number.isFinite(duration) || duration <= 0 || duration > GEMINI_MAX_AUDIO_SECONDS_) {
    throw new Error('Nagranie przekracza limit 10 minut.');
  }
  const cleanBase64 = String(base64Audio || '').replace(/^data:[^;]+;base64,/, '');
  if (!cleanBase64 || cleanBase64.length > Math.ceil(GEMINI_MAX_AUDIO_BYTES_ * 4 / 3) + 8) {
    throw new Error('Nagranie jest puste albo przekracza limit 20 MB.');
  }
  const bytes = Utilities.base64Decode(cleanBase64);
  if (bytes.length > GEMINI_MAX_AUDIO_BYTES_) throw new Error('Nagranie przekracza limit 20 MB.');

  cleanupExpiredInventoryAudioJobs_();
  const jobId = /^[a-f0-9-]{20,}$/i.test(String(requestedId || '')) ? String(requestedId) : Utilities.getUuid();
  const token = String(requestedToken || '').length >= 32 ? String(requestedToken) : Utilities.getUuid() + Utilities.getUuid();
  const existing = loadInventoryAudioJob_(jobId);
  if (existing) {
    if (existing.token !== token) throw new Error('Identyfikator zadania jest już używany.');
    return publicInventoryAudioJob_(existing);
  }
  const safeName = String(originalName || 'nagranie.wav').replace(/[^\w.\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ ]/g, '_').slice(0, 80);
  const file = getInventoryAudioTempFolder_().createFile(Utilities.newBlob(bytes, String(mimeType || 'audio/wav'), 'InventoryPRO-' + jobId + '-' + safeName));
  const job = {
    id: jobId,
    token: token,
    status: 'QUEUED',
    fileId: file.getId(),
    originalName: safeName,
    durationSeconds: duration,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    error: ''
  };
  saveInventoryAudioJob_(job);
  ScriptApp.newTrigger('processPendingInventoryAudioJobs_').timeBased().after(1000).create();
  return publicInventoryAudioJob_(job);
}

function getInventoryAudioJobs(requests) {
  cleanupExpiredInventoryAudioJobs_();
  return (Array.isArray(requests) ? requests : []).map(function(request) {
    const job = loadInventoryAudioJob_(request && request.id);
    if (!job || job.token !== String(request && request.token || '')) {
      return { id: String(request && request.id || ''), status: 'MISSING', error: 'Zadanie wygasło lub nie istnieje.' };
    }
    return publicInventoryAudioJob_(job);
  });
}

function retryInventoryAudioJob(id, token) {
  const job = loadInventoryAudioJob_(id);
  if (!job || job.token !== String(token || '')) throw new Error('Nie znaleziono zadania.');
  if (!job.fileId) throw new Error('Plik nagrania nie jest już dostępny.');
  job.status = 'QUEUED';
  job.error = '';
  job.updatedAt = Date.now();
  saveInventoryAudioJob_(job);
  ScriptApp.newTrigger('processPendingInventoryAudioJobs_').timeBased().after(1000).create();
  return publicInventoryAudioJob_(job);
}

function dismissInventoryAudioJob(id, token) {
  const job = loadInventoryAudioJob_(id);
  if (!job || job.token !== String(token || '')) return { removed: false };
  deleteInventoryAudioJobFiles_(job);
  PropertiesService.getScriptProperties().deleteProperty(GEMINI_AUDIO_JOB_PREFIX_ + job.id);
  return { removed: true };
}

function processPendingInventoryAudioJobs_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const properties = PropertiesService.getScriptProperties();
    const all = properties.getProperties();
    const keys = Object.keys(all).filter(function(key) {
      return key.indexOf(GEMINI_AUDIO_JOB_PREFIX_) === 0;
    }).sort(function(left, right) {
      let a = {}, b = {};
      try { a = JSON.parse(all[left]); } catch (error) {}
      try { b = JSON.parse(all[right]); } catch (error) {}
      return Number(a.createdAt || 0) - Number(b.createdAt || 0);
    });
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
      const key = keys[keyIndex];
      let job;
      try { job = JSON.parse(all[key]); } catch (error) { continue; }
      if (!job || job.status !== 'QUEUED') continue;
      job.status = 'PROCESSING';
      job.updatedAt = Date.now();
      saveInventoryAudioJob_(job);
      try {
        const audioFile = DriveApp.getFileById(job.fileId);
        const result = transcribeInventoryAudio(
          Utilities.base64Encode(audioFile.getBlob().getBytes()),
          'audio/wav',
          job.durationSeconds
        );
        const transcriptFile = getInventoryAudioTempFolder_().createFile(Utilities.newBlob(
          result.transcript,
          'text/plain',
          'InventoryPRO-transcript-' + job.id + '.txt'
        ));
        job.transcriptFileId = transcriptFile.getId();
        job.model = result.model || '';
        job.status = 'DONE';
        job.error = '';
      } catch (error) {
        job.status = 'ERROR';
        job.error = String(error && error.message || error).slice(0, 600);
      }
      job.updatedAt = Date.now();
      saveInventoryAudioJob_(job);
      break; // Jedno nagranie na wykonanie chroni limit czasu Apps Script.
    }
    const remaining = Object.keys(PropertiesService.getScriptProperties().getProperties()).some(function(key) {
      if (key.indexOf(GEMINI_AUDIO_JOB_PREFIX_) !== 0) return false;
      const pending = loadInventoryAudioJob_(key.slice(GEMINI_AUDIO_JOB_PREFIX_.length));
      return pending && pending.status === 'QUEUED';
    });
    if (remaining) ScriptApp.newTrigger('processPendingInventoryAudioJobs_').timeBased().after(1000).create();
  } finally {
    lock.releaseLock();
  }
}

function publicInventoryAudioJob_(job) {
  let transcript = '';
  if (job.status === 'DONE' && job.transcriptFileId) {
    try { transcript = DriveApp.getFileById(job.transcriptFileId).getBlob().getDataAsString('UTF-8'); }
    catch (error) { transcript = ''; }
  }
  return {
    id: job.id,
    token: job.token,
    status: job.status,
    originalName: job.originalName || 'nagranie',
    durationSeconds: job.durationSeconds,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    transcript: transcript,
    error: job.error || ''
  };
}

function saveInventoryAudioJob_(job) {
  PropertiesService.getScriptProperties().setProperty(
    GEMINI_AUDIO_JOB_PREFIX_ + job.id,
    JSON.stringify(job)
  );
}

function loadInventoryAudioJob_(id) {
  const raw = PropertiesService.getScriptProperties().getProperty(GEMINI_AUDIO_JOB_PREFIX_ + String(id || ''));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (error) { return null; }
}

function cleanupExpiredInventoryAudioJobs_() {
  const properties = PropertiesService.getScriptProperties();
  const all = properties.getProperties();
  const cutoff = Date.now() - GEMINI_AUDIO_JOB_TTL_MS_;
  Object.keys(all).filter(function(key) { return key.indexOf(GEMINI_AUDIO_JOB_PREFIX_) === 0; }).forEach(function(key) {
    let job;
    try { job = JSON.parse(all[key]); } catch (error) { properties.deleteProperty(key); return; }
    if (Number(job.createdAt || 0) >= cutoff) return;
    deleteInventoryAudioJobFiles_(job);
    properties.deleteProperty(key);
  });
}

function deleteInventoryAudioJobFiles_(job) {
  [job && job.fileId, job && job.transcriptFileId].filter(Boolean).forEach(function(id) {
    try { DriveApp.getFileById(id).setTrashed(true); } catch (error) { console.warn(String(error)); }
  });
}

function getInventoryAudioTempFolder_() {
  const properties = PropertiesService.getScriptProperties();
  const configuredId = properties.getProperty(GEMINI_AUDIO_FOLDER_PROPERTY_);
  if (configuredId) {
    try { return DriveApp.getFolderById(configuredId); } catch (error) { console.warn(String(error)); }
  }
  const folder = DriveApp.createFolder('Inventory PRO — pliki tymczasowe audio');
  properties.setProperty(GEMINI_AUDIO_FOLDER_PROPERTY_, folder.getId());
  return folder;
}
