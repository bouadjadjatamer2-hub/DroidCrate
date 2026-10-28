# DroidCrate

**مركز عمل مكتبي مجاني ومفتوح المصدر لهواتف أندرويد على ويندوز.**

DroidCrate يجمع في مكان واحد أربع أدوات: التعرّف على الهاتف المتصل واقتراح الأداة
المناسبة، مكتبة منظمة لأدوات الفلاش المعروفة مع روابطها الرسمية، قوائم تحقق قبل
العمليات الخطيرة، ومسار تعليمي بمستويات واختبارات.

> **التنبيه القانوني:** هذا التطبيق تعليمي. استعمله فقط على الأجهزة التي تملكها أو
> تملك إذناً صريحاً من صاحبها. لا يضم المشروع أي أداة مغلقة المصدر، ولا أي ملف
> فيرموير، ولا أي أداة مكركة. أدوات الشركات تُحمَّل من مصادرها الرسمية فقط.

## الحالة

المشروع قيد البناء على مراحل. راجع [docs/STAGES.md](docs/STAGES.md) لمعرفة ما تم
وما تبقّى.

| المرحلة | الحالة |
| --- | --- |
| 0 — تهيئة المشروع | ✅ مكتملة |
| 1 — التعرف على الهاتف | ✅ مكتملة |
| 2 — مكتبة الأدوات | ✅ مكتملة |
| 3 — قوائم التحقق | ✅ مكتملة |
| 4 — أدوات الاتصال | ✅ مكتملة |
| 5 — مسار التعلم | ✅ مكتملة |
| 6 — سجل العمليات | ✅ مكتملة |
| 7 — التحديث وبدون إنترنت | ✅ مكتملة |
| 8 — التلميع والإصدار | ✅ مكتملة |

## التنزيل

- **المثبّت (ويندوز 10/11، x64):**
  [DroidCrate-0.1.0-Setup.exe](https://github.com/bouadjadjatamer2-hub/DroidCrate/releases/download/v0.1.0/DroidCrate-0.1.0-Setup.exe)
- **صفحة التنزيل العربية:** [Asraab / DroidCrate](https://bouadjadjatamer2-hub.github.io/asraab/apps/droidcrate/)
- **كل الإصدارات:** [GitHub Releases](https://github.com/bouadjadjatamer2-hub/DroidCrate/releases)

بصمة SHA-256 للمثبّت 0.1.0:
`8c785fbaffd9f9472082bd87f84c634db077616fd4cbb4f0529008de8529789c`

المثبّت غير موقّع بشهادة تجارية، لذلك قد يعرض SmartScreen تحذير «ناشر غير معروف».
تحقق من البصمة أعلاه قبل التشغيل:

```powershell
Get-FileHash .\DroidCrate-0.1.0-Setup.exe -Algorithm SHA256
```

## التقنيات

كل التقنيات المستعملة مجانية ومفتوحة المصدر:

- Electron
- React
- TypeScript
- SQLite
- Vite
- Vitest
- Electron Builder

## التشغيل محلياً

```powershell
npm install
npm run dev
```

### الأوامر

```powershell
npm run dev          # تشغيل التطبيق في وضع التطوير
npm run typecheck    # فحص الأنواع
npm run test         # اختبارات الوحدة
npm run build        # بناء الإنتاج
npm run build:win    # إنشاء مثبّت ويندوز
npm run content:manifest  # إعادة توليد بيان المحتوى بعد تعديل data/
```

## المساهمة

اقرأ [CONTRIBUTING.md](CONTRIBUTING.md). كل المساهمات مرحّب بها: بيانات الأدوات،
الدروس، الترجمة، إصلاح الأخطاء، والاختبارات.

## الترخيص

المشروع تحت ترخيص [MIT](LICENSE). ملفات البيانات والدروس تأتي تحت نفس الترخيص
إلا إذا ذُكر خلاف ذلك. أسماء الأدوات والعلامات التجارية ملك لأصحابها، وتُذكر هنا
للتعريف فقط. راجع [NOTICE.md](NOTICE.md).

## موقع المشروع

- الموقع: [Asraab](https://bouadjadjatamer2-hub.github.io/asraab/)
- صفحة DroidCrate: [Asraab / DroidCrate](https://bouadjadjatamer2-hub.github.io/asraab/apps/droidcrate/)
- المستودع: [github.com/bouadjadjatamer2-hub/DroidCrate](https://github.com/bouadjadjatamer2-hub/DroidCrate)
- المشاكل والاقتراحات: [Issues](https://github.com/bouadjadjatamer2-hub/DroidCrate/issues)

## التوثيق

- [مراحل البناء](docs/STAGES.md) — ما أُنجز في كل مرحلة وكيفية التحقق منه.
- [التقرير النهائي](docs/FINAL-REPORT.md) — ملخص العمل، ما تبقّى، والأخطاء المعروفة.
- [دليل الإصدار](docs/RELEASE.md) — خطوات إصدار نسخة جديدة خطوة بخطوة.
