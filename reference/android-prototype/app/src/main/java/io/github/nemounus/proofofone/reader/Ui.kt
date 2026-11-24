// SPDX-License-Identifier: Apache-2.0
// Proof of One — the app's look (v0.13; Decision #64, design by the Hokusai agent).
// One task per screen, a numbered progress bar for the six steps of joining, and a minimal
// look (the founder's choice): plain background, one accent colour (the logo's teal), no
// decoration, thin lines instead of boxes, the
// Vazirmatn typeface for Persian, Arabic and Latin (SIL Open Font License, assets/fonts; the
// phone's own font for Russian and Chinese),
// light and dark modes, large touch targets, right-to-left layout in Persian and Arabic.
// Plain Android views only, so that nothing is added to the app's dependencies.
package io.github.nemounus.proofofone.reader

import android.app.Activity
import android.content.Context
import android.content.res.Configuration
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.content.res.ColorStateList
import android.os.Build
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import kotlin.math.cos
import kotlin.math.sin

object Ui {
    // ---- colours (light, dark)
    class Palette(val bg: Int, val surface: Int, val text: Int, val muted: Int, val primary: Int, val onPrimary: Int,
                  val heading: Int, val accent: Int, val line: Int, val good: Int, val bad: Int, val soft: Int, val band: Int)
    private val LIGHT = Palette(bg = 0xFFFFFFFF.toInt(), surface = 0xFFFFFFFF.toInt(), text = 0xFF111827.toInt(), muted = 0xFF6B7280.toInt(),
        primary = 0xFF1F7F84.toInt(), onPrimary = 0xFFFFFFFF.toInt(), heading = 0xFF111827.toInt(), accent = 0xFFB45309.toInt(),
        line = 0xFFE5E7EB.toInt(), good = 0xFF15803D.toInt(), bad = 0xFFB91C1C.toInt(), soft = 0xFFF3F4F6.toInt(), band = 0xFFFFFFFF.toInt())
    private val DARK = Palette(bg = 0xFF0B0F14.toInt(), surface = 0xFF0B0F14.toInt(), text = 0xFFE5E7EB.toInt(), muted = 0xFF9CA3AF.toInt(),
        primary = 0xFF2DD4BF.toInt(), onPrimary = 0xFF042F2E.toInt(), heading = 0xFFF9FAFB.toInt(), accent = 0xFFFBBF24.toInt(),
        line = 0xFF1F2937.toInt(), good = 0xFF4ADE80.toInt(), bad = 0xFFF87171.toInt(), soft = 0xFF111827.toInt(), band = 0xFF0B0F14.toInt())
    fun c(ctx: Context): Palette =
        if ((ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES) DARK else LIGHT

    // ---- type
    private var regular: Typeface? = null
    private var bold: Typeface? = null
    fun font(ctx: Context, b: Boolean = false): Typeface {
        // Vazirmatn has no Cyrillic or Chinese letters: those languages use the phone's own font.
        if (L10n.lang == "ru" || L10n.lang == "zh") return if (b) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        if (regular == null) try {
            regular = Typeface.createFromAsset(ctx.assets, "fonts/Vazirmatn-Regular.ttf")
            bold = Typeface.createFromAsset(ctx.assets, "fonts/Vazirmatn-Bold.ttf")
        } catch (e: Exception) { regular = Typeface.DEFAULT; bold = Typeface.DEFAULT_BOLD }
        return (if (b) bold else regular)!!
    }
    fun dp(ctx: Context, v: Int) = (v * ctx.resources.displayMetrics.density).toInt()

    // ---- the page: title, step bar, scrolling content, a fixed area for the main button
    class Page(val root: View, val content: LinearLayout, val bottom: LinearLayout)

    /**
     * A screen. [step] is 1–6 for the steps of joining (0 for none). [onMenu], if given, adds a
     * "⋮" at the top for the tools and the language.
     */
    fun page(a: Activity, title: String, step: Int = 0, onMenu: (() -> Unit)? = null): Page {
        val p = c(a)
        a.window.statusBarColor = p.bg
        a.window.navigationBarColor = p.bg
        // dark status-bar icons on the light background
        @Suppress("DEPRECATION")
        if ((a.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) != Configuration.UI_MODE_NIGHT_YES)
            a.window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        val outer = LinearLayout(a).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(p.bg) }
        L10n.dir(outer)
        // header: the screen's title on the plain background, a thin line under it
        val header = LinearLayout(a).apply { orientation = LinearLayout.VERTICAL }
        val hrow = LinearLayout(a).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(dp(a, 20), dp(a, 14), dp(a, 8), dp(a, 14)) }
        hrow.addView(TextView(a).apply { text = title; textSize = 20f; typeface = font(a, true); setTextColor(p.heading) },
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        if (onMenu != null) hrow.addView(TextView(a).apply {
            text = "⋮"; textSize = 24f; setTextColor(p.muted); gravity = Gravity.CENTER
            minWidth = dp(a, 48); minHeight = dp(a, 48); contentDescription = L10n.t("menu")
            setOnClickListener { onMenu() }
        })
        header.addView(hrow)
        header.addView(View(a).apply { setBackgroundColor(p.line) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(a, 1)))
        outer.addView(header)
        if (step > 0) outer.addView(Steps(a, step), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(a, 78)))
        val content = LinearLayout(a).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(a, 20), dp(a, 16), dp(a, 20), dp(a, 16)) }
        val scroll = ScrollView(a).apply { addView(content); isFillViewport = true }
        outer.addView(scroll, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        val bottom = LinearLayout(a).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(a, 20), dp(a, 8), dp(a, 20), dp(a, 16)) }
        outer.addView(bottom)
        // Android 15 draws apps edge to edge: keep clear of the status and navigation bars and the keyboard.
        outer.setOnApplyWindowInsetsListener { v, insets ->
            if (Build.VERSION.SDK_INT >= 30) {
                val b = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.ime())
                v.setPadding(b.left, b.top, b.right, b.bottom)
            } else {
                @Suppress("DEPRECATION")
                v.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            }
            insets
        }
        a.setContentView(outer)
        return Page(outer, content, bottom)
    }

    // ---- building blocks
    fun heading(ctx: Context, s: String) = TextView(ctx).apply {
        text = s; textSize = 19f; typeface = font(ctx, true); setTextColor(c(ctx).heading); setPadding(0, dp(ctx, 4), 0, dp(ctx, 8))
    }
    fun body(ctx: Context, s: String) = TextView(ctx).apply {
        text = s; textSize = 16f; typeface = font(ctx); setTextColor(c(ctx).text); setLineSpacing(0f, 1.25f); setPadding(0, dp(ctx, 4), 0, dp(ctx, 4))
    }
    fun note(ctx: Context, s: String) = TextView(ctx).apply {
        text = s; textSize = 14f; typeface = font(ctx); setTextColor(c(ctx).muted); setLineSpacing(0f, 1.2f); setPadding(0, dp(ctx, 4), 0, dp(ctx, 4))
    }
    /** A status line; [kind] 0 neutral, 1 good, 2 problem. */
    fun status(ctx: Context) = TextView(ctx).apply {
        textSize = 16f; typeface = font(ctx); setTextColor(c(ctx).text); setLineSpacing(0f, 1.25f); setPadding(0, dp(ctx, 10), 0, dp(ctx, 4))
    }
    fun say(v: TextView, s: String, kind: Int = 0) {
        val p = c(v.context)
        v.text = s; v.setTextColor(when (kind) { 1 -> p.good; 2 -> p.bad; else -> p.text })
    }
    private fun rounded(color: Int, r: Float, stroke: Int = 0, strokeColor: Int = 0) = GradientDrawable().apply {
        setColor(color); cornerRadius = r; if (stroke > 0) setStroke(stroke, strokeColor)
    }
    /** The one main action of a screen. */
    fun primary(ctx: Context, s: String, click: () -> Unit) = Button(ctx).apply {
        val p = c(ctx)
        text = s; isAllCaps = false; textSize = 17f; typeface = font(ctx, true); setTextColor(p.onPrimary)
        minHeight = dp(ctx, 56); stateListAnimator = null
        background = RippleDrawable(ColorStateList.valueOf(0x33FFFFFF), rounded(p.primary, dp(ctx, 12).toFloat()), null)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(ctx, 8) }
        setOnClickListener { click() }
    }
    /** A secondary action: plain text in the accent colour. */
    fun secondary(ctx: Context, s: String, click: () -> Unit) = Button(ctx).apply {
        val p = c(ctx)
        text = s; isAllCaps = false; textSize = 16f; typeface = font(ctx); setTextColor(p.primary)
        minHeight = dp(ctx, 52); stateListAnimator = null
        background = RippleDrawable(ColorStateList.valueOf(0x221F7F84), null, rounded(Color.WHITE, dp(ctx, 12).toFloat()))
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(ctx, 8) }
        setOnClickListener { click() }
    }
    /** Disabled buttons look disabled. */
    fun enable(b: Button, on: Boolean) { b.isEnabled = on; b.alpha = if (on) 1f else 0.4f }

    /** A card: a rounded surface for a group of related things. */
    fun card(ctx: Context, tint: Boolean = false) = LinearLayout(ctx).apply {
        val p = c(ctx)
        orientation = LinearLayout.VERTICAL
        background = rounded(if (tint) p.soft else p.surface, dp(ctx, 12).toFloat(), if (tint) 0 else dp(ctx, 1), p.line)
        setPadding(dp(ctx, 16), dp(ctx, 14), dp(ctx, 16), dp(ctx, 14))
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(ctx, 10); bottomMargin = dp(ctx, 6) }
    }
    fun field(ctx: Context, label: String, hint: String, digits: Boolean = false, password: Boolean = false): Pair<LinearLayout, EditText> {
        val p = c(ctx)
        val box = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(ctx, 8), 0, 0) }
        box.addView(TextView(ctx).apply { text = label; textSize = 14f; typeface = font(ctx, true); setTextColor(p.muted) })
        val e = EditText(ctx).apply {
            this.hint = hint; textSize = 18f; typeface = font(ctx); setTextColor(p.text); setHintTextColor(p.muted)
            inputType = when {
                password -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                digits -> InputType.TYPE_CLASS_NUMBER
                else -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            }
            background = rounded(p.surface, dp(ctx, 12).toFloat(), dp(ctx, 1), p.line)
            setPadding(dp(ctx, 14), dp(ctx, 12), dp(ctx, 14), dp(ctx, 12))
            minHeight = dp(ctx, 52)
        }
        box.addView(e, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(ctx, 4) })
        return box to e
    }
    fun check(ctx: Context, s: String, on: (Boolean) -> Unit) = CheckBox(ctx).apply {
        val p = c(ctx)
        text = s; textSize = 16f; typeface = font(ctx); setTextColor(p.text); buttonTintList = ColorStateList.valueOf(p.primary)
        setPadding(dp(ctx, 8), dp(ctx, 8), dp(ctx, 8), dp(ctx, 8))
        setOnCheckedChangeListener { _, v -> on(v) }
    }
    /** A large symbol at the top of a screen (✓, a phone on a passport, …). */
    fun symbol(ctx: Context, s: String, color: Int) = TextView(ctx).apply {
        text = s; textSize = 44f; gravity = Gravity.CENTER; setTextColor(color); setPadding(0, dp(ctx, 8), 0, dp(ctx, 8))
    }
    /** Monospaced technical text (reports stay in English, left to right). */
    fun mono(ctx: Context) = TextView(ctx).apply {
        typeface = Typeface.MONOSPACE; textSize = 12f; setTextIsSelectable(true); setTextColor(c(ctx).muted); setPadding(0, dp(ctx, 8), 0, 0)
        layoutDirection = View.LAYOUT_DIRECTION_LTR; textDirection = View.TEXT_DIRECTION_LTR
    }
    fun px(ctx: Context, sp: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sp, ctx.resources.displayMetrics)

    // ---- the six steps of joining, numbered
    private val STEP_KEYS = listOf("st1", "st2", "st3", "st4", "st5", "st6")

    /** Circles 1–6 with short labels: done ones ticked, the current one filled, the rest outlined. */
    class Steps(ctx: Context, private val current: Int) : View(ctx) {
        private val p = c(ctx)
        private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
        private val txt = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; typeface = font(ctx, true) }
        private val lbl = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; typeface = font(ctx) }
        init {
            setBackgroundColor(p.bg)
            contentDescription = L10n.t("stepOf", current, 6) + ": " + L10n.t(STEP_KEYS[current - 1])
        }
        override fun onDraw(cv: Canvas) {
            val n = 6
            val w = width.toFloat(); val r = dp(context, 13).toFloat()
            val cy = dp(context, 26).toFloat()
            val rtl = layoutDirection == View.LAYOUT_DIRECTION_RTL
            val slot = w / n
            fun x(i: Int) = if (rtl) w - slot * (i + 0.5f) else slot * (i + 0.5f)
            fill.strokeWidth = dp(context, 2).toFloat()
            for (i in 0 until n - 1) {   // connecting lines
                fill.color = if (i + 1 < current) p.primary else p.line; fill.style = Paint.Style.STROKE
                cv.drawLine(x(i), cy, x(i + 1), cy, fill)
            }
            txt.textSize = px(context, 13f); lbl.textSize = px(context, 11f)
            for (i in 0 until n) {
                val k = i + 1; val cx = x(i)
                when {
                    k < current -> { fill.style = Paint.Style.FILL; fill.color = p.primary; cv.drawCircle(cx, cy, r, fill); tick(cv, cx, cy, r) }
                    k == current -> { fill.style = Paint.Style.FILL; fill.color = p.bg; cv.drawCircle(cx, cy, r, fill)
                        fill.style = Paint.Style.STROKE; fill.color = p.primary; fill.strokeWidth = dp(context, 2).toFloat(); cv.drawCircle(cx, cy, r, fill)
                        txt.color = p.primary; cv.drawText(num(k), cx, cy + txt.textSize / 3, txt) }
                    else -> { fill.style = Paint.Style.FILL; fill.color = p.surface; cv.drawCircle(cx, cy, r, fill)
                        fill.style = Paint.Style.STROKE; fill.color = p.line; cv.drawCircle(cx, cy, r, fill)
                        txt.color = p.muted; cv.drawText(num(k), cx, cy + txt.textSize / 3, txt) }
                }
                lbl.color = if (k == current) p.text else p.muted
                lbl.typeface = font(context, k == current)
                cv.drawText(L10n.t(STEP_KEYS[i]), cx, cy + r + dp(context, 18), lbl)
            }
        }
        private fun tick(cv: Canvas, cx: Float, cy: Float, r: Float) {
            val pt = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = p.onPrimary; style = Paint.Style.STROKE; strokeWidth = r / 4; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }
            val path = Path().apply { moveTo(cx - r * 0.45f, cy); lineTo(cx - r * 0.1f, cy + r * 0.35f); lineTo(cx + r * 0.45f, cy - r * 0.35f) }
            cv.drawPath(path, pt)
        }
        // Persian and Arabic digits where they are the script's own
        private fun num(k: Int): String = when (L10n.lang) {
            "fa" -> "۰۱۲۳۴۵۶۷۸۹"[k].toString()
            "ar" -> "٠١٢٣٤٥٦٧٨٩"[k].toString()
            else -> k.toString()
        }
    }

    /**
     * The project's logo (docs/logo.svg), drawn from its own geometry so that it stays sharp at
     * any size and readable in dark mode: three open rings and a "1". The rings keep the logo's
     * navy in light mode and turn light in dark mode; the "1" stays teal.
     */
    class Logo(ctx: Context, private val sizeDp: Int) : View(ctx) {
        private val dark = c(ctx).bg == DARK.bg
        private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; color = if (dark) 0xFFE5E7EB.toInt() else 0xFF12233D.toInt() }
        private val one = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND; color = if (dark) 0xFF2DD4BF.toInt() else 0xFF1F7F84.toInt() }
        init { contentDescription = "Proof of One" }
        override fun onMeasure(w: Int, h: Int) { val d = dp(context, sizeDp); setMeasuredDimension(View.MeasureSpec.getSize(w), d) }
        override fun onDraw(cv: Canvas) {
            val d = dp(context, sizeDp).toFloat(); val k = d / 120f
            val ox = (width - d) / 2f
            // In the SVG each ring is a dashed circle (radius, dash length, rotation); a dash
            // drawn clockwise from the rotation is an arc of (dash / circumference) × 360°.
            ring.strokeWidth = 6 * k
            for ((r, dash, rot) in listOf(Triple(50f, 232f, 122f), Triple(38f, 178f, 118f), Triple(26f, 116f, 130f))) {
                val sweep = dash / (2 * Math.PI.toFloat() * r) * 360f
                cv.drawArc(android.graphics.RectF(ox + (60 - r) * k, (62 - r) * k, ox + (60 + r) * k, (62 + r) * k), rot, sweep, false, ring)
            }
            one.strokeWidth = 8 * k
            val path = Path().apply { moveTo(ox + 52 * k, 57 * k); lineTo(ox + 61 * k, 49 * k); lineTo(ox + 61 * k, 80 * k) }
            cv.drawPath(path, one)
        }
    }

    /** The tools and language menu behind "⋮". */
    fun menu(a: Activity, items: List<Pair<String, () -> Unit>>) {
        val names = items.map { it.first }.toTypedArray()
        android.app.AlertDialog.Builder(a).setItems(names) { _, i -> items[i].second() }.show()
    }

    /** A choice of language, as a dialog; choosing restarts the screen. */
    fun language(a: Activity) {
        val names = L10n.LANGS.map { it.second }.toTypedArray()
        android.app.AlertDialog.Builder(a).setTitle(L10n.t("language")).setItems(names) { _, i -> L10n.set(a, L10n.LANGS[i].first) }.show()
    }
}
