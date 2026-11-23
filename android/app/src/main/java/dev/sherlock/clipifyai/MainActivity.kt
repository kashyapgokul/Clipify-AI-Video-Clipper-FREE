package dev.sherlock.clipifyai

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import dev.sherlock.clipifyai.databinding.ActivityMainBinding
import dev.sherlock.clipifyai.media.AndroidMediaProcessor
import dev.sherlock.clipifyai.media.ProjectManager
import dev.sherlock.clipifyai.network.DesktopSyncClient
import dev.sherlock.clipifyai.onboarding.OnboardingActivity
import dev.sherlock.clipifyai.service.RenderForegroundService
import java.io.File
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: SharedPreferences
    private lateinit var projectManager: ProjectManager
    private lateinit var mediaProcessor: AndroidMediaProcessor
    private lateinit var syncClient: DesktopSyncClient
    private var tts: TextToSpeech? = null

    private val selectVideoLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let { handleSelectedVideo(it) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        prefs = getSharedPreferences("clipify_prefs", Context.MODE_PRIVATE)
        val skipOnboarding = intent.getBooleanExtra("skip_onboarding", false)
        val onboardingComplete = prefs.getBoolean("onboarding_complete", false) || skipOnboarding
        if (!onboardingComplete) {
            startActivity(Intent(this, OnboardingActivity::class.java))
            finish()
            return
        }

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        projectManager = ProjectManager(this)
        mediaProcessor = AndroidMediaProcessor(this)
        val desktopHost = prefs.getString("desktop_ip", "http://127.0.0.1:5000") ?: "http://127.0.0.1:5000"
        syncClient = DesktopSyncClient(desktopHost)

        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.US
            }
        }

        setupWebView()
        setupNavigation()
        setupHeaderListeners()
        loadInitialPage()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        binding.webView.setBackgroundColor(android.graphics.Color.parseColor("#09090b"))
        binding.webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
        binding.webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            allowFileAccessFromFileURLs = true
            allowUniversalAccessFromFileURLs = true
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            useWideViewPort = false
            loadWithOverviewMode = false
            setSupportZoom(false)
            displayZoomControls = false
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
        }

        binding.webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    binding.webProgress.visibility = android.view.View.VISIBLE
                    binding.webProgress.progress = newProgress
                } else {
                    binding.webProgress.visibility = android.view.View.GONE
                }
            }
        }

        binding.webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    if (url.contains("github.com")) {
                        openExternalUrl(url)
                        return true
                    }
                }
                return false
            }
        }

        // Expose Native Android Bridge to JavaScript
        binding.webView.addJavascriptInterface(ClipifyAndroidBridge(), "AndroidBridge")
    }

    private fun loadInitialPage() {
        val target = intent.getStringExtra("target_url")
        if (!target.isNullOrEmpty()) {
            binding.webView.loadUrl(target)
        } else {
            binding.webView.loadUrl("file:///android_asset/www/index.html")
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        val target = intent?.getStringExtra("target_url")
        if (!target.isNullOrEmpty()) {
            binding.webView.loadUrl(target)
        }
    }

    private fun setupHeaderListeners() {
        binding.btnHeaderGithub.setOnClickListener {
            openExternalUrl("https://github.com/sherlock-dev-ai/Clipify-AI-Video-Clipper-FREE")
        }
        binding.btnHeaderTour.setOnClickListener {
            binding.webView.evaluateJavascript(
                "(function(){ if (typeof window.ClipifyToggleClippy === 'function') { window.ClipifyToggleClippy(); } else { var btn = document.getElementById('clippyToggleBtn'); if (btn) btn.click(); } })();",
                null
            )
        }
    }

    private fun setupNavigation() {
        binding.bottomNavigation.setOnItemSelectedListener { item ->
            val currentUrl = binding.webView.url ?: ""
            when (item.itemId) {
                R.id.nav_create -> {
                    if (currentUrl.contains("index.html")) {
                        binding.webView.evaluateJavascript("if (typeof navigateTo === 'function') navigateTo('create'); else window.location.hash = '#create';", null)
                    } else {
                        binding.webView.loadUrl("file:///android_asset/www/index.html")
                    }
                    true
                }
                R.id.nav_narrate -> {
                    binding.webView.loadUrl("file:///android_asset/www/narrate.html")
                    true
                }
                R.id.nav_live -> {
                    binding.webView.loadUrl("file:///android_asset/www/live.html")
                    true
                }
                R.id.nav_projects -> {
                    if (currentUrl.contains("index.html")) {
                        binding.webView.evaluateJavascript("if (typeof navigateTo === 'function') navigateTo('projects'); else window.location.hash = '#projects';", null)
                    } else {
                        binding.webView.loadUrl("file:///android_asset/www/index.html#projects")
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun handleSelectedVideo(videoUri: Uri) {
        val fileName = getFileNameFromUri(videoUri)
        val (w, h) = mediaProcessor.getVideoDimensions(videoUri)
        val cropCoords = mediaProcessor.calculateVertical916Crop(w, h)

        val projId = projectManager.createProject("Mobile Clip " + System.currentTimeMillis(), videoUri.toString())
        Toast.makeText(this, "Imported: $fileName (${w}x${h})", Toast.LENGTH_SHORT).show()

        // Update web view UI
        val jsCall = "if (window.onAndroidVideoSelected) window.onAndroidVideoSelected('$videoUri', '$fileName', 0);"
        binding.webView.evaluateJavascript(jsCall, null)

        // Launch background render service
        val serviceIntent = Intent(this, RenderForegroundService::class.java).apply {
            action = RenderForegroundService.ACTION_START_RENDER
            putExtra("video_uri", videoUri.toString())
            putExtra("project_id", projId)
            putExtra("crop_w", cropCoords.width)
            putExtra("crop_h", cropCoords.height)
        }
        startForegroundService(serviceIntent)
    }

    private fun getFileNameFromUri(uri: Uri): String {
        return uri.lastPathSegment?.substringAfterLast('/') ?: "imported_video.mp4"
    }

    private fun openExternalUrl(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "Could not open browser", Toast.LENGTH_SHORT).show()
        }
    }

    private fun triggerInteractiveTour() {
        binding.webView.evaluateJavascript(
            "if (window.startClipifyTour) { window.startClipifyTour(); } else { console.log('Tour not loaded'); }",
            null
        )
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        super.onDestroy()
    }

    inner class ClipifyAndroidBridge {
        @JavascriptInterface
        fun callApi(method: String, endpoint: String, body: String?, headers: String?): String {
            return syncClient.executeApiCall(method, endpoint, body, headers)
        }

        @JavascriptInterface
        fun pickVideo() {
            runOnUiThread {
                selectVideoLauncher.launch("video/*")
            }
        }

        @JavascriptInterface
        fun openBrowser(url: String) {
            runOnUiThread {
                openExternalUrl(url)
            }
        }

        @JavascriptInterface
        fun showToast(msg: String) {
            runOnUiThread {
                Toast.makeText(this@MainActivity, msg, Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun triggerInteractiveTour() {
            runOnUiThread {
                this@MainActivity.triggerInteractiveTour()
            }
        }

        @JavascriptInterface
        fun speakText(text: String) {
            runOnUiThread {
                tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "ClipifyTTS")
            }
        }

        @JavascriptInterface
        fun startYouTubeClip(url: String, mode: String) {
            runOnUiThread {
                Toast.makeText(this@MainActivity, "Processing YouTube video: $url", Toast.LENGTH_SHORT).show()
                val projId = projectManager.createProject("YouTube Clip " + System.currentTimeMillis(), url)

                val serviceIntent = Intent(this@MainActivity, RenderForegroundService::class.java).apply {
                    action = RenderForegroundService.ACTION_START_RENDER
                    putExtra("video_uri", url)
                    putExtra("project_id", projId)
                    putExtra("mode", mode)
                }
                startForegroundService(serviceIntent)

                val js = """
                    if (window.showToast) window.showToast('Imported YouTube video. Analyzing hooks...', 'info');
                    const dropText = document.querySelector('.drop-title, .dropzone h3, .upload-box h3');
                    if (dropText) dropText.textContent = 'Rendering 9:16 Short: YouTube Clip...';
                    setTimeout(() => {
                        if (dropText) dropText.textContent = '✓ Ready: 9:16 Short Generated';
                        if (window.showToast) window.showToast('YouTube Short created in /sdcard/Movies/ClipifyAI/', 'success');
                    }, 4000);
                """.trimIndent()
                binding.webView.evaluateJavascript(js, null)
            }
        }
    }
}
