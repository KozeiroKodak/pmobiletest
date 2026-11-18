/* PMobile — Modelo 9: foto de fundo apenas com sessão mantida.
 * Não altera login, persistência, Supabase, OTA nem o arquivo original da foto.
 * A tela não navega automaticamente.
 */
(function () {
  "use strict";
  let revision = 0;
  let shownKey = null;
  const $ = id => document.getElementById(id);

  function session() {
    const user = window.usuarioPmobileAtual;
    const credential = window.credencialPmobileAtual;
    const keep = $("loginManterLogin");
    if (!user || !user.usuario || !credential || !keep || !keep.checked) return null;
    const key = user.id === undefined || user.id === null
      ? "login:" + String(user.usuario).trim().toLocaleLowerCase("pt-BR")
      : String(user.id);
    return { key, username: String(user.usuario).trim().toLocaleLowerCase("pt-BR"), credential };
  }

  function deactivate() {
    const root = $("inicio");
    if (!root) return;
    root.classList.remove("inicio-modelo9", "inicio-com-foto");
    const brand = $("inicioMarcaModelo9");
    const welcome = $("inicioBoasVindas");
    const keep = $("inicioSessaoMantida");
    if (brand) brand.hidden = true;
    if (welcome) welcome.hidden = true;
    if (keep) keep.hidden = true;
    shownKey = null;
  }

  function photoReady() {
    const img = $("inicioFotoTelaCheia");
    return !!(img && !img.hidden && img.hasAttribute("src") && img.complete && img.naturalWidth > 0);
  }

  function activate(key) {
    const root = $("inicio");
    if (!root) return;
    root.classList.add("inicio-modelo9");
    root.classList.toggle("inicio-com-foto", photoReady());
    const brand = $("inicioMarcaModelo9");
    const welcome = $("inicioBoasVindas");
    const keep = $("inicioSessaoMantida");
    if (brand) brand.hidden = false;
    if (welcome) welcome.hidden = false;
    if (keep) keep.hidden = false;
    shownKey = key;
  }

  async function verify() {
    const current = ++revision;
    const active = session();
    if (!active) { deactivate(); return; }
    if (shownKey && shownKey !== active.key) deactivate();

    // O checkbox sozinho não é prova de que "Manter login" foi salvo:
    // verifica a mesma conta e credencial mantidas no IndexedDB.
    try {
      if (typeof obterLoginPmobileSalvo !== "function") { deactivate(); return; }
      const saved = await obterLoginPmobileSalvo();
      if (current !== revision) return;
      const latest = session();
      if (!latest || latest.key !== active.key || latest.credential !== active.credential) {
        deactivate(); return;
      }
      const savedUser = String(saved?.usuario || "").trim().toLocaleLowerCase("pt-BR");
      const savedId = saved?.dadosUsuario?.id;
      const latestId = window.usuarioPmobileAtual?.id;
      const sameId = (savedId === undefined || savedId === null || latestId === undefined || latestId === null)
        || String(savedId) === String(latestId);
      if (!saved || savedUser !== latest.username || saved.senha !== latest.credential || !sameId) {
        deactivate(); return;
      }
      activate(latest.key);
    } catch (error) {
      if (current === revision) {
        deactivate();
        console.warn("PMobile: fundo personalizado indisponível.", error);
      }
    }
  }

  function init() {
    const photo = $("inicioFotoTelaCheia");
    if (!photo) return;
    const watchPhoto = new MutationObserver(verify);
    watchPhoto.observe(photo, {attributes:true, attributeFilter:["src", "hidden"]});
    photo.addEventListener("load", verify);
    photo.addEventListener("error", verify);
    window.addEventListener("pmobile:sessao-alterada", verify);
    window.addEventListener("pageshow", verify);
    window.addEventListener("online", verify);
    window.addEventListener("offline", verify);
    $("loginManterLogin")?.addEventListener("change", verify);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) verify(); });
    verify();
  }

  window.PMobileInicioModelo9 = Object.freeze({verificar:verify});
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
