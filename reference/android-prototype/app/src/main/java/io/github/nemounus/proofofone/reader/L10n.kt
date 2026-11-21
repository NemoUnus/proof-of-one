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
        "doneProblems" to listOf("Done, with problems (see the report below).", "انجام شد، ولی با مشکل (گزارش پایین را ببینید).", "تم، مع مشكلات (انظر التقرير أدناه).", "Terminé, avec des problèmes (voir le rapport ci-dessous).", "Listo, con problemas (vea el informe abajo).", "Fertig, mit Problemen (siehe Bericht unten)."),
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
            "The selfie does not match the passport photo closely enough. Try again: face the camera, in good light, without glasses, hat or mask.",
            "سلفی به اندازه‌ی کافی با عکس پاسپورت جور نیست. دوباره امتحان کنید: رو به دوربین، در نور خوب، بدون عینک، کلاه یا ماسک.",
            "الصورة الذاتية لا تطابق صورة الجواز بما يكفي. حاول مرة أخرى: واجه الكاميرا، في إضاءة جيدة، دون نظارة أو قبعة أو كمامة.",
            "Le selfie ne correspond pas assez à la photo du passeport. Réessayez : face à l'appareil, sous une bonne lumière, sans lunettes, chapeau ni masque.",
            "El selfi no se parece lo suficiente a la foto del pasaporte. Inténtelo de nuevo: mirando a la cámara, con buena luz, sin gafas, gorra ni mascarilla.",
            "Das Selfie stimmt nicht genug mit dem Passfoto überein. Bitte erneut versuchen: in die Kamera blicken, bei gutem Licht, ohne Brille, Mütze oder Maske."),
        "faceNone" to listOf("No face found in the selfie. Try again, facing the camera in good light.", "در سلفی چهره‌ای پیدا نشد. دوباره امتحان کنید، رو به دوربین و در نور خوب.", "لم يُعثر على وجه في الصورة الذاتية. حاول مرة أخرى مواجهاً الكاميرا في إضاءة جيدة.", "Aucun visage trouvé sur le selfie. Réessayez, face à l'appareil, sous une bonne lumière.", "No se encontró ninguna cara en el selfi. Inténtelo de nuevo, mirando a la cámara con buena luz.", "Im Selfie wurde kein Gesicht gefunden. Erneut versuchen, in die Kamera blicken, bei gutem Licht."),
        "faceNoSelfie" to listOf("No selfie taken.", "سلفی گرفته نشد.", "لم تُلتقط صورة ذاتية.", "Aucun selfie pris.", "No se hizo ningún selfi.", "Kein Selfie aufgenommen."),
        "faceError" to listOf("The face check failed: %s", "بررسی چهره ناموفق بود: %s", "فشل التحقق من الوجه: %s", "La vérification du visage a échoué : %s", "La verificación de la cara falló: %s", "Die Gesichtsprüfung ist fehlgeschlagen: %s"),
        "faceFirst" to listOf("Do the face check (step 1) first.", "اول بررسی چهره (مرحله‌ی ۱) را انجام دهید.", "أجرِ التحقق من الوجه (الخطوة ١) أولاً.", "Faites d'abord la vérification du visage (étape 1).", "Primero haga la verificación de la cara (paso 1).", "Zuerst die Gesichtsprüfung (Schritt 1) durchführen."),
        "pwStep" to listOf("Step 2: password and enrolment", "مرحله‌ی ۲: رمز و ثبت‌نام", "الخطوة ٢: كلمة المرور والتسجيل", "Étape 2 : mot de passe et inscription", "Paso 2: contraseña e inscripción", "Schritt 2: Passwort und Registrierung"),
    )
}
