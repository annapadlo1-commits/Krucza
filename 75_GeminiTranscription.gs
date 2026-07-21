/**
 * Inventory PRO — bezpieczna transkrypcja nagrań przez Gemini.
 * Klucz jest przechowywany wyłącznie w Script Properties.
 */
const GEMINI_TRANSCRIPTION_PROPERTY_ = 'INVENTORY_PRO_GEMINI_API_KEY';
const GEMINI_TRANSCRIPTION_MODELS_ = Object.freeze([
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite'
]);
const GEMINI_MAX_AUDIO_BYTES_ = 10000000;

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
  if (!Number.isFinite(duration) || duration <= 0 || duration > 185) {
    throw new Error('Nagranie ma nieprawidłową długość lub przekracza limit 3 minut.');
  }
  const cleanBase64 = String(base64Audio || '').replace(/^data:[^;]+;base64,/, '');
  if (!cleanBase64 || cleanBase64.length > Math.ceil(GEMINI_MAX_AUDIO_BYTES_ * 4 / 3) + 8) {
    throw new Error('Nagranie jest puste albo zbyt duże.');
  }
  const bytes = Utilities.base64Decode(cleanBase64);
  if (bytes.length > GEMINI_MAX_AUDIO_BYTES_) throw new Error('Nagranie przekracza bezpieczny limit 10 MB.');

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
  return { configured: isGeminiTranscriptionConfigured_() };
}
