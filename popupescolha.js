// ============================================================
// PMOBILE — POPUP PADRÃO DE ESCOLHA
// ============================================================

function abrirPopupEscolha(config) {
    if (!config || !Array.isArray(config.opcoes)) return;

    const anterior = document.getElementById("pmobilePopupEscolha");
    if (anterior) anterior.remove();

    const overlay = document.createElement("div");
    overlay.id = "pmobilePopupEscolha";
    overlay.className = "pmobile-popup-escolha";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const caixa = document.createElement("div");
    caixa.className = "pmobile-popup-escolha-caixa";

    const topo = document.createElement("div");
    topo.className = "pmobile-popup-escolha-topo";

    const titulo = document.createElement("h2");
    titulo.className = "pmobile-popup-escolha-titulo";
    titulo.textContent = config.titulo || "Escolher";

    const fechar = document.createElement("button");
    fechar.type = "button";
    fechar.className = "pmobile-popup-escolha-fechar";
    fechar.setAttribute("aria-label", "Fechar");
    fechar.textContent = "×";

    const opcoes = document.createElement("div");
    opcoes.className = "pmobile-popup-escolha-opcoes";
    opcoes.setAttribute("role", "listbox");

    function fecharPopup() {
        document.removeEventListener("keydown", teclaEscape);
        overlay.remove();
        if (typeof config.aoFechar === "function") {
            config.aoFechar();
        }
    }

    function teclaEscape(evento) {
        if (evento.key === "Escape") {
            fecharPopup();
        }
    }

    fechar.addEventListener("click", fecharPopup);

    config.opcoes.forEach(function(opcao) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "pmobile-popup-escolha-opcao";
        botao.textContent = opcao.label;
        botao.setAttribute("role", "option");
        botao.setAttribute("aria-selected", String(opcao.selected === true));

        if (opcao.selected) {
            botao.classList.add("selecionada");
        }

        botao.addEventListener("click", function() {
            if (typeof config.aoEscolher === "function") {
                config.aoEscolher(opcao.value, opcao.label);
            }
            fecharPopup();
        });

        opcoes.appendChild(botao);
    });

    topo.appendChild(titulo);
    topo.appendChild(fechar);
    caixa.appendChild(topo);
    caixa.appendChild(opcoes);
    overlay.appendChild(caixa);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function(evento) {
        if (evento.target === overlay) {
            fecharPopup();
        }
    });

    document.addEventListener("keydown", teclaEscape);

    fechar.focus();
}


function abrirPopupEscolhaSelect(config) {
    const seletor = document.getElementById(config.idSelect);
    if (!seletor) return;

    abrirPopupEscolha({
        titulo: config.titulo,
        opcoes: Array.from(seletor.options).map(function(opcao) {
            return {
                value: opcao.value,
                label: opcao.textContent,
                selected: opcao.selected
            };
        }),
        aoEscolher: function(valor) {
            seletor.value = valor;
            seletor.dispatchEvent(new Event("change", { bubbles: true }));

            if (typeof config.aoEscolher === "function") {
                config.aoEscolher(valor);
            }
        }
    });
}
