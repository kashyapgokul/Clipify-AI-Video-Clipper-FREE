package dev.sherlock.clipifyai.network

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class DesktopSyncClient(private var desktopHost: String = "http://127.0.0.1:5000") {

    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    fun executeApiCall(method: String, endpoint: String, bodyStr: String?, headersJson: String?): String {
        try {
            val url = if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
                endpoint
            } else {
                val clean = if (endpoint.startsWith("/")) endpoint else "/$endpoint"
                "$desktopHost$clean"
            }
            val builder = Request.Builder().url(url)
            if (headersJson != null && headersJson.isNotEmpty() && headersJson != "{}") {
                try {
                    val obj = JSONObject(headersJson)
                    val keys = obj.keys()
                    while (keys.hasNext()) {
                        val k = keys.next()
                        if (!k.equals("host", ignoreCase = true) && !k.equals("content-length", ignoreCase = true)) {
                            builder.addHeader(k, obj.getString(k))
                        }
                    }
                } catch (_: Exception) {}
            }
            val mediaType = "application/json; charset=utf-8".toMediaType()
            val requestBody = bodyStr?.toRequestBody(mediaType)
            when (method.uppercase()) {
                "GET" -> builder.get()
                "POST" -> builder.post(requestBody ?: "".toRequestBody(mediaType))
                "PUT" -> builder.put(requestBody ?: "".toRequestBody(mediaType))
                "DELETE" -> builder.delete(requestBody)
                else -> builder.get()
            }
            val response = client.newCall(builder.build()).execute()
            val respBody = response.body?.string() ?: ""
            val resObj = JSONObject()
            resObj.put("ok", response.isSuccessful)
            resObj.put("status", response.code)
            resObj.put("body", respBody)
            return resObj.toString()
        } catch (e: Exception) {
            if (desktopHost.contains("127.0.0.1")) {
                desktopHost = "http://10.0.2.2:5000"
                return executeApiCall(method, endpoint, bodyStr, headersJson)
            }
            val errObj = JSONObject()
            errObj.put("ok", false)
            errObj.put("status", 503)
            errObj.put("error", e.localizedMessage ?: "Connection to desktop server failed")
            return errObj.toString()
        }
    }

    fun testConnection(callback: (Boolean, String?) -> Unit) {
        val request = Request.Builder()
            .url("$desktopHost/api/health")
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(false, e.localizedMessage)
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val successful = response.isSuccessful
                val body = response.body?.string()
                callback(successful, body)
            }
        })
    }

    fun fetchAvailableModels(callback: (List<String>) -> Unit) {
        val request = Request.Builder()
            .url("$desktopHost/api/models")
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(emptyList())
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val result = mutableListOf<String>()
                if (response.isSuccessful) {
                    try {
                        val body = response.body?.string() ?: "{}"
                        val json = JSONObject(body)
                        val models = json.optJSONArray("models") ?: JSONArray()
                        for (i in 0 until models.length()) {
                            result.add(models.getString(i))
                        }
                    } catch (e: Exception) {
                        // fallback
                    }
                }
                callback(result)
            }
        })
    }

    fun syncProjectToDesktop(projectJsonString: String, callback: (Boolean, String?) -> Unit) {
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val body = projectJsonString.toRequestBody(mediaType)
        val request = Request.Builder()
            .url("$desktopHost/api/projects/sync")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(false, e.localizedMessage)
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                callback(response.isSuccessful, response.body?.string())
            }
        })
    }

    fun updateHost(newHost: String) {
        this.desktopHost = newHost.trim().removeSuffix("/")
    }
}
