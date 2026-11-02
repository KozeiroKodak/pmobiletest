package com.pmobile.app;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

/** Opt-in test: a separate server fixture sends one fictional queued event. */
@RunWith(AndroidJUnit4.class)
public class PushInternetTest {
 @Test public void receivesQueuedPushInBackground() throws Exception {
  assumeTrue("true".equals(InstrumentationRegistry.getArguments().getString("pushInternet")));
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  assertEquals("com.pmobile.preview",context.getPackageName());
  String user=InstrumentationRegistry.getArguments().getString("pushUsuario");
  assertTrue(user!=null&&user.matches("[1-9][0-9]*"));
  android.content.SharedPreferences prefs=context.getSharedPreferences("PMEntregasPush",0);
  Map<String,?> before=prefs.getAll();
  NotificationManager manager=context.getSystemService(NotificationManager.class);
  File ready=new File(context.getCacheDir(),"push-internet-ready.json");
  File receipt=new File(context.getCacheDir(),"push-internet-received.json");
  ready.delete();receipt.delete();
  try {
   FirebaseApp.initializeApp(context);
   String token=Tasks.await(FirebaseMessaging.getInstance().getToken(),45,TimeUnit.SECONDS);
   assertFalse(token.isEmpty());
   prefs.edit().putString("usuario",user).commit();
   context.startActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
   Files.write(ready.toPath(),new org.json.JSONObject().put("token",token).put("usuario_id",user).toString().getBytes(StandardCharsets.UTF_8));
   long end=android.os.SystemClock.elapsedRealtime()+120000;
   while(android.os.SystemClock.elapsedRealtime()<end){
    for(android.service.notification.StatusBarNotification n:manager.getActiveNotifications()){
     String title=String.valueOf(n.getNotification().extras.getCharSequence("android.title"));
     if(n.getTag()!=null&&n.getTag().startsWith("pm-entregas-"+user+"-")&&"TESTE PMEntregas — internet".equals(title)){
      Files.write(receipt.toPath(),new org.json.JSONObject().put("recebido",true).put("tag",n.getTag()).put("segundoPlano",true).toString().getBytes(StandardCharsets.UTF_8));
      manager.cancel(n.getTag(),n.getId());return;
     }
    }
    Thread.sleep(250);
   }
   fail("Aviso da fila não chegou pelo FCM em segundo plano");
  }finally{
   ready.delete();
   android.content.SharedPreferences.Editor edit=prefs.edit().clear();
   for(Map.Entry<String,?> entry:before.entrySet())if(entry.getValue() instanceof String)edit.putString(entry.getKey(),(String)entry.getValue());
   edit.commit();
  }
 }
}
