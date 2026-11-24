// SPDX-License-Identifier: Apache-2.0
// Proof of One — the app's texts in six languages (Decision #55: several languages released
// together, right-to-left scripts from the first version). The volunteer-facing screens
// (passport reading, face check, enrolment) are translated; the technical test screens and
// reports stay in English. Translations are drafts by the project's AI agents, not yet reviewed by
// native speakers (shown in the app).
package io.github.nemounus.proofofone.reader

import android.app.Activity
import android.content.Context
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Spinner

object L10n {
    /** Code and own name of each language, in the order shown. */
    val LANGS = listOf("en" to "English", "fa" to "فارسی", "ar" to "العربية", "fr" to "Français", "es" to "Español", "de" to "Deutsch")
    private val RTL = setOf("fa", "ar")
    var lang = "en"; private set

    fun load(c: Context) {
        lang = c.getSharedPreferences("prefs", Context.MODE_PRIVATE).getString("lang", null) ?: run {
            val sys = java.util.Locale.getDefault().language
            if (LANGS.any { it.first == sys }) sys else "en"
        }
    }
    val rtl get() = lang in RTL
    fun dir(v: View) { v.layoutDirection = if (rtl) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR }

    /** A language menu; choosing another language restarts the screen. */
    fun picker(a: Activity): Spinner = Spinner(a).apply {
        adapter = ArrayAdapter(a, android.R.layout.simple_spinner_dropdown_item, LANGS.map { it.second })
        setSelection(LANGS.indexOfFirst { it.first == lang }.coerceAtLeast(0))
        onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                val code = LANGS[pos].first
                if (code != lang) {
                    a.getSharedPreferences("prefs", Context.MODE_PRIVATE).edit().putString("lang", code).apply()
                    lang = code; a.recreate()
                }
            }
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }
    }

    /** The text for a key in the current language (English if missing). */
    fun t(key: String, vararg args: Any): String {
        val s = (T[key] ?: return key).let { it[LANGS.indexOfFirst { l -> l.first == lang }.coerceAtLeast(0)] }
        return if (args.isEmpty()) s else String.format(java.util.Locale.ROOT, s, *args)
    }

    // key → texts in the order of LANGS: en, fa, ar, fr, es, de
    private val T: Map<String, List<String>> = mapOf(
        "draft" to listOf(
            "",
            "ترجمه‌ها پیش‌نویس‌اند و هنوز بازبینی نشده‌اند.",
            "الترجمات مسودات لم تُراجع بعد.",
            "Les traductions sont des brouillons, pas encore relus.",
            "Las traducciones son borradores aún no revisados.",
            "Die Übersetzungen sind Entwürfe und noch nicht geprüft."),
        "title" to listOf("Proof of One (test)", "Proof of One (آزمایشی)", "Proof of One (تجريبي)", "Proof of One (test)", "Proof of One (prueba)", "Proof of One (Test)"),
        "intro" to listOf(
            "Enter three values from the bottom lines of the passport photo page. They are used only to open the chip and are cleared after reading.",
            "سه مقدار را از خط‌های پایین صفحه‌ی عکس‌دار پاسپورت وارد کنید. فقط برای باز کردن تراشه به کار می‌روند و بعد از خواندن پاک می‌شوند.",
            "أدخل ثلاث قيم من السطرين السفليين في صفحة الصورة بجواز السفر. تُستخدم فقط لفتح الشريحة وتُمحى بعد القراءة.",
            "Saisissez trois valeurs des lignes du bas de la page photo du passeport. Elles servent seulement à ouvrir la puce et sont effacées après la lecture.",
            "Introduzca tres datos de las líneas inferiores de la página con foto del pasaporte. Solo sirven para abrir el chip y se borran después de leerlo.",
            "Geben Sie drei Angaben aus den unteren Zeilen der Fotoseite des Passes ein. Sie dienen nur zum Öffnen des Chips und werden nach dem Lesen gelöscht."),
        "docNo" to listOf("Passport number", "شماره‌ی پاسپورت", "رقم جواز السفر", "Numéro du passeport", "Número de pasaporte", "Passnummer"),
        "docNoHint" to listOf("as printed", "همان‌طور که چاپ شده", "كما هو مطبوع", "tel qu'imprimé", "tal como está impreso", "wie gedruckt"),
        "birth" to listOf("Date of birth (YYMMDD)", "تاریخ تولد میلادی (YYMMDD)", "تاريخ الميلاد (YYMMDD)", "Date de naissance (AAMMJJ)", "Fecha de nacimiento (AAMMDD)", "Geburtsdatum (JJMMTT)"),
        "expiry" to listOf("Date of expiry (YYMMDD)", "تاریخ انقضای میلادی (YYMMDD)", "تاريخ الانتهاء (YYMMDD)", "Date d'expiration (AAMMJJ)", "Fecha de caducidad (AAMMDD)", "Ablaufdatum (JJMMTT)"),
        "dateHint" to listOf("for example 850412", "مثلاً 850412", "مثلاً 850412", "par exemple 850412", "por ejemplo 850412", "zum Beispiel 850412"),
        "ready" to listOf("Ready: hold the passport to the phone", "آماده: پاسپورت را به گوشی نزدیک کنید", "جاهز: قرّب جواز السفر من الهاتف", "Prêt : approchez le passeport du téléphone", "Listo: acerque el pasaporte al teléfono", "Bereit: Pass an das Telefon halten"),
        "noNfc" to listOf("This phone has no NFC reader.", "این گوشی NFC ندارد.", "هذا الهاتف لا يدعم NFC.", "Ce téléphone n'a pas de lecteur NFC.", "Este teléfono no tiene lector NFC.", "Dieses Telefon hat kein NFC."),
        "nfcOff" to listOf("NFC is off. Turn it on in the phone settings.", "NFC خاموش است. آن را در تنظیمات گوشی روشن کنید.", "NFC متوقف. فعّله من إعدادات الهاتف.", "Le NFC est désactivé. Activez-le dans les réglages.", "El NFC está apagado. Actívelo en los ajustes.", "NFC ist aus. Schalten Sie es in den Einstellungen ein."),
        "enterValues" to listOf("Enter the three values, then tap Ready.", "سه مقدار را وارد کنید و دکمه‌ی «آماده» را بزنید.", "أدخل القيم الثلاث ثم اضغط «جاهز».", "Saisissez les trois valeurs, puis touchez « Prêt ».", "Introduzca los tres datos y pulse «Listo».", "Drei Angaben eingeben, dann auf „Bereit“ tippen."),
        "checkValues" to listOf("Check the values: passport number, and both dates as six digits (YYMMDD).", "مقدارها را بررسی کنید: شماره‌ی پاسپورت، و هر دو تاریخ به شکل شش رقم (YYMMDD).", "تحقق من القيم: رقم الجواز، والتاريخان بستة أرقام (YYMMDD).", "Vérifiez : numéro du passeport, et les deux dates en six chiffres (AAMMJJ).", "Compruebe: número de pasaporte y ambas fechas con seis cifras (AAMMDD).", "Prüfen Sie: Passnummer und beide Daten sechsstellig (JJMMTT)."),
        "hold" to listOf("Hold the passport flat against the back of the phone and keep still…", "پاسپورت را صاف پشت گوشی نگه دارید و تکان ندهید…", "ضع الجواز مسطحاً على ظهر الهاتف ولا تحرّكه…", "Posez le passeport à plat contre le dos du téléphone et ne bougez plus…", "Apoye el pasaporte plano en la parte trasera del teléfono y no lo mueva…", "Pass flach an die Rückseite des Telefons halten und stillhalten…"),
        "enterFirst" to listOf("Enter the values and tap Ready first.", "اول مقدارها را وارد کنید و «آماده» را بزنید.", "أدخل القيم واضغط «جاهز» أولاً.", "Saisissez d'abord les valeurs et touchez « Prêt ».", "Primero introduzca los datos y pulse «Listo».", "Zuerst die Angaben eingeben und auf „Bereit“ tippen."),
        "notPassport" to listOf("This chip is not a passport chip.", "این تراشه، تراشه‌ی پاسپورت نیست.", "هذه الشريحة ليست شريحة جواز سفر.", "Cette puce n'est pas une puce de passeport.", "Este chip no es el de un pasaporte.", "Dieser Chip ist kein Passchip."),
        "reading" to listOf("Reading the chip… keep still (about 5–20 seconds).", "در حال خواندن تراشه… تکان ندهید (حدود ۵ تا ۲۰ ثانیه).", "جارٍ قراءة الشريحة… لا تتحرك (من 5 إلى 20 ثانية تقريباً).", "Lecture de la puce… ne bougez pas (5 à 20 secondes environ).", "Leyendo el chip… no lo mueva (unos 5 a 20 segundos).", "Chip wird gelesen… stillhalten (etwa 5–20 Sekunden)."),
        "readFailed" to listOf("Reading failed. Check the three values and try again, holding the passport still.", "خواندن ناموفق بود. سه مقدار را بررسی کنید و دوباره امتحان کنید؛ پاسپورت را ثابت نگه دارید.", "فشلت القراءة. تحقق من القيم الثلاث وأعد المحاولة مع تثبيت الجواز.", "La lecture a échoué. Vérifiez les trois valeurs et réessayez sans bouger le passeport.", "La lectura falló. Compruebe los tres datos y vuelva a intentarlo sin mover el pasaporte.", "Lesen fehlgeschlagen. Angaben prüfen und erneut versuchen, den Pass stillhalten."),
        "doneOk" to listOf("Done: the passport chip is genuine.", "انجام شد: تراشه‌ی پاسپورت اصل است.", "تم: شريحة الجواز أصلية.", "Terminé : la puce du passeport est authentique.", "Listo: el chip del pasaporte es auténtico.", "Fertig: Der Passchip ist echt."),
        "doneProblems" to listOf(
            "The passport chip could not be confirmed as genuine (see the report below). This passport cannot be used for enrolment.",
            "اصل بودن تراشه‌ی پاسپورت تأیید نشد (گزارش پایین را ببینید). با این پاسپورت نمی‌توان ثبت‌نام کرد.",
            "تعذّر التأكد من أصالة شريحة الجواز (انظر التقرير أدناه). لا يمكن التسجيل بهذا الجواز.",
            "L'authenticité de la puce du passeport n'a pas pu être confirmée (voir le rapport ci-dessous). Ce passeport ne peut pas servir à l'inscription.",
            "No se pudo confirmar que el chip del pasaporte sea auténtico (vea el informe abajo). Este pasaporte no puede usarse para la inscripción.",
            "Die Echtheit des Pass-Chips konnte nicht bestätigt werden (siehe Bericht unten). Mit diesem Pass ist keine Registrierung möglich."),
        "shareReport" to listOf("Share report and signer certificate", "فرستادن گزارش و گواهی امضاکننده", "مشاركة التقرير وشهادة الموقِّع", "Partager le rapport et le certificat du signataire", "Compartir el informe y el certificado del firmante", "Bericht und Unterzeichnerzertifikat teilen"),
        "enrolBtn" to listOf("Enrol (sends the proof)", "ثبت‌نام (اثبات فرستاده می‌شود)", "التسجيل (يُرسَل الإثبات)", "S'inscrire (envoie la preuve)", "Inscribirse (envía la prueba)", "Registrieren (sendet den Nachweis)"),
        "yourNumber" to listOf("Your member number", "شماره‌ی عضویت شما", "رقم عضويتك", "Votre numéro de membre", "Su número de miembro", "Ihre Mitgliedsnummer"),
        "numberPrivate" to listOf(
            "Keep it private: do not post or share it. The same passport always gives the same number, on any phone.",
            "آن را خصوصی نگه دارید و جایی منتشر نکنید. یک پاسپورت روی هر گوشی همیشه همین شماره را می‌دهد.",
            "احتفظ به سرّاً ولا تنشره. الجواز نفسه يعطي الرقم نفسه دائماً، على أي هاتف.",
            "Gardez-le pour vous : ne le publiez pas. Le même passeport donne toujours le même numéro, sur n'importe quel téléphone.",
            "Manténgalo en privado: no lo publique. El mismo pasaporte da siempre el mismo número, en cualquier teléfono.",
            "Halten Sie sie geheim und veröffentlichen Sie sie nicht. Derselbe Pass ergibt auf jedem Telefon immer dieselbe Nummer."),
        "testTools" to listOf("Test tools (English)", "ابزارهای آزمایشی (انگلیسی)", "أدوات الاختبار (بالإنجليزية)", "Outils de test (en anglais)", "Herramientas de prueba (en inglés)", "Testwerkzeuge (Englisch)"),
        // enrolment screen
        "enrolTitle" to listOf("Enrol", "ثبت‌نام", "التسجيل", "Inscription", "Inscripción", "Registrierung"),
        "enrolIntro" to listOf(
            "This enrols your passport with the pilot (test network, test keys). Sent: the passport signer's public certificate, the issuing country, two scrambled values, and a proof with your birth date, sex, nationality and expiry month. Never sent: your photo, name, passport number or national number.\n\nA passport can be enrolled once. Use a VPN if the service is blocked where you are. Keep the screen on (one to three minutes).",
            "با این کار پاسپورت شما در آزمایش ثبت می‌شود (شبکه‌ی آزمایشی، کلیدهای آزمایشی). آنچه فرستاده می‌شود: گواهی عمومی امضاکننده‌ی پاسپورت، کشور صادرکننده، دو مقدار درهم‌شده، و یک اثبات که تاریخ تولد، جنسیت، ملیت و ماه انقضا را در بر دارد. آنچه هرگز فرستاده نمی‌شود: عکس، نام، شماره‌ی پاسپورت و شماره‌ی ملی شما.\n\nهر پاسپورت فقط یک بار ثبت می‌شود. اگر سرویس جایی که هستید مسدود است، از VPN استفاده کنید. صفحه را روشن نگه دارید (یک تا سه دقیقه).",
            "يسجّل هذا جوازك في التجربة (شبكة تجريبية، مفاتيح تجريبية). يُرسَل: شهادة الموقِّع العامة، وبلد الإصدار، وقيمتان مموّهتان، وإثبات يتضمن تاريخ الميلاد والجنس والجنسية وشهر الانتهاء. لا يُرسَل أبداً: صورتك واسمك ورقم جوازك ورقمك الوطني.\n\nيُسجَّل الجواز مرة واحدة فقط. استخدم VPN إذا كانت الخدمة محجوبة لديك. أبقِ الشاشة مضاءة (من دقيقة إلى ثلاث).",
            "Ceci inscrit votre passeport dans le pilote (réseau de test, clés de test). Envoyé : le certificat public du signataire, le pays émetteur, deux valeurs brouillées, et une preuve contenant date de naissance, sexe, nationalité et mois d'expiration. Jamais envoyé : votre photo, nom, numéro de passeport ou numéro national.\n\nUn passeport ne s'inscrit qu'une fois. Utilisez un VPN si le service est bloqué chez vous. Gardez l'écran allumé (une à trois minutes).",
            "Esto inscribe su pasaporte en el piloto (red de prueba, claves de prueba). Se envía: el certificado público del firmante, el país emisor, dos valores ocultos y una prueba con fecha de nacimiento, sexo, nacionalidad y mes de caducidad. Nunca se envía: su foto, nombre, número de pasaporte ni número nacional.\n\nUn pasaporte se inscribe una sola vez. Use una VPN si el servicio está bloqueado donde está. Mantenga la pantalla encendida (de uno a tres minutos).",
            "Damit wird Ihr Pass im Pilotversuch registriert (Testnetz, Testschlüssel). Gesendet werden: das öffentliche Zertifikat des Unterzeichners, das Ausstellungsland, zwei verschleierte Werte und ein Nachweis mit Geburtsdatum, Geschlecht, Staatsangehörigkeit und Ablaufmonat. Nie gesendet: Ihr Foto, Name, Pass- oder Personennummer.\n\nEin Pass kann nur einmal registriert werden. Nutzen Sie ein VPN, falls der Dienst bei Ihnen gesperrt ist. Bildschirm eingeschaltet lassen (ein bis drei Minuten)."),
        "pwLabel" to listOf(
            "Choose a password (at least 8 characters). With your passport, it moves your membership to a new phone. Nobody can recover it for you.",
            "یک رمز انتخاب کنید (دست‌کم ۸ حرف). با این رمز و پاسپورتتان می‌توانید عضویتتان را به گوشی تازه منتقل کنید. هیچ‌کس نمی‌تواند آن را برایتان بازیابی کند.",
            "اختر كلمة مرور (8 أحرف على الأقل). بها وبجوازك تنقل عضويتك إلى هاتف جديد. لا يمكن لأحد استعادتها لك.",
            "Choisissez un mot de passe (au moins 8 caractères). Avec votre passeport, il transfère votre adhésion vers un nouveau téléphone. Personne ne peut le retrouver pour vous.",
            "Elija una contraseña (al menos 8 caracteres). Con su pasaporte, traslada su membresía a un teléfono nuevo. Nadie puede recuperarla por usted.",
            "Wählen Sie ein Passwort (mindestens 8 Zeichen). Zusammen mit dem Pass überträgt es Ihre Mitgliedschaft auf ein neues Telefon. Niemand kann es für Sie wiederherstellen."),
        "pw1" to listOf("Password", "رمز", "كلمة المرور", "Mot de passe", "Contraseña", "Passwort"),
        "pw2" to listOf("Password again", "تکرار رمز", "أعد كلمة المرور", "Répétez le mot de passe", "Repita la contraseña", "Passwort wiederholen"),
        "pwShort" to listOf("The password must have at least 8 characters.", "رمز باید دست‌کم ۸ حرف باشد.", "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.", "Le mot de passe doit avoir au moins 8 caractères.", "La contraseña debe tener al menos 8 caracteres.", "Das Passwort muss mindestens 8 Zeichen haben."),
        "pwDiffer" to listOf("The two passwords differ.", "دو رمز با هم یکی نیستند.", "كلمتا المرور مختلفتان.", "Les deux mots de passe diffèrent.", "Las dos contraseñas no coinciden.", "Die beiden Passwörter sind verschieden."),
        "enrol" to listOf("Enrol", "ثبت‌نام", "سجّل", "S'inscrire", "Inscribirse", "Registrieren"),
        "alreadyHere" to listOf("This phone already holds your membership.", "عضویت شما از قبل روی این گوشی است.", "عضويتك محفوظة على هذا الهاتف بالفعل.", "Ce téléphone contient déjà votre adhésion.", "Este teléfono ya contiene su membresía.", "Dieses Telefon enthält Ihre Mitgliedschaft bereits."),
        "readFirst" to listOf("Read a passport first.", "اول پاسپورت را بخوانید.", "اقرأ جوازاً أولاً.", "Lisez d'abord un passeport.", "Primero lea un pasaporte.", "Zuerst einen Pass lesen."),
        "noCert" to listOf("The chip's signer certificate was not read. Read the passport again.", "گواهی امضاکننده‌ی تراشه خوانده نشد. پاسپورت را دوباره بخوانید.", "لم تُقرأ شهادة موقِّع الشريحة. اقرأ الجواز مرة أخرى.", "Le certificat du signataire n'a pas été lu. Relisez le passeport.", "No se leyó el certificado del firmante. Vuelva a leer el pasaporte.", "Das Unterzeichnerzertifikat wurde nicht gelesen. Pass erneut lesen."),
        "sFiles" to listOf("Preparing (first time only)…", "در حال آماده‌سازی (فقط بار اول)…", "جارٍ التحضير (المرة الأولى فقط)…", "Préparation (la première fois seulement)…", "Preparando (solo la primera vez)…", "Vorbereitung (nur beim ersten Mal)…"),
        "sService" to listOf("Contacting the service…", "در حال تماس با سرویس…", "جارٍ الاتصال بالخدمة…", "Connexion au service…", "Contactando con el servicio…", "Verbindung zum Dienst…"),
        "sSigner" to listOf("Checking the passport's issuer…", "در حال بررسی صادرکننده‌ی پاسپورت…", "جارٍ التحقق من جهة إصدار الجواز…", "Vérification de l'émetteur du passeport…", "Comprobando el emisor del pasaporte…", "Aussteller des Passes wird geprüft…"),
        "sKeys" to listOf("Computing your fingerprints with the service…", "در حال محاسبه‌ی اثرانگشت‌ها با سرویس…", "جارٍ حساب البصمات مع الخدمة…", "Calcul de vos empreintes avec le service…", "Calculando sus huellas con el servicio…", "Fingerabdrücke werden mit dem Dienst berechnet…"),
        "sProof" to listOf("Making the proof… keep the screen on.", "در حال ساختن اثبات… صفحه را روشن نگه دارید.", "جارٍ إنشاء الإثبات… أبقِ الشاشة مضاءة.", "Création de la preuve… gardez l'écran allumé.", "Generando la prueba… mantenga la pantalla encendida.", "Nachweis wird erstellt… Bildschirm anlassen."),
        "sSend" to listOf("Sending the proof…", "در حال فرستادن اثبات…", "جارٍ إرسال الإثبات…", "Envoi de la preuve…", "Enviando la prueba…", "Nachweis wird gesendet…"),
        "sBackup" to listOf("Storing your encrypted backup…", "در حال ذخیره‌ی نسخه‌ی پشتیبان رمزگذاری‌شده…", "جارٍ حفظ النسخة الاحتياطية المشفّرة…", "Enregistrement de votre sauvegarde chiffrée…", "Guardando su copia de seguridad cifrada…", "Verschlüsselte Sicherung wird gespeichert…"),
        "enrolled" to listOf("Enrolled. Your membership is kept on this phone.", "ثبت‌نام انجام شد. عضویت شما روی این گوشی نگه داشته می‌شود.", "تم التسجيل. عضويتك محفوظة على هذا الهاتف.", "Inscription réussie. Votre adhésion est conservée sur ce téléphone.", "Inscripción completada. Su membresía se guarda en este teléfono.", "Registriert. Ihre Mitgliedschaft ist auf diesem Telefon gespeichert."),
        "noBackupStored" to listOf("Enrolled, but the backup could not be stored. Keep this phone safe.", "ثبت‌نام انجام شد، ولی نسخه‌ی پشتیبان ذخیره نشد. از این گوشی خوب مراقبت کنید.", "تم التسجيل، لكن تعذّر حفظ النسخة الاحتياطية. حافظ على هذا الهاتف.", "Inscrit, mais la sauvegarde n'a pas pu être enregistrée. Prenez soin de ce téléphone.", "Inscrito, pero no se pudo guardar la copia de seguridad. Cuide este teléfono.", "Registriert, aber die Sicherung konnte nicht gespeichert werden. Passen Sie gut auf dieses Telefon auf."),
        "already" to listOf("This passport is already enrolled. Each person enrols once.", "این پاسپورت قبلاً ثبت شده است. هر نفر فقط یک بار ثبت‌نام می‌کند.", "هذا الجواز مسجّل من قبل. يسجّل كل شخص مرة واحدة.", "Ce passeport est déjà inscrit. Chaque personne s'inscrit une seule fois.", "Este pasaporte ya está inscrito. Cada persona se inscribe una sola vez.", "Dieser Pass ist bereits registriert. Jede Person registriert sich nur einmal."),
        "restoreAsk" to listOf("To move your membership to this phone, enter the password you chose at enrolment and tap Restore.", "برای انتقال عضویت به این گوشی، رمزی را که هنگام ثبت‌نام انتخاب کردید وارد کنید و «بازگردانی» را بزنید.", "لنقل عضويتك إلى هذا الهاتف، أدخل كلمة المرور التي اخترتها عند التسجيل واضغط «استعادة».", "Pour transférer votre adhésion sur ce téléphone, saisissez le mot de passe choisi à l'inscription et touchez « Restaurer ».", "Para trasladar su membresía a este teléfono, introduzca la contraseña elegida al inscribirse y pulse «Restaurar».", "Um Ihre Mitgliedschaft auf dieses Telefon zu übertragen, das bei der Registrierung gewählte Passwort eingeben und auf „Wiederherstellen“ tippen."),
        "restore" to listOf("Restore", "بازگردانی", "استعادة", "Restaurer", "Restaurar", "Wiederherstellen"),
        "restored" to listOf("Restored. Your membership is now on this phone too.", "بازگردانی شد. عضویت شما حالا روی این گوشی هم هست.", "تمت الاستعادة. عضويتك الآن على هذا الهاتف أيضاً.", "Restauré. Votre adhésion est maintenant aussi sur ce téléphone.", "Restaurado. Su membresía ahora también está en este teléfono.", "Wiederhergestellt. Ihre Mitgliedschaft ist jetzt auch auf diesem Telefon."),
        "wrongPw" to listOf("Wrong password. Try again.", "رمز اشتباه است. دوباره امتحان کنید.", "كلمة المرور خاطئة. حاول مرة أخرى.", "Mot de passe incorrect. Réessayez.", "Contraseña incorrecta. Inténtelo de nuevo.", "Falsches Passwort. Bitte erneut versuchen."),
        "noBackup" to listOf("No backup is kept for this membership, so it cannot be moved. The recovery path (re-enrolment with a waiting period) will come later.", "برای این عضویت نسخه‌ی پشتیبانی نگه داشته نشده، پس منتقل نمی‌شود. مسیر بازیابی (ثبت‌نام دوباره با دوره‌ی انتظار) بعداً اضافه می‌شود.", "لا توجد نسخة احتياطية لهذه العضوية، لذا لا يمكن نقلها. سيُضاف مسار الاسترداد (إعادة التسجيل مع فترة انتظار) لاحقاً.", "Aucune sauvegarde n'existe pour cette adhésion, elle ne peut donc pas être transférée. La récupération (réinscription avec délai d'attente) viendra plus tard.", "No hay copia de seguridad de esta membresía, así que no puede trasladarse. La recuperación (nueva inscripción con periodo de espera) llegará más adelante.", "Für diese Mitgliedschaft gibt es keine Sicherung, daher kann sie nicht übertragen werden. Die Wiederherstellung (Neuregistrierung mit Wartezeit) folgt später."),
        "refused" to listOf("The service refused: %s", "سرویس نپذیرفت: %s", "رفضت الخدمة: %s", "Le service a refusé : %s", "El servicio rechazó: %s", "Der Dienst hat abgelehnt: %s"),
        "error" to listOf("Error at step '%s': %s", "خطا در مرحله‌ی «%s»: %s", "خطأ في المرحلة «%s»: %s", "Erreur à l'étape « %s » : %s", "Error en el paso «%s»: %s", "Fehler im Schritt „%s“: %s"),
        "shareResult" to listOf("Share the result (no personal data)", "فرستادن نتیجه (بدون اطلاعات شخصی)", "مشاركة النتيجة (بلا بيانات شخصية)", "Partager le résultat (sans données personnelles)", "Compartir el resultado (sin datos personales)", "Ergebnis teilen (ohne persönliche Daten)"),
        // face check before enrolment (v0.10, Decision #57 (3))
        "faceStep" to listOf("Step 1: your face", "مرحله‌ی ۱: چهره‌ی شما", "الخطوة ١: وجهك", "Étape 1 : votre visage", "Paso 1: su cara", "Schritt 1: Ihr Gesicht"),
        "faceIntro" to listOf(
            "Take a selfie. The phone compares it with the photo in the passport chip, on this phone only. The selfie is deleted at once; no picture or face data is sent.",
            "یک عکس سلفی بگیرید. گوشی آن را با عکس داخل تراشه‌ی پاسپورت مقایسه می‌کند، فقط روی همین گوشی. سلفی بلافاصله پاک می‌شود و هیچ عکس یا داده‌ی چهره‌ای فرستاده نمی‌شود.",
            "التقط صورة ذاتية. يقارنها الهاتف بالصورة الموجودة في شريحة الجواز، على هذا الهاتف فقط. تُحذف الصورة الذاتية فوراً، ولا تُرسَل أي صورة أو بيانات للوجه.",
            "Prenez un selfie. Le téléphone le compare avec la photo de la puce du passeport, sur ce téléphone uniquement. Le selfie est effacé aussitôt ; aucune image ni donnée du visage n'est envoyée.",
            "Hágase un selfi. El teléfono lo compara con la foto del chip del pasaporte, solo en este teléfono. El selfi se borra enseguida; no se envía ninguna imagen ni dato de la cara.",
            "Machen Sie ein Selfie. Das Telefon vergleicht es mit dem Foto im Chip des Passes, nur auf diesem Telefon. Das Selfie wird sofort gelöscht; kein Bild und keine Gesichtsdaten werden gesendet."),
        "takeSelfie" to listOf("Take a selfie", "گرفتن سلفی", "التقاط صورة ذاتية", "Prendre un selfie", "Hacerse un selfi", "Selfie aufnehmen"),
        "facePrep" to listOf("Preparing the passport photo…", "در حال آماده‌سازی عکس پاسپورت…", "جارٍ تحضير صورة الجواز…", "Préparation de la photo du passeport…", "Preparando la foto del pasaporte…", "Passfoto wird vorbereitet…"),
        "faceReady" to listOf(
            "Ready. Take a selfie facing the camera, in good light, without glasses or a mask.",
            "آماده است. رو به دوربین، در نور خوب و بدون عینک یا ماسک، سلفی بگیرید.",
            "جاهز. التقط صورة ذاتية مواجهاً الكاميرا، في إضاءة جيدة، دون نظارة أو كمامة.",
            "Prêt. Prenez un selfie face à l'appareil, sous une bonne lumière, sans lunettes ni masque.",
            "Listo. Hágase un selfi mirando a la cámara, con buena luz, sin gafas ni mascarilla.",
            "Bereit. Machen Sie ein Selfie mit Blick in die Kamera, bei gutem Licht, ohne Brille oder Maske."),
        "faceNoPhoto" to listOf("The passport photo was not read. Read the passport again.", "عکس پاسپورت خوانده نشد. پاسپورت را دوباره بخوانید.", "لم تُقرأ صورة الجواز. اقرأ الجواز مرة أخرى.", "La photo du passeport n'a pas été lue. Relisez le passeport.", "No se leyó la foto del pasaporte. Vuelva a leer el pasaporte.", "Das Passfoto wurde nicht gelesen. Pass erneut lesen."),
        "faceNoChipFace" to listOf(
            "No face was found in the passport photo, so enrolment cannot continue. Please tell the organiser.",
            "در عکس پاسپورت چهره‌ای پیدا نشد، پس ثبت‌نام ادامه پیدا نمی‌کند. لطفاً به هماهنگ‌کننده خبر دهید.",
            "لم يُعثر على وجه في صورة الجواز، لذا لا يمكن متابعة التسجيل. يُرجى إبلاغ المنظِّم.",
            "Aucun visage n'a été trouvé sur la photo du passeport ; l'inscription ne peut pas continuer. Prévenez l'organisateur.",
            "No se encontró ninguna cara en la foto del pasaporte, así que la inscripción no puede continuar. Avise al organizador.",
            "Im Passfoto wurde kein Gesicht gefunden, daher kann die Registrierung nicht fortgesetzt werden. Bitte den Organisator informieren."),
        "faceComparing" to listOf("Comparing…", "در حال مقایسه…", "جارٍ المقارنة…", "Comparaison…", "Comparando…", "Wird verglichen…"),
        "facePass" to listOf("Face check passed.", "بررسی چهره انجام شد و تأیید شد.", "تم التحقق من الوجه بنجاح.", "Vérification du visage réussie.", "Verificación de la cara superada.", "Gesichtsprüfung bestanden."),
        "faceFail" to listOf(
            "Your face does not match the photo in the passport. Try again: face the camera, in good light, without glasses, hat or mask. Only the passport's holder can enrol with it.",
            "چهره‌ی شما با عکس پاسپورت تطابق ندارد. دوباره امتحان کنید: رو به دوربین، در نور خوب، بدون عینک، کلاه یا ماسک. فقط صاحب پاسپورت می‌تواند با آن ثبت‌نام کند.",
            "وجهك لا يطابق الصورة في الجواز. حاول مرة أخرى: واجه الكاميرا، في إضاءة جيدة، دون نظارة أو قبعة أو كمامة. لا يمكن التسجيل بالجواز إلا لصاحبه.",
            "Votre visage ne correspond pas à la photo du passeport. Réessayez : face à l'appareil, sous une bonne lumière, sans lunettes, chapeau ni masque. Seul le titulaire du passeport peut s'inscrire avec.",
            "Su cara no coincide con la foto del pasaporte. Inténtelo de nuevo: mirando a la cámara, con buena luz, sin gafas, gorra ni mascarilla. Solo el titular del pasaporte puede inscribirse con él.",
            "Ihr Gesicht stimmt nicht mit dem Foto im Pass überein. Bitte erneut versuchen: in die Kamera blicken, bei gutem Licht, ohne Brille, Mütze oder Maske. Nur der Inhaber des Passes kann sich damit registrieren."),
        "faceNone" to listOf("No face found in the selfie. Try again, facing the camera in good light.", "در سلفی چهره‌ای پیدا نشد. دوباره امتحان کنید، رو به دوربین و در نور خوب.", "لم يُعثر على وجه في الصورة الذاتية. حاول مرة أخرى مواجهاً الكاميرا في إضاءة جيدة.", "Aucun visage trouvé sur le selfie. Réessayez, face à l'appareil, sous une bonne lumière.", "No se encontró ninguna cara en el selfi. Inténtelo de nuevo, mirando a la cámara con buena luz.", "Im Selfie wurde kein Gesicht gefunden. Erneut versuchen, in die Kamera blicken, bei gutem Licht."),
        "faceNoSelfie" to listOf("No selfie taken.", "سلفی گرفته نشد.", "لم تُلتقط صورة ذاتية.", "Aucun selfie pris.", "No se hizo ningún selfi.", "Kein Selfie aufgenommen."),
        "faceError" to listOf("The face check failed: %s", "بررسی چهره ناموفق بود: %s", "فشل التحقق من الوجه: %s", "La vérification du visage a échoué : %s", "La verificación de la cara falló: %s", "Die Gesichtsprüfung ist fehlgeschlagen: %s"),
        "faceFirst" to listOf("Do the face check (step 1) first.", "اول بررسی چهره (مرحله‌ی ۱) را انجام دهید.", "أجرِ التحقق من الوجه (الخطوة ١) أولاً.", "Faites d'abord la vérification du visage (étape 1).", "Primero haga la verificación de la cara (paso 1).", "Zuerst die Gesichtsprüfung (Schritt 1) durchführen."),
        "pwStep" to listOf("Step 2: password and enrolment", "مرحله‌ی ۲: رمز و ثبت‌نام", "الخطوة ٢: كلمة المرور والتسجيل", "Étape 2 : mot de passe et inscription", "Paso 2: contraseña e inscripción", "Schritt 2: Passwort und Registrierung"),
        // clear reasons for refusals (v0.10.1)
        "notGenuine" to listOf(
            "The passport chip was not confirmed as genuine, so this passport cannot be used for enrolment.",
            "اصل بودن تراشه‌ی این پاسپورت تأیید نشده، پس با آن نمی‌توان ثبت‌نام کرد.",
            "لم تُؤكَّد أصالة شريحة هذا الجواز، لذا لا يمكن التسجيل به.",
            "L'authenticité de la puce n'a pas été confirmée ; ce passeport ne peut pas servir à l'inscription.",
            "No se confirmó la autenticidad del chip, así que este pasaporte no puede usarse para la inscripción.",
            "Die Echtheit des Chips wurde nicht bestätigt, daher ist mit diesem Pass keine Registrierung möglich."),
        "expired" to listOf(
            "This passport has expired, so it cannot be used. Please enrol with a valid passport.",
            "این پاسپورت منقضی شده و اعتبار ندارد، پس با آن نمی‌توان ثبت‌نام کرد. لطفاً با یک پاسپورت معتبر ثبت‌نام کنید.",
            "انتهت صلاحية هذا الجواز، لذا لا يمكن استخدامه. يُرجى التسجيل بجواز ساري المفعول.",
            "Ce passeport a expiré et ne peut pas être utilisé. Inscrivez-vous avec un passeport valide.",
            "Este pasaporte ha caducado y no puede usarse. Inscríbase con un pasaporte vigente.",
            "Dieser Pass ist abgelaufen und kann nicht verwendet werden. Bitte mit einem gültigen Pass registrieren."),
        "unsupported" to listOf(
            "This passport's type of digital signature is not supported in the pilot yet, so it cannot be enrolled.",
            "نوع امضای دیجیتال این پاسپورت هنوز در آزمایش پشتیبانی نمی‌شود، پس فعلاً نمی‌توان با آن ثبت‌نام کرد.",
            "نوع التوقيع الرقمي لهذا الجواز غير مدعوم في التجربة بعد، لذا لا يمكن التسجيل به.",
            "Le type de signature numérique de ce passeport n'est pas encore pris en charge par le pilote ; il ne peut pas être inscrit.",
            "El tipo de firma digital de este pasaporte aún no se admite en el piloto, así que no puede inscribirse.",
            "Die Art der digitalen Signatur dieses Passes wird im Pilotversuch noch nicht unterstützt; er kann nicht registriert werden."),
        "notInPilot" to listOf(
            "Passports from this country are not part of the pilot yet.",
            "پاسپورت‌های این کشور هنوز در این آزمایش پذیرفته نمی‌شوند.",
            "جوازات هذا البلد ليست جزءاً من التجربة بعد.",
            "Les passeports de ce pays ne font pas encore partie du pilote.",
            "Los pasaportes de este país aún no forman parte del piloto.",
            "Pässe dieses Landes sind noch nicht Teil des Pilotversuchs."),
        "signerRefused" to listOf(
            "The authority that signed this passport could not be verified, so it cannot be used for enrolment. Please tell the organiser.",
            "مرجعی که این پاسپورت را امضا کرده تأیید نشد، پس با آن نمی‌توان ثبت‌نام کرد. لطفاً به هماهنگ‌کننده خبر دهید.",
            "تعذّر التحقق من الجهة التي وقّعت هذا الجواز، لذا لا يمكن التسجيل به. يُرجى إبلاغ المنظِّم.",
            "L'autorité qui a signé ce passeport n'a pas pu être vérifiée ; il ne peut pas servir à l'inscription. Prévenez l'organisateur.",
            "No se pudo verificar la autoridad que firmó este pasaporte, así que no puede usarse para la inscripción. Avise al organizador.",
            "Die Stelle, die diesen Pass signiert hat, konnte nicht überprüft werden; eine Registrierung ist nicht möglich. Bitte den Organisator informieren."),
        "busyToday" to listOf(
            "The pilot has reached its limit for today. Please try again tomorrow.",
            "ظرفیت امروز آزمایش پر شده است. لطفاً فردا دوباره امتحان کنید.",
            "بلغت التجربة حدّها لهذا اليوم. يُرجى المحاولة غداً.",
            "Le pilote a atteint sa limite pour aujourd'hui. Réessayez demain.",
            "El piloto ha alcanzado su límite de hoy. Inténtelo mañana.",
            "Der Pilotversuch hat sein Tageslimit erreicht. Bitte morgen erneut versuchen."),
        "sessionExpired" to listOf(
            "The process took too long and timed out. Tap Enrol again.",
            "کار بیش از حد طول کشید و مهلتش تمام شد. دوباره «ثبت‌نام» را بزنید.",
            "استغرقت العملية وقتاً طويلاً وانتهت مهلتها. اضغط «سجّل» مرة أخرى.",
            "L'opération a pris trop de temps et a expiré. Touchez de nouveau « S'inscrire ».",
            "El proceso tardó demasiado y caducó. Pulse «Inscribirse» de nuevo.",
            "Der Vorgang hat zu lange gedauert. Bitte erneut auf „Registrieren“ tippen."),
        "noService" to listOf(
            "The service could not be reached. Check the internet connection; if the service is blocked where you are, turn on a VPN. Then try again.",
            "به سرویس دسترسی پیدا نشد. اتصال اینترنت را بررسی کنید؛ اگر سرویس جایی که هستید مسدود است، VPN را روشن کنید. بعد دوباره امتحان کنید.",
            "تعذّر الوصول إلى الخدمة. تحقق من الاتصال بالإنترنت؛ وإن كانت الخدمة محجوبة لديك فشغّل VPN. ثم حاول مرة أخرى.",
            "Le service est injoignable. Vérifiez la connexion Internet ; si le service est bloqué chez vous, activez un VPN. Puis réessayez.",
            "No se pudo contactar con el servicio. Compruebe la conexión a Internet; si el servicio está bloqueado donde está, active una VPN. Luego inténtelo de nuevo.",
            "Der Dienst ist nicht erreichbar. Internetverbindung prüfen; ist der Dienst bei Ihnen gesperrt, ein VPN einschalten. Dann erneut versuchen."),
        "serviceBusy" to listOf(
            "The service could not finish the check right now. Please try again in a few minutes.",
            "سرویس الان نتوانست بررسی را تمام کند. لطفاً چند دقیقه‌ی دیگر دوباره امتحان کنید.",
            "لم تتمكن الخدمة من إتمام التحقق الآن. يُرجى المحاولة بعد بضع دقائق.",
            "Le service n'a pas pu terminer la vérification pour l'instant. Réessayez dans quelques minutes.",
            "El servicio no pudo terminar la comprobación ahora. Inténtelo de nuevo en unos minutos.",
            "Der Dienst konnte die Prüfung gerade nicht abschließen. Bitte in einigen Minuten erneut versuchen."),
        "proofFail" to listOf(
            "The proof could not be made on this phone. Please share the result with the organiser.",
            "اثبات روی این گوشی ساخته نشد. لطفاً نتیجه را برای هماهنگ‌کننده بفرستید.",
            "تعذّر إنشاء الإثبات على هذا الهاتف. يُرجى مشاركة النتيجة مع المنظِّم.",
            "La preuve n'a pas pu être créée sur ce téléphone. Partagez le résultat avec l'organisateur.",
            "No se pudo generar la prueba en este teléfono. Comparta el resultado con el organizador.",
            "Der Nachweis konnte auf diesem Telefon nicht erstellt werden. Bitte das Ergebnis an den Organisator senden."),
        // registration on the public ledger (v0.11, Decision #61; v0.12, Decision #62)
        "regWaiting" to listOf(
            "Registration on the public ledger: automatic in a few minutes (at %s). Keep the app open, or open it again later.",
            "ثبت روی دفتر کل عمومی: خودکار، چند دقیقه‌ی دیگر (ساعت %s). برنامه را باز نگه دارید یا بعداً دوباره بازش کنید.",
            "التسجيل في السجل العام: تلقائي خلال بضع دقائق (الساعة %s). أبقِ التطبيق مفتوحاً، أو افتحه مرة أخرى لاحقاً.",
            "Inscription au registre public : automatique dans quelques minutes (à %s). Gardez l'application ouverte, ou rouvrez-la plus tard.",
            "Registro en el libro público: automático en unos minutos (a las %s). Mantenga la aplicación abierta o vuelva a abrirla más tarde.",
            "Eintrag im öffentlichen Register: automatisch in wenigen Minuten (um %s). Lassen Sie die App geöffnet oder öffnen Sie sie später wieder."),
        "regRunning" to listOf(
            "Registering on the public ledger… (about a minute)",
            "در حال ثبت روی دفتر کل عمومی… (حدود یک دقیقه)",
            "جارٍ التسجيل في السجل العام… (نحو دقيقة)",
            "Inscription au registre public… (environ une minute)",
            "Registrando en el libro público… (alrededor de un minuto)",
            "Eintrag im öffentlichen Register läuft… (etwa eine Minute)"),
        "regDone" to listOf(
            "Registered on the public ledger. You can answer every open poll.",
            "روی دفتر کل عمومی ثبت شدید. می‌توانید به همه‌ی نظرسنجی‌های باز پاسخ دهید.",
            "تم تسجيلك في السجل العام. يمكنك الإجابة عن كل الاستطلاعات المفتوحة.",
            "Inscrit au registre public. Vous pouvez répondre à tous les sondages ouverts.",
            "Registrado en el libro público. Puede responder a todas las encuestas abiertas.",
            "Im öffentlichen Register eingetragen. Sie können alle offenen Umfragen beantworten."),
        "regNotReady" to listOf(
            "Registration on the public ledger is not open yet. The app will try again the next time you open it.",
            "ثبت روی دفتر کل عمومی هنوز باز نشده است. برنامه دفعه‌ی بعد که بازش کنید دوباره امتحان می‌کند.",
            "التسجيل في السجل العام غير متاح بعد. سيحاول التطبيق مرة أخرى عند فتحه في المرة القادمة.",
            "L'inscription au registre public n'est pas encore ouverte. L'application réessaiera à sa prochaine ouverture.",
            "El registro en el libro público aún no está abierto. La aplicación lo intentará de nuevo la próxima vez que la abra.",
            "Der Eintrag im öffentlichen Register ist noch nicht möglich. Die App versucht es beim nächsten Öffnen erneut."),
        "regOffline" to listOf(
            "Registration on the public ledger could not reach the network. Check the internet connection (or turn on a VPN); the app will try again the next time you open it.",
            "ثبت روی دفتر کل عمومی به شبکه دسترسی پیدا نکرد. اتصال اینترنت را بررسی کنید (یا VPN را روشن کنید)؛ برنامه دفعه‌ی بعد که بازش کنید دوباره امتحان می‌کند.",
            "تعذّر وصول التسجيل في السجل العام إلى الشبكة. تحقق من الاتصال بالإنترنت (أو شغّل VPN)؛ سيحاول التطبيق مرة أخرى عند فتحه في المرة القادمة.",
            "L'inscription au registre public n'a pas pu joindre le réseau. Vérifiez la connexion Internet (ou activez un VPN) ; l'application réessaiera à sa prochaine ouverture.",
            "El registro en el libro público no pudo conectar con la red. Compruebe la conexión a Internet (o active una VPN); la aplicación lo intentará de nuevo la próxima vez que la abra.",
            "Der Eintrag im öffentlichen Register konnte das Netz nicht erreichen. Internetverbindung prüfen (oder ein VPN einschalten); die App versucht es beim nächsten Öffnen erneut."),
        "regFailed" to listOf(
            "Registration on the public ledger failed: %s. The app will try again the next time you open it; please share the result with the organiser.",
            "ثبت روی دفتر کل عمومی ناموفق بود: %s. برنامه دفعه‌ی بعد که بازش کنید دوباره امتحان می‌کند؛ لطفاً نتیجه را برای هماهنگ‌کننده بفرستید.",
            "فشل التسجيل في السجل العام: %s. سيحاول التطبيق مرة أخرى عند فتحه في المرة القادمة؛ يُرجى مشاركة النتيجة مع المنظِّم.",
            "L'inscription au registre public a échoué : %s. L'application réessaiera à sa prochaine ouverture ; partagez le résultat avec l'organisateur.",
            "El registro en el libro público falló: %s. La aplicación lo intentará de nuevo la próxima vez que la abra; comparta el resultado con el organizador.",
            "Der Eintrag im öffentlichen Register ist fehlgeschlagen: %s. Die App versucht es beim nächsten Öffnen erneut; bitte das Ergebnis an den Organisator senden."),
        // the poll screen (v0.12, Decision #62)
        "regOld" to listOf(
            "This membership was made with an earlier test version and cannot take part in the new polls. Please read your passport again and enrol again when the organiser asks you to.",
            "این عضویت با نسخه‌ی آزمایشی قبلی ساخته شده و نمی‌تواند در نظرسنجی‌های جدید شرکت کند. لطفاً وقتی هماهنگ‌کننده خواست، دوباره پاسپورت را بخوانید و دوباره ثبت‌نام کنید.",
            "أُنشئت هذه العضوية بإصدار تجريبي سابق ولا يمكنها المشاركة في الاستطلاعات الجديدة. يُرجى قراءة جوازك مرة أخرى والتسجيل من جديد عندما يطلب المنظِّم ذلك.",
            "Cette adhésion a été créée avec une version d'essai antérieure et ne peut pas participer aux nouveaux sondages. Relisez votre passeport et inscrivez-vous à nouveau lorsque l'organisateur vous le demandera.",
            "Esta membresía se creó con una versión de prueba anterior y no puede participar en las nuevas encuestas. Vuelva a leer su pasaporte e inscríbase de nuevo cuando el organizador se lo pida.",
            "Diese Mitgliedschaft wurde mit einer früheren Testversion erstellt und kann an den neuen Umfragen nicht teilnehmen. Bitte lesen Sie Ihren Pass erneut und registrieren Sie sich neu, wenn der Organisator Sie darum bittet."),
        "pollsBtn" to listOf(
            "Polls",
            "نظرسنجی‌ها",
            "الاستطلاعات",
            "Sondages",
            "Encuestas",
            "Umfragen"),
        "voteTitle" to listOf(
            "Poll",
            "نظرسنجی",
            "استطلاع",
            "Sondage",
            "Encuesta",
            "Umfrage"),
        "voteLoading" to listOf(
            "Reading the poll from the public ledger…",
            "در حال خواندن نظرسنجی از دفتر کل عمومی…",
            "جارٍ قراءة الاستطلاع من السجل العام…",
            "Lecture du sondage dans le registre public…",
            "Leyendo la encuesta del libro público…",
            "Die Umfrage wird aus dem öffentlichen Register gelesen…"),
        "voteNotRegistered" to listOf(
            "Your membership is not registered on the public ledger yet. Go back and wait for the registration.",
            "عضویت شما هنوز روی دفتر کل عمومی ثبت نشده است. برگردید و منتظر ثبت بمانید.",
            "لم تُسجَّل عضويتك في السجل العام بعد. ارجع وانتظر التسجيل.",
            "Votre adhésion n'est pas encore inscrite au registre public. Revenez en arrière et attendez l'inscription.",
            "Su membresía aún no está registrada en el libro público. Vuelva atrás y espere al registro.",
            "Ihre Mitgliedschaft ist noch nicht im öffentlichen Register eingetragen. Gehen Sie zurück und warten Sie auf den Eintrag."),
        "voteNoPoll" to listOf(
            "There is no open poll at the moment.",
            "در حال حاضر نظرسنجی بازی وجود ندارد.",
            "لا يوجد استطلاع مفتوح حالياً.",
            "Il n'y a pas de sondage ouvert pour le moment.",
            "No hay ninguna encuesta abierta en este momento.",
            "Zurzeit ist keine Umfrage geöffnet."),
        "voteOption" to listOf(
            "Option",
            "گزینه",
            "خيار",
            "Option",
            "Opción",
            "Option"),
        "voteRecorded" to listOf(
            "Your recorded answer: %s. You may keep it (nothing to do) or choose another answer.",
            "پاسخ ثبت‌شده‌ی شما: %s. می‌توانید آن را نگه دارید (کاری لازم نیست) یا پاسخ دیگری انتخاب کنید.",
            "إجابتك المسجّلة: %s. يمكنك الإبقاء عليها (لا حاجة لفعل شيء) أو اختيار إجابة أخرى.",
            "Votre réponse enregistrée : %s. Vous pouvez la garder (rien à faire) ou choisir une autre réponse.",
            "Su respuesta registrada: %s. Puede mantenerla (no hay nada que hacer) o elegir otra respuesta.",
            "Ihre gespeicherte Antwort: %s. Sie können sie behalten (nichts zu tun) oder eine andere Antwort wählen."),
        "voteNone" to listOf(
            "You have not answered this poll yet.",
            "هنوز به این نظرسنجی پاسخ نداده‌اید.",
            "لم تُجب عن هذا الاستطلاع بعد.",
            "Vous n'avez pas encore répondu à ce sondage.",
            "Todavía no ha respondido a esta encuesta.",
            "Sie haben diese Umfrage noch nicht beantwortet."),
        "voteForeign" to listOf(
            "An answer is recorded for your membership that this phone cannot open (it was not made with your membership's secret on this phone). Please tell the organiser.",
            "برای عضویت شما پاسخی ثبت شده که این گوشی نمی‌تواند آن را باز کند (با رمز عضویت شما روی این گوشی ساخته نشده است). لطفاً به هماهنگ‌کننده خبر دهید.",
            "سُجّلت لعضويتك إجابة لا يستطيع هذا الهاتف فتحها (لم تُنشأ بسرّ عضويتك على هذا الهاتف). يُرجى إبلاغ المنظِّم.",
            "Une réponse est enregistrée pour votre adhésion que ce téléphone ne peut pas ouvrir (elle n'a pas été faite avec le secret de votre adhésion sur ce téléphone). Prévenez l'organisateur.",
            "Hay una respuesta registrada para su membresía que este teléfono no puede abrir (no se hizo con el secreto de su membresía en este teléfono). Avise al organizador.",
            "Für Ihre Mitgliedschaft ist eine Antwort gespeichert, die dieses Telefon nicht öffnen kann (sie wurde nicht mit dem Geheimnis Ihrer Mitgliedschaft auf diesem Telefon erstellt). Bitte informieren Sie den Organisator."),
        "voteClosed" to listOf(
            "This poll closed at %s. The result is published after the count.",
            "این نظرسنجی در %s بسته شد. نتیجه پس از شمارش منتشر می‌شود.",
            "أُغلق هذا الاستطلاع في %s. تُنشر النتيجة بعد الفرز.",
            "Ce sondage a fermé le %s. Le résultat est publié après le dépouillement.",
            "Esta encuesta se cerró el %s. El resultado se publica después del recuento.",
            "Diese Umfrage wurde am %s geschlossen. Das Ergebnis wird nach der Auszählung veröffentlicht."),
        "voteNotOpen" to listOf(
            "This poll opens at %s.",
            "این نظرسنجی در %s باز می‌شود.",
            "يُفتح هذا الاستطلاع في %s.",
            "Ce sondage ouvre le %s.",
            "Esta encuesta se abre el %s.",
            "Diese Umfrage öffnet am %s."),
        "voteClosesAt" to listOf(
            "Open until %s. You can change your answer until then.",
            "باز تا %s. تا آن وقت می‌توانید پاسخ‌تان را عوض کنید.",
            "مفتوح حتى %s. يمكنك تغيير إجابتك حتى ذلك الحين.",
            "Ouvert jusqu'au %s. Vous pouvez changer votre réponse jusque-là.",
            "Abierta hasta el %s. Puede cambiar su respuesta hasta entonces.",
            "Geöffnet bis %s. Bis dahin können Sie Ihre Antwort ändern."),
        "voteSend" to listOf(
            "Send my answer",
            "فرستادن پاسخ",
            "إرسال إجابتي",
            "Envoyer ma réponse",
            "Enviar mi respuesta",
            "Meine Antwort senden"),
        "voteChange" to listOf(
            "Change my answer",
            "عوض کردن پاسخ",
            "تغيير إجابتي",
            "Changer ma réponse",
            "Cambiar mi respuesta",
            "Meine Antwort ändern"),
        "voteChoose" to listOf(
            "Please choose an answer first.",
            "لطفاً اول یک پاسخ انتخاب کنید.",
            "يُرجى اختيار إجابة أولاً.",
            "Choisissez d'abord une réponse.",
            "Elija primero una respuesta.",
            "Bitte wählen Sie zuerst eine Antwort."),
        "voteSame" to listOf(
            "This is already your recorded answer: nothing to send.",
            "این همین حالا پاسخ ثبت‌شده‌ی شماست: چیزی برای فرستادن نیست.",
            "هذه إجابتك المسجّلة أصلاً: لا شيء للإرسال.",
            "C'est déjà votre réponse enregistrée : rien à envoyer.",
            "Esta ya es su respuesta registrada: no hay nada que enviar.",
            "Das ist bereits Ihre gespeicherte Antwort: nichts zu senden."),
        "voteProving" to listOf(
            "Locking your answer and making the proof on this phone… (a few seconds)",
            "در حال قفل کردن پاسخ و ساختن اثبات روی این گوشی… (چند ثانیه)",
            "جارٍ قفل إجابتك وإنشاء الإثبات على هذا الهاتف… (بضع ثوانٍ)",
            "Verrouillage de votre réponse et création de la preuve sur ce téléphone… (quelques secondes)",
            "Bloqueando su respuesta y generando la prueba en este teléfono… (unos segundos)",
            "Ihre Antwort wird verschlüsselt und der Nachweis auf diesem Telefon erstellt… (einige Sekunden)"),
        "voteLate" to listOf(
            "This membership was issued after the poll opened, so it cannot answer this poll; it can answer the polls opened after it.",
            "این عضویت پس از باز شدن نظرسنجی صادر شده و نمی‌تواند به این نظرسنجی پاسخ دهد؛ به نظرسنجی‌هایی که بعد از آن باز شوند می‌تواند پاسخ دهد.",
            "صدرت هذه العضوية بعد فتح الاستطلاع، فلا يمكنها الإجابة عنه؛ ويمكنها الإجابة عن الاستطلاعات التي تُفتح بعدها.",
            "Cette adhésion a été émise après l'ouverture du sondage : elle ne peut pas y répondre, mais elle peut répondre aux sondages ouverts après elle.",
            "Esta membresía se emitió después de abrirse la encuesta, así que no puede responderla; puede responder a las encuestas abiertas después.",
            "Diese Mitgliedschaft wurde nach dem Öffnen der Umfrage ausgestellt und kann sie nicht beantworten; sie kann die danach geöffneten Umfragen beantworten."),
        "voteNotEligible" to listOf(
            "This poll is for another group (age or document): your membership cannot answer it.",
            "این نظرسنجی برای گروه دیگری است (سن یا مدرک): عضویت شما نمی‌تواند به آن پاسخ دهد.",
            "هذا الاستطلاع لفئة أخرى (العمر أو الوثيقة): لا يمكن لعضويتك الإجابة عنه.",
            "Ce sondage s'adresse à un autre groupe (âge ou document) : votre adhésion ne peut pas y répondre.",
            "Esta encuesta es para otro grupo (edad o documento): su membresía no puede responderla.",
            "Diese Umfrage richtet sich an eine andere Gruppe (Alter oder Dokument): Ihre Mitgliedschaft kann sie nicht beantworten."),
        "voteSending" to listOf(
            "Sending the locked answer…",
            "در حال فرستادن پاسخ قفل‌شده…",
            "جارٍ إرسال الإجابة المقفلة…",
            "Envoi de la réponse verrouillée…",
            "Enviando la respuesta bloqueada…",
            "Die verschlüsselte Antwort wird gesendet…"),
        "voteConfirming" to listOf(
            "Sent. Waiting for the public ledger to record it… (up to a minute)",
            "فرستاده شد. در انتظار ثبت آن روی دفتر کل عمومی… (تا یک دقیقه)",
            "أُرسلت. بانتظار تسجيلها في السجل العام… (حتى دقيقة)",
            "Envoyée. En attente de son enregistrement dans le registre public… (jusqu'à une minute)",
            "Enviada. Esperando a que el libro público la registre… (hasta un minuto)",
            "Gesendet. Warten auf die Speicherung im öffentlichen Register… (bis zu einer Minute)"),
        "voteNotYet" to listOf(
            "Sent, but not recorded yet. Open this screen again in a few minutes to see your recorded answer.",
            "فرستاده شد ولی هنوز ثبت نشده است. چند دقیقه‌ی دیگر دوباره این صفحه را باز کنید تا پاسخ ثبت‌شده‌تان را ببینید.",
            "أُرسلت لكنها لم تُسجَّل بعد. افتح هذه الشاشة مرة أخرى بعد بضع دقائق لترى إجابتك المسجّلة.",
            "Envoyée, mais pas encore enregistrée. Rouvrez cet écran dans quelques minutes pour voir votre réponse enregistrée.",
            "Enviada, pero aún no registrada. Vuelva a abrir esta pantalla en unos minutos para ver su respuesta registrada.",
            "Gesendet, aber noch nicht gespeichert. Öffnen Sie diesen Bildschirm in einigen Minuten erneut, um Ihre gespeicherte Antwort zu sehen."),
        "voteDone" to listOf(
            "Recorded on the public ledger, locked: only the totals of all answers will ever be unlocked. The phone read it back and checked it.",
            "روی دفتر کل عمومی ثبت شد، قفل‌شده: فقط مجموع همه‌ی پاسخ‌ها باز می‌شود. گوشی آن را دوباره خواند و بررسی کرد.",
            "سُجّلت في السجل العام مقفلة: لن تُفتح إلا مجاميع كل الإجابات. قرأها الهاتف مرة أخرى وتحقق منها.",
            "Enregistrée dans le registre public, verrouillée : seuls les totaux de toutes les réponses seront déverrouillés. Le téléphone l'a relue et vérifiée.",
            "Registrada en el libro público, bloqueada: solo se desbloquearán los totales de todas las respuestas. El teléfono la volvió a leer y la comprobó.",
            "Im öffentlichen Register gespeichert, verschlüsselt: Nur die Summen aller Antworten werden je entschlüsselt. Das Telefon hat sie zurückgelesen und geprüft."),
        "voteOffline" to listOf(
            "Could not reach the network. Check the internet connection (or turn on a VPN) and open this screen again.",
            "به شبکه دسترسی نبود. اتصال اینترنت را بررسی کنید (یا VPN را روشن کنید) و این صفحه را دوباره باز کنید.",
            "تعذّر الوصول إلى الشبكة. تحقق من الاتصال بالإنترنت (أو شغّل VPN) وافتح هذه الشاشة مرة أخرى.",
            "Impossible de joindre le réseau. Vérifiez la connexion Internet (ou activez un VPN) et rouvrez cet écran.",
            "No se pudo conectar con la red. Compruebe la conexión a Internet (o active una VPN) y vuelva a abrir esta pantalla.",
            "Das Netz war nicht erreichbar. Internetverbindung prüfen (oder ein VPN einschalten) und diesen Bildschirm erneut öffnen."),
        "voteFailed" to listOf(
            "Something went wrong: %s. Please share the result with the organiser (it does not contain your answer).",
            "مشکلی پیش آمد: %s. لطفاً نتیجه را برای هماهنگ‌کننده بفرستید (پاسخ شما در آن نیست).",
            "حدث خطأ: %s. يُرجى مشاركة النتيجة مع المنظِّم (لا تحتوي على إجابتك).",
            "Un problème est survenu : %s. Partagez le résultat avec l'organisateur (il ne contient pas votre réponse).",
            "Algo salió mal: %s. Comparta el resultado con el organizador (no contiene su respuesta).",
            "Etwas ist schiefgegangen: %s. Bitte das Ergebnis an den Organisator senden (es enthält Ihre Antwort nicht)."),
        // the pilot's information and consent (v0.11.1, Decision #57 (4))
        "consentStep" to listOf(
            "Before you start: the pilot's information",
            "پیش از شروع: اطلاعات آزمایش",
            "قبل أن تبدأ: معلومات التجربة",
            "Avant de commencer : informations sur le pilote",
            "Antes de empezar: información del piloto",
            "Bevor Sie beginnen: Informationen zum Pilotversuch"),
        "consentSummary" to listOf(
            "Please read the full information text first (button below). In short:\n• The software has not been reviewed by independent experts and may contain mistakes.\n• Your passport data and your selfie never leave this phone; nothing that identifies you is published.\n• Do not talk about the pilot outside the group, do not take screenshots, and keep your member number private.\n• The enrolment service's data is deleted at the latest 30 days after the pilot's last poll closes.\n• You can stop at any time by removing the app.",
            "لطفاً اول متن کامل اطلاعات را بخوانید (دکمه‌ی زیر). به طور خلاصه:\n• نرم‌افزار هنوز توسط کارشناسان مستقل بازبینی نشده و ممکن است اشتباه داشته باشد.\n• داده‌های پاسپورت و سلفی شما هرگز از این گوشی بیرون نمی‌روند؛ هیچ چیزی که شما را بشناساند منتشر نمی‌شود.\n• بیرون از گروه درباره‌ی آزمایش صحبت نکنید، اسکرین‌شات نگیرید و شماره‌ی عضویت‌تان را خصوصی نگه دارید.\n• داده‌های سرویس ثبت‌نام حداکثر ۳۰ روز پس از بسته شدن آخرین نظرسنجی آزمایش پاک می‌شود.\n• هر وقت خواستید می‌توانید با پاک کردن برنامه کنار بکشید.",
            "يُرجى قراءة نص المعلومات كاملاً أولاً (الزر أدناه). باختصار:\n• لم يراجع خبراء مستقلون البرنامج بعد، وقد يحتوي على أخطاء.\n• بيانات جوازك وصورتك الذاتية لا تغادر هذا الهاتف أبداً؛ ولا يُنشر أي شيء يدل على هويتك.\n• لا تتحدث عن التجربة خارج المجموعة، ولا تلتقط صوراً للشاشة، واحتفظ برقم عضويتك لنفسك.\n• تُحذف بيانات خدمة التسجيل خلال 30 يوماً على الأكثر من إغلاق آخر استطلاع في التجربة.\n• يمكنك التوقف في أي وقت بحذف التطبيق.",
            "Lisez d'abord le texte d'information complet (bouton ci-dessous). En bref :\n• Le logiciel n'a pas encore été examiné par des experts indépendants et peut contenir des erreurs.\n• Les données de votre passeport et votre selfie ne quittent jamais ce téléphone ; rien qui vous identifie n'est publié.\n• Ne parlez pas du pilote en dehors du groupe, ne faites pas de captures d'écran et gardez votre numéro de membre pour vous.\n• Les données du service d'inscription sont effacées au plus tard 30 jours après la clôture du dernier sondage du pilote.\n• Vous pouvez arrêter à tout moment en supprimant l'application.",
            "Lea primero el texto informativo completo (botón de abajo). En resumen:\n• Ningún experto independiente ha revisado todavía el software, y puede contener errores.\n• Los datos de su pasaporte y su selfi nunca salen de este teléfono; no se publica nada que le identifique.\n• No hable del piloto fuera del grupo, no haga capturas de pantalla y guarde en privado su número de miembro.\n• Los datos del servicio de inscripción se borran a más tardar 30 días después de cerrarse la última encuesta del piloto.\n• Puede dejarlo en cualquier momento borrando la aplicación.",
            "Bitte lesen Sie zuerst den vollständigen Informationstext (Schaltfläche unten). Kurz gesagt:\n• Die Software wurde noch nicht von unabhängigen Fachleuten geprüft und kann Fehler enthalten.\n• Ihre Passdaten und Ihr Selfie verlassen dieses Telefon nie; nichts, was Sie identifiziert, wird veröffentlicht.\n• Sprechen Sie außerhalb der Gruppe nicht über den Pilotversuch, machen Sie keine Bildschirmfotos und behalten Sie Ihre Mitgliedsnummer für sich.\n• Die Daten des Registrierungsdienstes werden spätestens 30 Tage nach Ende der letzten Umfrage des Pilotversuchs gelöscht.\n• Sie können jederzeit aufhören, indem Sie die App löschen."),
        "consentRead" to listOf(
            "Read the full text",
            "خواندن متن کامل",
            "قراءة النص الكامل",
            "Lire le texte complet",
            "Leer el texto completo",
            "Vollständigen Text lesen"),
        "consentAgree" to listOf(
            "I am 18 or older, the passport is my own, and I have read and agree to the information text.",
            "۱۸ سال یا بیشتر دارم، پاسپورت مال خودم است، و متن اطلاعات را خوانده‌ام و با آن موافقم.",
            "عمري 18 عاماً أو أكثر، والجواز جوازي، وقد قرأت نص المعلومات وأوافق عليه.",
            "J'ai 18 ans ou plus, le passeport est le mien, et j'ai lu le texte d'information et l'accepte.",
            "Tengo 18 años o más, el pasaporte es mío, y he leído el texto informativo y estoy de acuerdo.",
            "Ich bin 18 Jahre oder älter, der Pass gehört mir, und ich habe den Informationstext gelesen und stimme zu."),
        "consentFirst" to listOf(
            "Please read the information and tick the box first.",
            "لطفاً اول اطلاعات را بخوانید و تیک موافقت را بزنید.",
            "يُرجى قراءة المعلومات ووضع علامة الموافقة أولاً.",
            "Lisez d'abord les informations et cochez la case.",
            "Lea primero la información y marque la casilla.",
            "Bitte zuerst die Informationen lesen und das Kästchen ankreuzen."),
    )
}
