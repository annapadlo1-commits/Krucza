/**
 * Inventory PRO — bezpieczna transkrypcja nagrań przez Gemini.
 * Klucz jest przechowywany wyłącznie w Script Properties.
 */
const GEMINI_TRANSCRIPTION_PROPERTY_ = 'INVENTORY_PRO_GEMINI_API_KEY';
const GEMINI_TRANSCRIPTION_MODEL_ = 'gemini-2.5-flash-lite';
const GEMINI_MAX_AUDIO_BYTES_ = 10000000;

function isGeminiTranscriptionConfigured_() {
  return Boolean(PropertiesService.getScriptProperties()
    .getProperty(GEMINI_TRANSCRIPTION_PROPERTY_));
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
  if (!/^AIza[\w-]{20,}$/.test(key)) {
    ui.alert('Klucz nie ma oczekiwanego formatu. Nie zapisano zmian.');
    return;
  }
  PropertiesService.getScriptProperties()
    .setProperty(GEMINI_TRANSCRIPTION_PROPERTY_, key);
  ui.alert('Transkrypcja Gemini została skonfigurowana. Zaktualizuj wdrożenie aplikacji mobilnej do nowej wersji.');
}

function showGeminiTranscriptionStatus() {
  SpreadsheetApp.getUi().alert(
    'Inventory PRO — Gemini',
    isGeminiTranscriptionConfigured_()
      ? 'Klucz API jest skonfigurowany. Aplikacja mobilna może wysyłać nagrania do transkrypcji.'
      : 'Brak klucza API. Użyj opcji „Skonfiguruj transkrypcję Gemini”.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function transcribeInventoryAudio(base64Audio, mimeType, durationSeconds) {
  registerInventorySpreadsheet_();
  const key = PropertiesService.getScriptProperties()
    .getProperty(GEMINI_TRANSCRIPTION_PROPERTY_);
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
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    GEMINI_TRANSCRIPTION_MODEL_ + ':generateContent?key=' + encodeURIComponent(key);
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  let body;
  try { body = JSON.parse(response.getContentText()); } catch (error) { body = {}; }
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
    model: GEMINI_TRANSCRIPTION_MODEL_
  };
}
