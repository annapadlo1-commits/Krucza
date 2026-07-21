const CONFIG = Object.freeze({
  EDITION: 'Production Edition',
  RELEASE_CHANNEL: 'STABLE',
  LOCATION: Object.freeze({
    ID: 'KRUCZA',
    NAME: 'KRUCZA',
    NUMBER: 2,
    NEXT_LOCATION: 'PAWILONY'
  }),
  VERSION: '4.5.3-VOICE-MEMO-GEMINI-KRUCZA',
  SHEETS: Object.freeze({
    INVENTORY: 'INWENTURA tajniak',
    DICTIONARY: 'Slownik',
    REPORT: 'Raport',
    SETTINGS: 'Ustawienia',
    HISTORY: 'Historia',
    TECH_LOG: 'Log techniczny',
    IMPORT_AUDIT: 'Audyt importow',
    NEW_PRODUCTS: 'Nowe produkty',
    EXPORT_HISTORY: 'Historia eksportow',
    DATA_AUDIT: 'Audyt danych',
    HISTORY_LEGACY: 'Historia legacy'
  }),
  SHEET_ALIASES: Object.freeze({
    INVENTORY: Object.freeze(['INWENTURA tajniak', 'INWENTURA', 'Inwentura'])
  }),
  DICTIONARY: Object.freeze({
    FIRST_DATA_ROW: 2,
    ALIAS_COLUMN: 1,
    CONFIG_START_COLUMN: 4,
    CONFIG_COLUMN_COUNT: 9
  }),
  PRODUCT_TYPES: Object.freeze({
    NORMAL: 'NORMAL',
    KEG: 'KEG',
    LOCATION: 'LOCATION'
  }),

  // Fizyczny układ zakładki „INWENTURA tajniak” w lokalu Krucza.
  INVENTORY_LAYOUT: Object.freeze({
    NORMAL: Object.freeze({
      grossWeight: 'B',
      emptyContainerWeight: 'C',
      openNet: 'D',
      prepNet: 'E',
      fullUnits: 'F',
      unitCapacity: 'G',
      fullUnitsVolume: 'H',
      finalTotal: 'I',
      formulaColumns: Object.freeze(['D', 'H', 'I']),
      unit: 'l'
    }),
    KEG: Object.freeze({
      grossWeight: 'B',
      emptyContainerWeight: 'C',
      openNet: 'D',
      prepNet: 'E',
      fullUnits: 'F',
      unitCapacity: 'G',
      fullUnitsVolume: 'H',
      finalTotal: 'I',
      formulaColumns: Object.freeze(['D', 'H', 'I']),
      unit: 'l'
    }),
    LOCATION: Object.freeze({
      warehouse: 'B',
      darkroom: 'C',
      fridges: '',
      finalTotal: 'D',
      formulaColumns: Object.freeze(['D']),
      unit: 'szt.'
    })
  }),

  // Techniczne klucze warehouse/darkroom pozostają zgodne ze SŁOWNIKIEM,
  // natomiast etykiety użytkownika są właściwe dla Kruczej.
  LOCATION_AREAS: Object.freeze([
    Object.freeze({
      key: 'bar',
      label: 'Bar',
      columnKey: 'warehouse',
      aliases: Object.freeze(['bar', 'na barze', 'barze'])
    }),
    Object.freeze({
      key: 'zaplecze',
      label: 'Zaplecze',
      columnKey: 'darkroom',
      aliases: Object.freeze([
        'zaplecze', 'na zapleczu', 'zapleczu',
        'magazyn', 'w magazynie', 'mag', 'warehouse', 'backoffice', 'darkroom'
      ])
    })
  ]),

  FORMULA_POLICY: Object.freeze({
    NUMERIC_TOLERANCE: 0.000000001,
    BLOCK_SETUP_ON_CONFLICT: true,
    CREATE_BACKUP_BEFORE_REPAIR: false,
    AUTOMATIC_REPAIR_ENABLED: false
  }),

  CACHE: Object.freeze({
    CATALOG_KEY: 'inventory_pro_catalog_krucza_v5',
    TTL_SECONDS: 21600
  }),
  PERFORMANCE: Object.freeze({
    FUZZY_SHORTLIST_SIZE: 20,
    LEVENSHTEIN_FINALISTS: 5,
    UI_RENDER_BATCH_SIZE: 60
  }),
  REVIEW: Object.freeze({
    AUTO_MERGE_DUPLICATES: true,
    PREVIOUS_CHANGE_WARNING_PERCENT: 250,
    PREVIOUS_CHANGE_WARNING_ABSOLUTE: 10
  }),
  QUALITY: Object.freeze({
    NORMAL_WHOLE_WARNING: 20,
    NORMAL_WEIGHT_WARNING: 20,
    KEG_WHOLE_WARNING: 20,
    KEG_WEIGHT_WARNING: 100,
    LOCATION_WARNING: 500
  })
});
