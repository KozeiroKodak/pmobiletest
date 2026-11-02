package com.pmobile.app;
import android.app.NotificationManager;
import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.HashMap;
import java.util.Map;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class NotificacoesInstrumentedTest {
 @Test public void notificationsArePrivateDeduplicatedAndDisabledAfterLogout(){
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();assertEquals("com.pmobile.preview",context.getPackageName());
  android.content.SharedPreferences prefs=context.getSharedPreferences("PMEntregasPush",0);
  Map<String,?> before=prefs.getAll();NotificationManager manager=context.getSystemService(NotificationManager.class);
  try{
   NotificacoesService.prepararCanal(context);
   android.app.NotificationChannel channel=manager.getNotificationChannel(NotificacoesService.CHANNEL);
   assertNotNull("A categoria deve existir antes de publicar um aviso",channel);
   int importance=channel.getImportance();
   NotificacoesService.prepararCanal(context);
   assertEquals("Preparar novamente não deve mudar a preferência do usuário",importance,manager.getNotificationChannel(NotificacoesService.CHANNEL).getImportance());
   prefs.edit().clear().putString("usuario","42").commit();
   Map<String,String> data=new HashMap<>();data.put("id","90001");data.put("usuario_id","43");data.put("tipo","NF_ATRIBUIDA");data.put("titulo","Teste PMEntregas");data.put("mensagem","Nota fictícia: validação de notificação.");
   assertFalse(NotificacoesService.publicar(context,data));
   data.put("usuario_id","42");assertTrue("Permita notificações no aplicativo de teste",NotificacoesService.publicar(context,data));
   assertFalse(NotificacoesService.publicar(context,data));
   assertTrue(java.util.Arrays.stream(manager.getActiveNotifications()).anyMatch(n->"pm-entregas-42-90001".equals(n.getTag())));
   prefs.edit().putString("usuario","").commit();data.put("id","90002");assertFalse(NotificacoesService.publicar(context,data));
  }finally{manager.cancel("pm-entregas-42-90001",0);android.content.SharedPreferences.Editor edit=prefs.edit().clear();for(Map.Entry<String,?> entry:before.entrySet())if(entry.getValue() instanceof String)edit.putString(entry.getKey(),(String)entry.getValue());edit.commit();}
 }
}
