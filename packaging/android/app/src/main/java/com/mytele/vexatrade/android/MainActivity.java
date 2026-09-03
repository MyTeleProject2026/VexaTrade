package com.mytele.vexatrade.android;

import android.app.Activity; import android.content.Intent; import android.net.Uri; import android.os.Bundle; import android.webkit.*; import java.util.*;
public final class MainActivity extends Activity {
 private WebView webView; private final Set<String> allowedHosts=new HashSet<>();
 @Override public void onCreate(Bundle state){super.onCreate(state); Uri start=Uri.parse(BuildConfig.WEB_APP_URL); if(start.getHost()!=null)allowedHosts.add(start.getHost()); allowedHosts.add("api-vexaaccount.onrender.com"); webView=new WebView(this); setContentView(webView); webView.setWebChromeClient(new WebChromeClient()); webView.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){Uri u=r.getUrl(); String h=u.getHost(); if("https".equalsIgnoreCase(u.getScheme())&&h!=null&&allowedHosts.contains(h))return false; startActivity(new Intent(Intent.ACTION_VIEW,u)); return true;}}); WebSettings s=webView.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true); s.setAllowFileAccess(false); s.setAllowContentAccess(false); s.setSupportMultipleWindows(false); CookieManager.getInstance().setAcceptCookie(true); webView.loadUrl(BuildConfig.WEB_APP_URL); }
 @Override public void onBackPressed(){if(webView!=null&&webView.canGoBack())webView.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(webView!=null){webView.loadUrl("about:blank");webView.stopLoading();webView.destroy();}super.onDestroy();}
}
