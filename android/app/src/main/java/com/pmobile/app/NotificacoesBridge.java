package com.pmobile.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.JavascriptInterface;
import androidx.core.content.ContextCompat;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;

/** Device identity only; PMobile credentials never enter native storage. */
final class NotificacoesBridge {
 private final MainActivity activity;
 NotificacoesBridge(MainActivity activity){this.activity=activity;NotificacoesService.prepararCanal(activity);}
 void atualizarToken(){
  try{if(FirebaseApp.getApps(activity).isEmpty())FirebaseApp.initializeApp(activity);
   if(FirebaseApp.getApps(activity).isEmpty())return;
   FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token->{
    activity.getSharedPreferences("PMEntregasPush",0).edit().putString("token",token).apply();avisar();
   });
  }catch(IllegalStateException ignored){/* Configuration is supplied separately from the application. */}
 }
 void avisar(){activity.runOnUiThread(()->{if(!activity.isFinishing()&&!activity.isDestroyed()&&activity.getBridge()!=null)
  activity.getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('pmentregas-push'))",null);});}
 @JavascriptInterface public String estado(){
  JSONObject out=new JSONObject();try{
   out.put("configurada",!FirebaseApp.getApps(activity).isEmpty());
   out.put("permitida",Build.VERSION.SDK_INT<33||ContextCompat.checkSelfPermission(activity,Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED);
   out.put("token",activity.getSharedPreferences("PMEntregasPush",0).getString("token",""));
  }catch(Exception ignored){}return out.toString();
 }
 @JavascriptInterface public void vincularUsuario(String id){
  String atual=id!=null&&id.matches("[1-9][0-9]{0,18}")?id:"";
  android.content.SharedPreferences prefs=activity.getSharedPreferences("PMEntregasPush",0);
  String anterior=prefs.getString("usuario","");prefs.edit().putString("usuario",atual).apply();
  if(!atual.equals(anterior))activity.getSystemService(android.app.NotificationManager.class).cancelAll();
  if(!atual.isEmpty())activity.runOnUiThread(this::atualizarToken);
 }
 @JavascriptInterface public void solicitarPermissao(){activity.runOnUiThread(()->{
  if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(activity,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)activity.pedirPermissaoNotificacoes();
  else{atualizarToken();avisar();}
 });}
 @JavascriptInterface public String consumirDestino(){
  android.content.SharedPreferences prefs=activity.getSharedPreferences("PMEntregasPush",0);
  String usuario=prefs.getString("usuario","");String destino=prefs.getString("destino","");
  if(usuario.isEmpty()||!usuario.equals(prefs.getString("destinoUsuario","")))return "";
  prefs.edit().remove("destino").remove("destinoUsuario").apply();
  return destino;
 }
 @JavascriptInterface public boolean possuiDestino(){
  android.content.SharedPreferences prefs=activity.getSharedPreferences("PMEntregasPush",0);
  String usuario=prefs.getString("usuario","");return !usuario.isEmpty()&&usuario.equals(prefs.getString("destinoUsuario",""))&&!prefs.getString("destino","").isEmpty();
 }
}
