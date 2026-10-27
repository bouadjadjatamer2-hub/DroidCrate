import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

export type Language = 'en' | 'ar'

const messages: Record<Language, Record<string, string>> = {
  en: {
    'app.name': 'DroidCrate',
    'app.tagline': 'Android service bench',
    'app.description':
      'A calm, offline-first workspace for understanding an Android phone, choosing the right tool, and learning the safe order of operations.',
    'app.offline': 'Offline first',
    'app.foundation': 'Foundation',
    'nav.workspace': 'Workspace',
    'nav.device': 'Device',
    'nav.tools': 'Tools',
    'nav.checklists': 'Checklists',
    'nav.lessons': 'Lessons',
    'nav.history': 'History',
    'nav.settings': 'Settings',
    'nav.legal': 'For devices you own',
    'footer.version': 'Version {version}',
    'footer.license': 'MIT licensed',
    'footer.docs': 'Documentation',
    'device.eyebrow': 'Workspace / Device',
    'device.title': 'Device',
    'device.subtitle':
      'Connect a phone to identify its USB mode and see the official next step.',
    'device.monitor': 'USB monitor',
    'device.waiting': 'Waiting',
    'device.stageNote': 'Live detection arrives in Stage 1',
    'device.liveWaiting': 'Watching the USB bus',
    'device.liveScanning': 'Scanning the USB bus…',
    'device.live': 'Live',
    'device.detected': '{count} connected',
    'device.autoRefresh': 'Refreshes every 3 s',
    'device.connectedTitle': 'Connected now',
    'device.connectedHint': 'Read from Windows Plug and Play',
    'device.monitorTitle': 'USB monitor',
    'device.monitorBody':
      'Windows Plug and Play identifiers are read locally. No device data leaves this computer.',
    'device.lastScan': 'Last scan',
    'device.usbRecords': 'USB records',
    'device.scanNow': 'Scan now',
    'device.scanning': 'Scanning…',
    'device.modePresent': 'present',
    'device.unknownBrand': 'Unrecognised vendor',
    'device.modelUnknown': 'Model not exposed',
    'device.usbId': 'USB ID',
    'device.match': 'Match',
    'device.confidence.high': 'Exact rule',
    'device.confidence.medium': 'Mode inferred',
    'device.confidence.low': 'Needs review',
    'device.rule': 'Rule',
    'device.ruleNone': 'None',
    'device.suggestedTool': 'Suggested next step',
    'device.officialDownload': 'Official download',
    'device.supportPage': 'Support page',
    'device.driverLink': 'Driver: {name}',
    'device.unknownModeTitle': 'Mode not recognised',
    'device.unknownModeBody':
      'A USB device is present, but its mode could not be identified. Check the cable, port, and phone screen.',
    'device.errorTitle': 'USB scan failed',
    'device.errorHint':
      'Restart the app and try again. The scan uses Windows PowerShell and does not need administrator rights.',
    'device.emptyEyebrow': 'No connection',
    'device.emptyTitle': 'No device detected',
    'device.emptyBody':
      'Plug in an Android phone with a data-capable USB cable. DroidCrate will watch the USB bus for ADB, Fastboot, Download Mode, EDL, and BROM identifiers.',
    'device.step1Title': 'Use a data cable',
    'device.step1Body': 'Charge-only cables never show up on the USB bus.',
    'device.step2Title': 'Unlock the phone',
    'device.step2Body': 'Keep the screen unlocked while Windows enumerates the device.',
    'device.step3Title': 'Choose a USB mode',
    'device.step3Body': 'File transfer or ADB is enough for the first handshake.',
    'device.recogniseTitle': 'Modes this workspace will recognise',
    'device.recogniseBody':
      'Detection is based on USB vendor and product identifiers, not on a guessed device name.',
    'device.mode.adb': 'ADB',
    'device.mode.fastboot': 'Fastboot',
    'device.mode.download': 'Download Mode',
    'device.mode.edl': 'EDL',
    'device.mode.brom': 'BROM',
    'device.ownership':
      'Only service devices that you own or have explicit permission to work on.',
    'tools.eyebrow': 'Workspace / Tools',
    'tools.title': 'Tool library',
    'tools.subtitle':
      'A curated index of Android service tools, with official sources and honest compatibility notes.',
    'tools.emptyTitle': 'The library opens in Stage 2',
    'tools.emptyBody':
      'Cards will cover Odin, SP Flash Tool, QFIL, Mi Flash Tool, MSM Download Tool, Android Flash Tool, LGUP, TWRP, OrangeFox, Magisk, KernelSU, APatch, and Platform Tools.',
    'tools.officialOnly': 'Official links only',
    'tools.officialOnlyBody':
      'No mirrors, no cracked builds, and no bundled vendor software. Ever.',
    'checklists.eyebrow': 'Workspace / Checklists',
    'checklists.title': 'Pre-flight checklists',
    'checklists.subtitle':
      'Slow down before a risky step. Each checklist explains why every item matters.',
    'checklists.emptyTitle': 'Interactive checklists arrive in Stage 3',
    'checklists.emptyBody':
      'Stable firmware, bootloader unlock, custom recovery, root, and custom ROM checklists will be available here. Required items cannot be skipped.',
    'checklists.op.stock': 'Stock firmware',
    'checklists.op.unlock': 'Bootloader unlock',
    'checklists.op.recovery': 'Custom recovery',
    'checklists.op.root': 'Root',
    'checklists.op.rom': 'Custom ROM',
    'lessons.eyebrow': 'Workspace / Lessons',
    'lessons.title': 'Learning path',
    'lessons.subtitle':
      'Start with the fundamentals, then work toward recovery and hardware practice.',
    'lessons.emptyTitle': 'Lessons open in Stage 5',
    'lessons.emptyBody':
      'Three levels, short quizzes, and progress saved on this computer. Lessons are plain text files, easy to read and improve.',
    'lessons.level.basic': 'Foundation',
    'lessons.level.intermediate': 'Intermediate',
    'lessons.level.advanced': 'Advanced',
    'history.eyebrow': 'Workspace / History',
    'history.title': 'Operation history',
    'history.subtitle':
      'A local record of what was attempted, on which device, and how it ended.',
    'history.emptyTitle': 'History is recorded from Stage 6',
    'history.emptyBody':
      'Device actions and completed checklists will be logged here. Nothing is uploaded; exports are created only when you ask.',
    'history.exportTxt': 'Export TXT',
    'history.exportCsv': 'Export CSV',
    'settings.eyebrow': 'Workspace / Settings',
    'settings.title': 'Settings',
    'settings.subtitle': 'Language, local data, and project information.',
    'settings.language': 'Language',
    'settings.languageHint':
      'English is the default. Arabic switches the entire interface to right-to-left.',
    'settings.english': 'English',
    'settings.arabic': 'العربية',
    'settings.languageSaved': 'Saved on this computer',
    'settings.dataTitle': 'Local data',
    'settings.dataBody':
      'Progress and history stay in a local SQLite database. The app works without a network connection.',
    'settings.dataBadge': 'No account',
    'settings.aboutTitle': 'About DroidCrate',
    'settings.version': 'Version',
    'settings.license': 'License',
    'settings.licenseValue': 'MIT',
    'settings.source': 'Source code',
    'settings.sourceHint': 'Report bugs and follow releases on GitHub.',
    'settings.safetyTitle': 'Safety and legal notice',
    'settings.safetyBody':
      'DroidCrate is an educational tool. It does not bypass locks, accounts, or ownership protections. Use it only on devices you own or are authorised to service. Vendor tools are linked from official sources and are never bundled.',
    'settings.openSource': 'Open project',
    'common.stage': 'Stage {stage}',
    'common.comingSoon': 'Coming soon',
    'common.docs': 'Read the docs'
  },
  ar: {
    'app.name': 'DroidCrate',
    'app.tagline': 'مركز خدمة أندرويد',
    'app.description':
      'مساحة عمل هادئة تعمل دون إنترنت لفهم هاتف أندرويد، واختيار الأداة المناسبة، وتعلّم ترتيب الخطوات الآمن.',
    'app.offline': 'يعمل دون إنترنت',
    'app.foundation': 'الأساس',
    'nav.workspace': 'مساحة العمل',
    'nav.device': 'الجهاز',
    'nav.tools': 'الأدوات',
    'nav.checklists': 'قوائم التحقق',
    'nav.lessons': 'الدروس',
    'nav.history': 'السجل',
    'nav.settings': 'الإعدادات',
    'nav.legal': 'للأجهزة التي تملكها',
    'footer.version': 'الإصدار {version}',
    'footer.license': 'ترخيص MIT',
    'footer.docs': 'الوثائق',
    'device.eyebrow': 'مساحة العمل / الجهاز',
    'device.title': 'الجهاز',
    'device.subtitle': 'وصّل هاتفاً لتتعرف على وضع USB والخطوة الرسمية التالية.',
    'device.monitor': 'مراقب USB',
    'device.waiting': 'في الانتظار',
    'device.stageNote': 'التعرّف المباشر يأتي في المرحلة الأولى',
    'device.liveWaiting': 'يراقب منفذ USB',
    'device.liveScanning': 'يفحص منفذ USB…',
    'device.live': 'مباشر',
    'device.detected': '{count} متصل',
    'device.autoRefresh': 'يتحدث كل ٣ ثوانٍ',
    'device.connectedTitle': 'المتصل الآن',
    'device.connectedHint': 'مقروء من Plug and Play في ويندوز',
    'device.monitorTitle': 'مراقب USB',
    'device.monitorBody':
      'تُقرأ معرّفات Plug and Play في ويندوز محلياً. لا تغادر أي بيانات جهاز هذا الحاسوب.',
    'device.lastScan': 'آخر فحص',
    'device.usbRecords': 'سجلات USB',
    'device.scanNow': 'افحص الآن',
    'device.scanning': 'جارٍ الفحص…',
    'device.modePresent': 'حاضر',
    'device.unknownBrand': 'شركة غير معروفة',
    'device.modelUnknown': 'الطراز غير ظاهر',
    'device.usbId': 'معرّف USB',
    'device.match': 'التطابق',
    'device.confidence.high': 'قاعدة دقيقة',
    'device.confidence.medium': 'وضع مستنتج',
    'device.confidence.low': 'يحتاج مراجعة',
    'device.rule': 'القاعدة',
    'device.ruleNone': 'لا شيء',
    'device.suggestedTool': 'الخطوة التالية المقترحة',
    'device.officialDownload': 'تنزيل رسمي',
    'device.supportPage': 'صفحة الدعم',
    'device.driverLink': 'التعريف: {name}',
    'device.unknownModeTitle': 'الوضع غير معروف',
    'device.unknownModeBody':
      'يوجد جهاز USB لكن تعذّر تحديد وضعه. تحقق من الكابل والمنفذ وشاشة الهاتف.',
    'device.errorTitle': 'فشل فحص USB',
    'device.errorHint':
      'أعد تشغيل التطبيق وحاول مجدداً. الفحص يستعمل Windows PowerShell ولا يحتاج صلاحيات مدير.',
    'device.emptyEyebrow': 'لا يوجد اتصال',
    'device.emptyTitle': 'لم يتم التعرف على أي جهاز',
    'device.emptyBody':
      'وصّل هاتف أندرويد بكابل USB مخصص لنقل البيانات. سيراقب DroidCrate منفذ USB بحثاً عن معرّفات ADB وFastboot وDownload Mode وEDL وBROM.',
    'device.step1Title': 'استعمل كابل بيانات',
    'device.step1Body': 'كابلات الشحن فقط لا تظهر على منفذ USB.',
    'device.step2Title': 'افتح قفل الهاتف',
    'device.step2Body': 'أبقِ الشاشة مفتوحة أثناء تعرّف ويندوز على الجهاز.',
    'device.step3Title': 'اختر وضع USB',
    'device.step3Body': 'نقل الملفات أو ADB يكفي للمصافحة الأولى.',
    'device.recogniseTitle': 'الأوضاع التي ستتعرف عليها مساحة العمل',
    'device.recogniseBody':
      'التعرّف يعتمد على معرّف الشركة ومعرّف المنتج في USB، وليس على تخمين اسم الجهاز.',
    'device.mode.adb': 'ADB',
    'device.mode.fastboot': 'Fastboot',
    'device.mode.download': 'Download Mode',
    'device.mode.edl': 'EDL',
    'device.mode.brom': 'BROM',
    'device.ownership': 'اخدم فقط الأجهزة التي تملكها أو لديك إذن صريح للعمل عليها.',
    'tools.eyebrow': 'مساحة العمل / الأدوات',
    'tools.title': 'مكتبة الأدوات',
    'tools.subtitle':
      'فهرس منظم لأدوات خدمة أندرويد، مع مصادر رسمية وملاحظات توافق صادقة.',
    'tools.emptyTitle': 'تفتح المكتبة في المرحلة الثانية',
    'tools.emptyBody':
      'ستغطي البطاقات Odin وSP Flash Tool وQFIL وMi Flash Tool وMSM Download Tool وAndroid Flash Tool وLGUP وTWRP وOrangeFox وMagisk وKernelSU وAPatch وPlatform Tools.',
    'tools.officialOnly': 'روابط رسمية فقط',
    'tools.officialOnlyBody': 'لا مرايا، ولا نسخ مكركة، ولا أدوات شركات مدمجة. أبداً.',
    'checklists.eyebrow': 'مساحة العمل / قوائم التحقق',
    'checklists.title': 'قوائم التحقق قبل العملية',
    'checklists.subtitle': 'تمهّل قبل أي خطوة خطيرة. كل قائمة تشرح لماذا تهم كل نقطة.',
    'checklists.emptyTitle': 'القوائم التفاعلية تأتي في المرحلة الثالثة',
    'checklists.emptyBody':
      'ستتوفر هنا قوائم الفيرموير الأصلي وفتح البوتلودر والريكفري المخصص والروت والروم المخصص. لا يمكن تخطي النقاط الإجبارية.',
    'checklists.op.stock': 'فيرموير أصلي',
    'checklists.op.unlock': 'فتح البوتلودر',
    'checklists.op.recovery': 'ريكفري مخصص',
    'checklists.op.root': 'روت',
    'checklists.op.rom': 'روم مخصص',
    'lessons.eyebrow': 'مساحة العمل / الدروس',
    'lessons.title': 'مسار التعلم',
    'lessons.subtitle': 'ابدأ بالأساسيات، ثم تقدم نحو الاستعادة والتطبيق على العتاد.',
    'lessons.emptyTitle': 'تفتح الدروس في المرحلة الخامسة',
    'lessons.emptyBody':
      'ثلاثة مستويات، اختبارات قصيرة، وتقدم محفوظ على هذا الحاسوب. الدروس ملفات نصية سهلة القراءة والتعديل.',
    'lessons.level.basic': 'أساسي',
    'lessons.level.intermediate': 'متوسط',
    'lessons.level.advanced': 'متقدم',
    'history.eyebrow': 'مساحة العمل / السجل',
    'history.title': 'سجل العمليات',
    'history.subtitle': 'سجل محلي لما تمت محاولته، وعلى أي جهاز، وكيف انتهى.',
    'history.emptyTitle': 'يبدأ التسجيل في المرحلة السادسة',
    'history.emptyBody':
      'ستُسجل هنا عمليات الجهاز وقوائم التحقق المكتملة. لا يُرفع شيء إلى الإنترنت، ولا تُنشأ الصادرات إلا بطلبك.',
    'history.exportTxt': 'تصدير TXT',
    'history.exportCsv': 'تصدير CSV',
    'settings.eyebrow': 'مساحة العمل / الإعدادات',
    'settings.title': 'الإعدادات',
    'settings.subtitle': 'اللغة، البيانات المحلية، ومعلومات المشروع.',
    'settings.language': 'اللغة',
    'settings.languageHint':
      'الإنجليزية هي الافتراضية. العربية تحوّل الواجهة كاملة إلى اتجاه من اليمين إلى اليسار.',
    'settings.english': 'English',
    'settings.arabic': 'العربية',
    'settings.languageSaved': 'محفوظة على هذا الحاسوب',
    'settings.dataTitle': 'البيانات المحلية',
    'settings.dataBody':
      'التقدم والسجل يبقيان في قاعدة SQLite محلية. التطبيق يعمل دون اتصال بالشبكة.',
    'settings.dataBadge': 'بدون حساب',
    'settings.aboutTitle': 'عن DroidCrate',
    'settings.version': 'الإصدار',
    'settings.license': 'الترخيص',
    'settings.licenseValue': 'MIT',
    'settings.source': 'الشيفرة المصدرية',
    'settings.sourceHint': 'أبلغ عن الأخطاء وتابع الإصدارات على GitHub.',
    'settings.safetyTitle': 'تنبيه أمان وقانوني',
    'settings.safetyBody':
      'DroidCrate أداة تعليمية. لا يتجاوز الأقفال أو الحسابات أو حماية الملكية. استعمله فقط على الأجهزة التي تملكها أو لديك إذن بصيانتها. أدوات الشركات مرتبطة بمصادرها الرسمية ولا تُدمج أبداً.',
    'settings.openSource': 'فتح المشروع',
    'common.stage': 'المرحلة {stage}',
    'common.comingSoon': 'قريباً',
    'common.docs': 'اقرأ الوثائق'
  }
}

interface I18nValue {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string, values?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue | null>(null)
const STORAGE_KEY = 'droidcrate.language'

function readStoredLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(readStoredLanguage)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // Storage can be unavailable in hardened environments; the UI still works.
    }
  }, [lang])

  const setLang = useCallback((next: Language) => setLangState(next), [])

  const t = useCallback(
    (key: string, values?: Record<string, string | number>): string => {
      const template = messages[lang][key] ?? messages.en[key] ?? key
      if (!values) return template
      return Object.entries(values).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
        template
      )
    },
    [lang]
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
