# دليل إصدار نسخة جديدة

هذا الملف يشرح كيف تُصدر نسخة جديدة من DroidCrate خطوة بخطوة، بما في ذلك تحديث
الموقع، والتحقق، والتراجع عند الحاجة. كل الأوامر تُنفَّذ من جذر المستودع.

## 0. المتطلبات

- Node.js 26 أو أحدث وnpm.
- اعتماد GitHub محفوظ لـ `github.com` (يُقرأ عبر `git credential fill`).
  لا حاجة إلى `gh`، ولا تُطبع التوكن في أي سجل.
- ويندوز 10/11 x64 لبناء NSIS.
- اتصال بالشبكة لتنزيل Electron أثناء البناء ولنشر الإصدار.

```powershell
git clone https://github.com/bouadjadjatamer2-hub/DroidCrate.git
cd DroidCrate
npm ci
```

## 1. اختر رقم الإصدار وحدّث كل المواضع

مثال: من `0.1.0` إلى `0.2.0`.

| الملف | ما يُغيَّر |
| --- | --- |
| `package.json` | `"version": "0.2.0"` |
| `docs/releases/v0.2.0.md` | ملف ملاحظات جديد (يُنشأ) |
| `README.md` | رقم الإصدار، رابط المثبّت، البصمة (بعد البناء) |
| `src/shared/welcome.ts` | `WELCOME_NOTICE_VERSION` فقط إذا تغيّر نص التنبيه القانوني |
| `docs/STAGES.md` أو `docs/FINAL-REPORT.md` | الأرقام والنتائج إن تغيّرت |
| `docs/sitemap.xml` (أسراب) | تاريخ `lastmod` لصفحة DroidCrate |

لا تنسَ أن `electron-builder` يأخذ اسم الملف من `version`:

```
dist/DroidCrate-<version>-Setup.exe
```

## 2. تحديث المحتوى إن تغيّر `data/`

أي تعديل على `data/tools.json` أو `checklists.json` أو `lessons/` أو
`devices.json` يستلزم إعادة توليد البيان:

```powershell
npm run content:manifest
```

ثم تحقق أن اختبار البيان ينجح:

```powershell
npm test
```

`data/content-manifest.json` يجب أن يُرفع مع بقية الملفات، لأن التطبيق يقارن
إصداره وبصماته عند الفحص. **لا تُدرج `platform-tools.json`** في بيان المحتوى.

## 3. التحقق قبل البناء

```powershell
npm run typecheck
npm test
npm audit
```

المتوقع: typecheck نظيف، كل الاختبارات ناجحة، و0 ثغرات. لا تبنِ إصداراً و
`npm audit` يعرض ثغرة عالية أو حرجة.

## 4. بناء المثبّت

```powershell
npm run build:win
```

الناتج:

- `dist/DroidCrate-<version>-Setup.exe`
- `dist/latest.yml` (يستخدمه النشر)
- `dist/win-unpacked/` للاختبار المباشر

### اختبر الحزمة قبل النشر

```powershell
node scripts/verify-packaged.mjs
```

يجب أن يظهر `packaged: true`، والبيانات من `resources/data`، و`adb version`
ناجحاً. اختبر أيضاً شاشة أول تشغيل (يمكن مسح `droidcrate.welcome.v1` من
`localStorage` داخل أدوات التطوير) واللغة العربية.

### احسب البصمة

```powershell
(Get-FileHash .\dist\DroidCrate-<version>-Setup.exe -Algorithm SHA256).Hash
(Get-Item .\dist\DroidCrate-<version>-Setup.exe).Length
```

حدّث `README.md`، `docs/releases/<tag>.md`، وصفحة أسراب بالبصمة والحجم.

## 5. اكتب ملاحظات الإصدار

أنشئ `docs/releases/v<version>.md` بالعربية، ويشمل:

- ما الجديد.
- ما أُصلح.
- القيود المعروفة (التوقيع، x64، الشبكة...).
- البصمة والحجم.
- سياسة رفض تجاوز الأقفال (فقرة ثابتة).

