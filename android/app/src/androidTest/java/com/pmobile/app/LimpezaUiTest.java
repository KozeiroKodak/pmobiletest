package com.pmobile.app;

import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Real HTML/CSS/JS, isolated origin and offline fixture; never user data. */
@RunWith(AndroidJUnit4.class)
public class LimpezaUiTest {
 private final Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
 private WebView web;
 private String js(String script)throws Exception{CountDownLatch ready=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();instrumentation.runOnMainSync(()->web.evaluateJavascript(script,v->{value.set(v);ready.countDown();}));assertTrue(ready.await(10,TimeUnit.SECONDS));return value.get();}
 private byte[] bytes(InputStream in)throws IOException{try(InputStream stream=in;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=stream.read(b))!=-1)out.write(b,0,n);return out.toByteArray();}}
 @Test public void currentScreensAndLocalModulesRemainUsable()throws Exception{
  Context app=instrumentation.getTargetContext();assertEquals("com.pmobile.preview",app.getPackageName());
  assertFalse("Desbloqueie o celular",((android.app.KeyguardManager)app.getSystemService(Context.KEYGUARD_SERVICE)).isKeyguardLocked());
  MainActivity activity=(MainActivity)instrumentation.startActivitySync(new Intent(app,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  final String fixture=new String(bytes(instrumentation.getContext().getAssets().open("limpeza-fixture.js")),StandardCharsets.UTF_8);
  instrumentation.runOnMainSync(()->{
   activity.getBridge().getWebView().stopLoading();
   activity.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
   web=new WebView(activity);web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);
   web.setWebViewClient(new WebViewClient(){@Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
    String file=request.getUrl().getPath();try{
     if(!"limpeza.test".equals(request.getUrl().getHost()))return new WebResourceResponse("text/javascript","UTF-8",new ByteArrayInputStream(new byte[0]));
     if(file==null||file.equals("/"))file="/index.html";
     if(file.contains(".."))throw new IOException("Path rejected");
     byte[] data=bytes(app.getAssets().open("public"+file));String mime=file.endsWith(".css")?"text/css":file.endsWith(".js")?"text/javascript":"text/html";
     if(file.equals("/index.html")){String html=new String(data,StandardCharsets.UTF_8).replace("<head>","<head><script>"+fixture+"</script>");data=html.getBytes(StandardCharsets.UTF_8);}
     return new WebResourceResponse(mime,"UTF-8",new ByteArrayInputStream(data));
    }catch(Exception error){return new WebResourceResponse("text/plain","UTF-8",404,"Missing",null,new ByteArrayInputStream(new byte[0]));}
   }});activity.setContentView(web);web.loadUrl("https://limpeza.test/index.html");
  });
  try{long end=android.os.SystemClock.elapsedRealtime()+45000;int screenshots=0;
   while(android.os.SystemClock.elapsedRealtime()<end){
    String error=js("window.__limpeza?.erro||''");assertEquals(error,"\"\"",error);
    if("true".equals(js("window.__limpeza?.capturar===true"))){String stage=js("window.__limpeza.etapa").replace("\"","");Thread.sleep(250);
     Bitmap shot=instrumentation.getUiAutomation().takeScreenshot();assertNotNull(shot);try(FileOutputStream out=new FileOutputStream(new File(app.getCacheDir(),"limpeza-"+stage+".png"))){assertTrue(shot.compress(Bitmap.CompressFormat.PNG,100,out));}finally{shot.recycle();}
     screenshots++;js("window.__limpeza.capturar=false");
    }
    if("true".equals(js("window.__limpeza?.pronto===true"))){assertTrue(screenshots>0);assertEquals("0",js("window.__limpeza.gravacoes"));return;}
    Thread.sleep(100);
   }fail("Tempo esgotado: "+js("JSON.stringify(window.__limpeza)"));
  }finally{instrumentation.runOnMainSync(()->{web.destroy();activity.finish();});}
 }
}
