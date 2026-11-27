/* Comparador de clientes — somente análise; não modifica a fonte OneDrive. */
(function(root){
  "use strict";
  const stop=new Set(["E","DE","DA","DO","DAS","DOS","LTDA","ME","EPP","SA"]);
  const genericos=new Set(["AUTO","PECAS","TRANSPORTE","COMERCIO","MECANICA","POSTO","MOLAS","SERVICOS","INDUSTRIA","EMPRESA"]);
  const normalizar=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toUpperCase().replace(/[^A-Z0-9]+/g," ").trim().replace(/\s+/g," ");
  function termos(nome) {
    return normalizar(nome).replace(/\bTRANSP\b/g,"TRANSPORTE").replace(/\bSTA\b/g,"SANTA")
      .split(" ").filter(x=>x&&!stop.has(x)).sort();
  }
  const assinatura=nome=>termos(nome).join(" ");
  function distancia(a,b) {
    if(a===b)return 0;
    const max=Math.max(a.length,b.length);
    if(Math.abs(a.length-b.length)>Math.ceil(max*.24))return max;
    let anterior=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const atual=[i];
      for(let j=1;j<=b.length;j++)
        atual[j]=Math.min(atual[j-1]+1,anterior[j]+1,anterior[j-1]+Number(a[i-1]!==b[j-1]));
      anterior=atual;
    }
    return anterior[b.length];
  }
  function pontuar(a,b){
    if(a===b)return 0;
    const x=assinatura(a),y=assinatura(b);
    if(!x||!y)return 0;
    if(x===y)return 98;
    const t=[...new Set(termos(a))],u=[...new Set(termos(b))],s=new Set(u);
    const iguais=t.filter(w=>s.has(w));
    const coef=2*iguais.length/(t.length+u.length);
    const distintivo=iguais.some(w=>w.length>=4&&!genericos.has(w));
    const proximidade=1-distancia(x,y)/Math.max(x.length,y.length);
    if(coef>=.78&&iguais.length>=2&&(distintivo||coef>.90))return Math.round(75+coef*16);
    if(proximidade>=.86&&iguais.length>=2&&(distintivo||proximidade>.92))
      return Math.round(proximidade*92);
    return 0;
  }
  const chave=(cidade,a,b)=>normalizar(cidade)+"|"+[normalizar(a),normalizar(b)].sort().join("|");
  function agrupar(registros){
    const cidades=new Map();
    for(const r of registros){
      const nome=String(r?.cliente??"").trim(),cidade=String(r?.regiao??"").trim();
      if(!nome||!cidade||/^TOTAL(?:\s*GERAL)?$/i.test(nome)||!r.notas_fiscais)continue;
      const local=normalizar(cidade);
      if(!local)continue;
      let nomes=cidades.get(local);
      if(!nomes){nomes=new Map();cidades.set(local,nomes);}
      let item=nomes.get(nome);
      if(!item){item={nome,cidade,nfs:new Map(),ocorrencias:0};nomes.set(nome,item);}
      item.ocorrencias++;
      const nf=String(r.notas_fiscais).trim(),transporte=String(r.transportadora??"").trim();
      if(nf&&!item.nfs.has(nf+"|"+transporte))
        item.nfs.set(nf+"|"+transporte,{nf,transporte});
    }
    const grupos=[];
    for(const [local,nomes] of cidades){
      const lista=[...nomes.values()];
      if(lista.length<2)continue;
      const pai=lista.map((_,i)=>i),posto=lista.map(()=>0);
      function find(i){while(pai[i]!==i){pai[i]=pai[pai[i]];i=pai[i];}return i;}
      function join(i,j){
        let a=find(i),b=find(j);if(a===b)return;
        if(posto[a]<posto[b])[a,b]=[b,a];pai[b]=a;if(posto[a]===posto[b])posto[a]++;
      }
      const buckets=new Map();
      for(let i=0;i<lista.length;i++){
        const partes=[...new Set(termos(lista[i].nome).filter(w=>w.length>=4))]
          .sort((a,b)=>b.length-a.length);
        const chaves=new Set(partes.slice(0,3).map(w=>w.slice(0,4)));
        chaves.add("EXATO:"+assinatura(lista[i].nome));
        for(const k of chaves){
          let itens=buckets.get(k);
          if(!itens){itens=[];buckets.set(k,itens);}itens.push(i);
        }
      }
      const visitados=new Set();
      for(const itens of buckets.values()){
        // Um termo genérico muito frequente não pode gerar milhões de pares.
        if(itens.length>350)continue;
        for(let p=0;p<itens.length;p++)for(let q=p+1;q<itens.length;q++){
          const a=itens[p],b=itens[q],id=a<b?a+"|"+b:b+"|"+a;
          if(visitados.has(id))continue;visitados.add(id);
          if(pontuar(lista[a].nome,lista[b].nome)>=75)join(a,b);
        }
      }
      const conjuntos=new Map();
      for(let i=0;i<lista.length;i++){
        const raiz=find(i);
        if(!conjuntos.has(raiz))conjuntos.set(raiz,[]);
        conjuntos.get(raiz).push(lista[i]);
      }
      for(const variantes of conjuntos.values()){
        if(variantes.length<2)continue;
        variantes.sort((a,b)=>b.ocorrencias-a.ocorrencias||a.nome.localeCompare(b.nome,"pt-BR"));
        grupos.push({id:grupos.length,local,cidade:variantes[0].cidade,
          variantes,totalNfs:variantes.reduce((n,v)=>n+v.nfs.size,0)});
      }
    }
    return grupos.sort((a,b)=>b.variantes.length-a.variantes.length||b.totalNfs-a.totalNfs||
      a.cidade.localeCompare(b.cidade,"pt-BR"));
  }
  const api=Object.freeze({normalizar,termos,assinatura,pontuar,chave,agrupar});
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.PMobileClientesAnalise=api;
})(typeof window!=="undefined"?window:null);
