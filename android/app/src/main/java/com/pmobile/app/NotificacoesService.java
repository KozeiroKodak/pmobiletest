package com.pmobile.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class NotificacoesService extends FirebaseMessagingService {
 static final String CHANNEL="pmentregas-operacao";
 static void prepararCanal(Context context){
  if(Build.VERSION.SDK_INT>=26){
   NotificationChannel canal=new NotificationChannel(CHANNEL,"Operação PMEntregas",NotificationManager.IMPORTANCE_DEFAULT);
   canal.setLockscreenVisibility(NotificationCompat.VISIBILITY_PRIVATE);
   context.getSystemService(NotificationManager.class).createNotificationChannel(canal);
  }
 }
 @Override public void onNewToken(String token){getSharedPreferences("PMEntregasPush",0).edit().putString("token",token).apply();}
 @Override public void onMessageReceived(RemoteMessage message){publicar(this,message.getData());}
 static boolean publicar(Context context,Map<String,String> data){
  String usuario=data.get("usuario_id"),id=data.get("id"),tipo=data.get("tipo");
  android.content.SharedPreferences prefs=context.getSharedPreferences("PMEntregasPush",0);
  if(usuario==null||!usuario.equals(prefs.getString("usuario",""))||id==null||!id.matches("[0-9]{1,19}"))return false;
  String destino="NF_ATRIBUIDA".equals(tipo)?"entregas":"NF_ENTREGUE".equals(tipo)?"central":"NF_DISPONIVEL".equals(tipo)?"gerencia":null;
  if(destino==null||Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(context,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return false;
  String tag="pm-entregas-"+usuario+"-"+id;
  // Duplicate delivery from FCM must not ring again, including process restarts.
  String recebidos=prefs.getString("recebidos",",");if(recebidos.contains(","+tag+","))return false;
  NotificationManager manager=context.getSystemService(NotificationManager.class);
  prepararCanal(context);
  Intent intent=new Intent(context,MainActivity.class).setAction(tag).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP)
   .putExtra("notificacaoDestino",destino).putExtra("notificacaoUsuario",usuario);
  PendingIntent abrir=PendingIntent.getActivity(context,0,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  String titulo=data.getOrDefault("titulo","PMEntregas"),texto=data.getOrDefault("mensagem","Há novidades na sua operação.");
  NotificationCompat.Builder builder=new NotificationCompat.Builder(context,CHANNEL)
   .setSmallIcon(com.pmobile.app.R.drawable.ic_notificacao).setContentTitle(titulo).setContentText(texto)
   .setStyle(new NotificationCompat.BigTextStyle().bigText(texto)).setContentIntent(abrir).setAutoCancel(true)
   .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setOnlyAlertOnce(true);
  manager.notify(tag,0,builder.build());
  String historico=recebidos+tag+",";if(historico.length()>16000)historico=historico.substring(historico.indexOf(',',historico.length()-12000));
  prefs.edit().putString("recebidos",historico).apply();return true;
 }
}