## 6. انشر على GitHub Releases

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/publish-release.ps1 -Version 0.2.0 -Tag v0.2.0
```

السكربت:

- يقرأ التوكن من مدير اعتماد git دون طباعته.
- ينشئ الإصدار من ملف الملاحظات إن لم يكن موجوداً، أو يعيد استخدامه.
- يرفع المثبّت و`latest.yml` عبر `curl.exe` (لا يستخدم `Invoke-RestMethod`
  لأن PowerShell 5.1 يفسد JSON العربي).
- يتجاوز الأصول المرفوعة مسبقاً بأمان.

بعد النشر، تحقق من صفحة الإصدار ومن أن حجم الأصل المرفوع يطابق الملف المحلي:

```powershell
$r = Invoke-RestMethod -Uri 'https://api.github.com/repos/bouadjadjatamer2-hub/DroidCrate/releases/tags/v0.2.0' -Headers @{ 'User-Agent' = 'droidcrate' }
$r.assets | Select-Object name, size
```

## 7. حدّث موقع أسراب

1. انسخ لقطات جديدة إلى `docs/apps/droidcrate/` عند تغيّر الواجهة.
2. في `docs/assets/apps.js`، حدّث `version` و`size` لكائن `droidcrate`،
   و`window.ASRAAB_CATALOG.updated`.
3. في `docs/assets/config.js`، حدّث كائن `DROIDCRATE_CONFIG` فقط:
   - `version` و`releaseTagUrl` و`installerUrl` (اسم الملف يحمل الإصدار).
   - `installerName` و`installerSize` و`installerBytes`.
   - `sha256`، و`year` إن تغيّر.
   الصفحة والروابط والشارات وبصمة التذييل وبيان `SoftwareApplication` تُقرأ
   من هذا الكائن، فلا حاجة لتعديل `index.html` إلا إذا تغيّر النص أو التصميم.
4. في `docs/sitemap.xml`، حدّث `lastmod`.
5. شغّل خادماً محلياً وافتح الصفحة بالعربية والإنجليزية، داكن وفاتح، وتأكد من
   عدم وجود أخطاء console أو صور مفقودة، وأن بوابة الأوامر ما زالت ترفض
   الفلاش والصدفة الحرّة.
6. ارفع:

```powershell
git add -A
git commit -m "feat(site): publish DroidCrate <version>"
git push origin main
```

ثم تحقق من الرابط الحقيقي بعد دقيقة:

```powershell
(Invoke-WebRequest 'https://bouadjadjatamer2-hub.github.io/Majra-download-manager-/apps/droidcrate/' -UseBasicParsing).StatusCode
```

## 8. ارفع المستودع

```powershell
git add -A
git commit -m "release: DroidCrate <version>"
git push origin main
```

GitHub Actions/الصفحات ليست ضرورية للموقع لأنه يُنشر من مجلد `docs` مباشرة.

## 9. قائمة تحقق نهائية

- [ ] `npm run typecheck` نظيف.
- [ ] `npm test` كل الاختبارات ناجحة.
- [ ] `npm audit` بلا ثغرات عالية/حرجة.
- [ ] `data/content-manifest.json` محدّث إن تغيّر `data/`.
- [ ] المثبّت بُني واختُبر من `win-unpacked`.
- [ ] البصمة والحجم محدّثان في README وملاحظات الإصدار والموقع.
- [ ] GitHub Release يحمل المثبّت و`latest.yml` بالحجم الصحيح.
- [ ] صفحة أسراب تعمل بالعربية والإنجليزية، داكن وفاتح.
- [ ] روابط التنزيل والشيفرة والرخصة تعمل.
- [ ] `docs/FINAL-REPORT.md` محدّث إن تغيّر النطاق أو القيود.

## 10. التراجع (Rollback)

إذا ظهر عيب حرج بعد النشر:

1. لا تحذف الإصدار فوراً إن كان هناك مستخدمون؛ انشر إصداراً مصححاً `0.2.1`.
2. يمكن تعليم الإصدار السابق كـ `prerelease` أو إخفاؤه من واجهة GitHub، مع
   إبقاء الأصل للتنزيل المباشر.
3. أعد صفحة أسراب إلى الإصدار السابق: `version`، `size`، رابط التنزيل،
   البصمة، ثم ارفع.
4. لا تحذف `latest.yml` إن كنت ستستخدم التحديث التلقائي لاحقاً؛ أبقِه متوافقاً
   مع آخر إصدار مستقر.

## 11. ملاحظات تشغيلية

- **الشبكة إلى GitHub متقطعة أحياناً.** أعد المحاولة؛ سكربت النشر يعيد المحاولة
  4 مرات بفاصل 5 ثوان. إذا فشل الرفع، شغّل السكربت مجدداً وسيتجاوز الأصل
  الموجود.
- **لا تطبع التوكن.** لا تستخدم `Write-Host $token` ولا `curl -v`.
- **نسخ احتياطي لقاعدة المستخدم:** `%APPDATA%\droidcrate\droidcrate.db` مع
  `-wal` و`-shm` إن كانتا موجودتين. بدونها قد تفقد آخر التقدم.
- **تغيير نص التنبيه القانوني:** ارفع `WELCOME_NOTICE_VERSION` حتى يرى كل
  مستخدم الشاشة الجديدة، وأضف اختباراً إن تغيّر التحليل.
- **تغيير قائمة أوامر ADB/Fastboot:** راجع `src/shared/adb.ts` والاختبارات؛
  لا تُضف أمراً حراً أو أمر فلاش/محو/فتح.
