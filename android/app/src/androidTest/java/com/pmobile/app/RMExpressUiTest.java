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
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class RMExpressUiTest {
 private final Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();private WebView web;
 private String js(String code)throws Exception{CountDownLatch ready=new CountDownLatch(1);AtomicReference<String> out=new AtomicReference<>();instrumentation.runOnMainSync(()->web.evaluateJavascript(code,v->{out.set(v);ready.countDown();}));assertTrue(ready.await(10,TimeUnit.SECONDS));return out.get();}
 private byte[] bytes(InputStream in)throws IOException{try(InputStream stream=in;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=stream.read(b))!=-1)out.write(b,0,n);return out.toByteArray();}}
 @Test public void sameOperationsUseHostSessionAndAndroidBack()throws Exception{
  Context app=instrumentation.getTargetContext();assertEquals("com.pmobile.preview",app.getPackageName());
  assertFalse("Desbloqueie o celular",((android.app.KeyguardManager)app.getSystemService(Context.KEYGUARD_SERVICE)).isKeyguardLocked());
  android.content.SharedPreferences prefs=app.getSharedPreferences("PMEntregasPush",0);Map<String,?> before=prefs.getAll();
  MainActivity activity=(MainActivity)instrumentation.startActivitySync(new Intent(app,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  String fixture=new String(bytes(instrumentation.getContext().getAssets().open("rmexpress-fixture.js")),StandardCharsets.UTF_8);
  instrumentation.runOnMainSync(()->{
   web=activity.getBridge().getWebView();web.stopLoading();activity.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
   web.setWebViewClient(new WebViewClient(){@Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
    String file=request.getUrl().getPath();try{
     if(!"rmexpress.test".equals(request.getUrl().getHost()))return new WebResourceResponse("text/javascript","UTF-8",new ByteArrayInputStream(new byte[0]));
     if(file==null||file.equals("/"))file="/index.html";if(file.contains(".."))throw new IOException("Path rejected");
     byte[] data=bytes(app.getAssets().open("public"+file));String mime=file.endsWith(".css")?"text/css":file.endsWith(".js")?"text/javascript":"text/html";
     if(file.endsWith(".html")){String html=new String(data,StandardCharsets.UTF_8).replaceFirst("(?i)<head>","<head><script>window.__rmexpressNativo=true;</script><script>"+java.util.regex.Matcher.quoteReplacement(fixture)+"</script>");data=html.getBytes(StandardCharsets.UTF_8);}
     return new WebResourceResponse(mime,"UTF-8",new ByteArrayInputStream(data));
    }catch(Exception error){return new WebResourceResponse("text/plain","UTF-8",404,"Missing",null,new ByteArrayInputStream(new byte[0]));}
   }});web.loadUrl("https://rmexpress.test/index.html");
  });
  try{long end=android.os.SystemClock.elapsedRealtime()+90000;int captures=0;
   while(android.os.SystemClock.elapsedRealtime()<end){
    String error=js("window.__rmexpressTeste?.erro||''");assertEquals(error,"\"\"",error);
    if("true".equals(js("window.__rmexpressTeste?.voltar===true"))){instrumentation.sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK);js("window.__rmexpressTeste.voltar=false");}
    if("true".equals(js("window.__rmexpressTeste?.capturar===true"))){String stage=js("window.__rmexpressTeste.etapa").replace("\"","");Thread.sleep(250);Bitmap shot=instrumentation.getUiAutomation().takeScreenshot();assertNotNull(shot);try(FileOutputStream out=new FileOutputStream(new File(app.getCacheDir(),"rmexpress-"+stage+".png"))){assertTrue(shot.compress(Bitmap.CompressFormat.PNG,100,out));}finally{shot.recycle();}captures++;js("window.__rmexpressTeste.capturar=false");}
    if("true".equals(js("window.__rmexpressTeste?.pronto===true"))){assertEquals(2,captures);assertEquals("0",js("window.__rmexpressTeste.gravacoes"));return;}
    Thread.sleep(75);
   }fail("Tempo esgotado: "+js("JSON.stringify(window.__rmexpressTeste)"));
  }finally{android.content.SharedPreferences.Editor edit=prefs.edit().clear();for(Map.Entry<String,?> entry:before.entrySet())if(entry.getValue() instanceof String)edit.putString(entry.getKey(),(String)entry.getValue());edit.commit();instrumentation.runOnMainSync(activity::finish);}
 }
}
