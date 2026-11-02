// Navegação externa por endereço conferido e sugestão geométrica opcional.
// A distância abaixo é em linha reta; NÃO representa quilometragem/tempo rodoviário.
export function enderecoValido(destino){
 return typeof destino?.endereco==="string" && destino.endereco.trim().length>=10 && destino.endereco.includes(",") && /[0-9]/.test(destino.endereco);
}
export function coordenadaValida(d){
 return Number.isFinite(d?.latitude)&&Number.isFinite(d?.longitude)
  && d.latitude>=-90&&d.latitude<=90&&d.longitude>=-180&&d.longitude<=180;
}
export function urlNavegacao(destino,servico="google"){
 if(!enderecoValido(destino))throw Error("Endereço completo ainda não confirmado pela Gerência.");
 if(servico==="waze"&&coordenadaValida(destino)){
   return "https://waze.com/ul?ll="+encodeURIComponent(destino.latitude+","+destino.longitude)+"&navigate=yes";
 }
 if(servico!=="google"&&servico!=="waze")throw Error("Navegador inválido.");
 return "https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(
  coordenadaValida(destino)?destino.latitude+","+destino.longitude:destino.endereco
 )+"&travelmode=driving";
}
function rad(x){return x*Math.PI/180}
export function distanciaRetaKm(a,b){
 if(!coordenadaValida(a)||!coordenadaValida(b))throw Error("Coordenadas não confirmadas.");
 const dlat=rad(b.latitude-a.latitude),dlon=rad(b.longitude-a.longitude);
 const t=Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(t),Math.sqrt(1-t));
}
export function sugerirSequencia(itens,origem){
 if(!Array.isArray(itens)||!itens.length||!coordenadaValida(origem)
 ||itens.some(x=>!coordenadaValida(x)))throw Error("Todos os destinos e a origem precisam de coordenadas confirmadas.");
 const restantes=[...itens],ordenados=[];let atual=origem;
 while(restantes.length){
  let pos=0,menor=Infinity;
  restantes.forEach((x,i)=>{const d=distanciaRetaKm(atual,x);if(d<menor){pos=i;menor=d;}});
  const proximo=restantes.splice(pos,1)[0];
  ordenados.push(proximo);atual=proximo;
 }
 return ordenados;
}
