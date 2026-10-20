#!/usr/bin/env node
// PMOBILE — Auditoria massiva B2B x Supabase (somente leitura)
// Arquivo: implementacoes/teste-b2b-imagens.mjs
//
// Execução:
//   node implementacoes/teste-b2b-imagens.mjs
//
// O Supabase é acessado somente por GET/SELECT.
// O checkpoint fica fora do repositório.

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const SUPABASE_JS = path.join(ROOT, "supabase.js");
const CHECKPOINT = path.join(os.homedir(), ".pmobile-b2b-imagens-checkpoint.json");

const SUPABASE_TABLE = "materiais";
const B2B_BASE = "https://b2b.cbadiesel.com.br";
const B2B_TAGS = ["FORD", "MBB", "SCANIA", "VOLVO", "VW"];

const PAGE_SIZE = 1000;
const B2B_CONCURRENCY = 6;
const REQUEST_TIMEOUT_MS = 12000;
const RETRIES = 4;
const RETRY_BASE_MS = 900;
const PROGRESS_EVERY = 100;

let stopping = false;

process.on("SIGINT", () => {
    if (!stopping) {
        stopping = true;
        console.log("\n\n⏹️ Ctrl+C recebido. Finalizando o lote atual e salvando checkpoint...");
    }
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalize(value) {
    return String(value ?? "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
}

function normalizeRef(value) {
    return normalize(value).replace(/\s+/g, "");
}

function pairKey(referencia, marca) {
    return JSON.stringify([normalizeRef(referencia), normalize(marca)]);
}

async function readSupabaseConfig() {
    const source = await fs.readFile(SUPABASE_JS, "utf8");

    const urlMatch = source.match(
        /const\s+SUPABASE_URL\s*=\s*["']([^"']+)["']/
    );
    const keyMatch = source.match(
        /const\s+SUPABASE_PUBLISHABLE_KEY\s*=\s*["']([^"']+)["']/
    );

    if (!urlMatch || !keyMatch) {
        throw new Error(
            "Não foi possível reutilizar SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY de supabase.js."
        );
    }

    return { url: urlMatch[1], key: keyMatch[1] };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

function isRetryableStatus(status) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function fetchRetry(url, options = {}, label = "HTTP") {
    let lastError;

    for (let attempt = 1; attempt <= RETRIES; attempt++) {
        if (stopping) throw new Error("INTERRUPT");

        try {
            const response = await fetchWithTimeout(url, options);

            if (!isRetryableStatus(response.status)) {
                return response;
            }

            const body = await response.text().catch(() => "");
            lastError = new Error(
                label + ": HTTP " + response.status +
                (body ? " — " + body.slice(0, 300) : "")
            );
        } catch (error) {
            lastError = error;
        }

        if (attempt < RETRIES) {
            await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
        }
    }

    throw lastError ?? new Error(label + ": falha desconhecida");
}

async function supabaseSelect(config, rangeStart, rangeEnd) {
    const url =
        config.url.replace(/\/$/, "") +
        "/rest/v1/" +
        SUPABASE_TABLE +
        "?select=codigo,descricao,referencia,marca" +
        "&order=codigo.asc";

    const response = await fetchRetry(
        url,
        {
            method: "GET",
            headers: {
                apikey: config.key,
                Authorization: "Bearer " + config.key,
                Range: rangeStart + "-" + rangeEnd,
                "Range-Unit": "items"
            }
        },
        "Supabase SELECT"
    );

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
            "Supabase SELECT: HTTP " + response.status + " — " + body.slice(0, 500)
        );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
        throw new Error("Supabase não retornou um array de materiais.");
    }

    return data;
}

async function loadAllMaterials(config) {
    const all = [];

    for (let start = 0; ; start += PAGE_SIZE) {
        const page = await supabaseSelect(
            config,
            start,
            start + PAGE_SIZE - 1
        );

        all.push(...page);

        console.log(
            "📥 Supabase: " + all.length.toLocaleString("pt-BR") +
            " materiais carregados..."
        );

        if (page.length < PAGE_SIZE || stopping) break;
    }

    return all;
}

function makeUniquePairs(materials) {
    const map = new Map();

    for (const material of materials) {
        const referencia = normalizeRef(material.referencia);
        const marca = normalize(material.marca);

        if (!referencia || !marca) continue;

        const key = pairKey(referencia, marca);

        if (!map.has(key)) {
            map.set(key, {
                referencia,
                marca
            });
        }
    }

    return [...map.entries()].map(([key, value]) => ({
        key,
        ...value
    }));
}

async function readJson(response) {
    const text = await response.text();

    if (!text.trim()) return null;

    try {
        return JSON.parse(text);
    } catch {
        throw new Error("B2B retornou conteúdo que não é JSON.");
    }
}

function exactMatch(items, referencia, marca) {
    const wantedRef = normalizeRef(referencia);
    const wantedBrand = normalize(marca);

    if (!Array.isArray(items)) return null;

    for (const item of items) {
        const itemRef = normalizeRef(
            item.cref ?? item.referencia ?? item.reference ?? item.ref
        );
        const itemBrand = normalize(
            item.cmarca ?? item.marca ?? item.brand
        );

        if (itemRef === wantedRef && itemBrand === wantedBrand) {
            return item;
        }
    }

    return null;
}

async function searchB2B(referencia, marca) {
    const params = new URLSearchParams({
        marca,
        q: referencia
    });

    for (const ctag of B2B_TAGS) {
        params.set("ctag", ctag);

        const url =
            B2B_BASE +
            "/api/filtro-inteligente/sugestoes?" +
            params.toString();

        const response = await fetchRetry(
            url,
            {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "User-Agent": "PMOBILE-B2B-Audit/1.0"
                }
            },
            "B2B sugestões " + ctag
        );

        if (response.status === 404) continue;

        if (!response.ok) {
            throw new Error("B2B sugestões: HTTP " + response.status);
        }

        const data = await readJson(response);
        const match = exactMatch(data?.items ?? data, referencia, marca);

        if (match) {
            return { found: true, item: match, ctag };
        }
    }

    // Fallback: algumas referências aparecem somente com marca=TODAS.
    for (const ctag of B2B_TAGS) {
        params.set("marca", "TODAS");
        params.set("ctag", ctag);

        const url =
            B2B_BASE +
            "/api/filtro-inteligente/sugestoes?" +
            params.toString();

        const response = await fetchRetry(
            url,
            {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "User-Agent": "PMOBILE-B2B-Audit/1.0"
                }
            },
            "B2B sugestões TODAS " + ctag
        );

        if (response.status === 404) continue;

        if (!response.ok) {
            throw new Error(
                "B2B sugestões TODAS: HTTP " + response.status
            );
        }

        const data = await readJson(response);
        const match = exactMatch(data?.items ?? data, referencia, marca);

        if (match) {
            return { found: true, item: match, ctag };
        }
    }

    return { found: false, item: null, ctag: null };
}

async function imageExists(iidprod) {
    if (iidprod === null || iidprod === undefined || iidprod === "") {
        return { status: "no-image", httpStatus: null };
    }

    const url =
        B2B_BASE +
        "/products/image/" +
        encodeURIComponent(String(iidprod)) +
        "/1";

    const response = await fetchRetry(
        url,
        {
            method: "GET",
            headers: {
                Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                "User-Agent": "PMOBILE-B2B-Audit/1.0"
            }
        },
        "B2B imagem " + iidprod
    );

    if (response.status === 404) {
        return { status: "no-image", httpStatus: 404 };
    }

    if (!response.ok) {
        throw new Error("B2B imagem: HTTP " + response.status);
    }

    if (response.body) {
        await response.body.cancel().catch(() => {});
    }

    return { status: "image", httpStatus: response.status };
}

async function auditPair(pair) {
    try {
        const found = await searchB2B(pair.referencia, pair.marca);

        if (!found.found) {
            return {
                key: pair.key,
                status: "not-found",
                referencia: pair.referencia,
                marca: pair.marca
            };
        }

        const iidprod =
            found.item?.iidprod ??
            found.item?.id ??
            found.item?.element?.id ??
            null;

        if (iidprod === null || iidprod === undefined || iidprod === "") {
            return {
                key: pair.key,
                status: "found-no-image",
                referencia: pair.referencia,
                marca: pair.marca,
                iidprod: null
            };
        }

        const image = await imageExists(iidprod);

        return {
            key: pair.key,
            status: image.status === "image"
                ? "found-image"
                : "found-no-image",
            referencia: pair.referencia,
            marca: pair.marca,
            iidprod: String(iidprod)
        };
    } catch (error) {
        if (String(error?.message) === "INTERRUPT") throw error;

        return {
            key: pair.key,
            status: "network-error",
            referencia: pair.referencia,
            marca: pair.marca,
            error: String(error?.message ?? error).slice(0, 500)
        };
    }
}

async function loadCheckpoint() {
    try {
        const text = await fs.readFile(CHECKPOINT, "utf8");
        const data = JSON.parse(text);

        if (!data || data.version !== 1) {
            throw new Error("Formato de checkpoint incompatível.");
        }

        return data;
    } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
    }
}

async function saveCheckpoint(state) {
    const tmp = CHECKPOINT + ".tmp";

    await fs.writeFile(
        tmp,
        JSON.stringify(state),
        { encoding: "utf8", mode: 0o600 }
    );

    await fs.rename(tmp, CHECKPOINT);
}

function summarize(materials, pairs, results) {
    const resultByKey = new Map(
        results.map(result => [result.key, result])
    );

    const pairCounts = {
        foundImage: 0,
        foundNoImage: 0,
        notFound: 0,
        networkError: 0
    };

    for (const result of results) {
        if (result.status === "found-image") pairCounts.foundImage++;
        else if (result.status === "found-no-image") pairCounts.foundNoImage++;
        else if (result.status === "not-found") pairCounts.notFound++;
        else if (result.status === "network-error") pairCounts.networkError++;
    }

    const materialPairCounts = new Map();

    for (const material of materials) {
        const ref = normalizeRef(material.referencia);
        const brand = normalize(material.marca);

        if (!ref || !brand) continue;

        const key = pairKey(ref, brand);
        materialPairCounts.set(
            key,
            (materialPairCounts.get(key) ?? 0) + 1
        );
    }

    const materialCounts = {
        foundImage: 0,
        foundNoImage: 0,
        notFound: 0,
        networkError: 0
    };

    for (const [key, count] of materialPairCounts) {
        const result = resultByKey.get(key);

        if (!result) continue;

        if (result.status === "found-image") materialCounts.foundImage += count;
        else if (result.status === "found-no-image") materialCounts.foundNoImage += count;
        else if (result.status === "not-found") materialCounts.notFound += count;
        else if (result.status === "network-error") materialCounts.networkError += count;
    }

    return {
        pairsAnalyzed: results.length,
        pairCounts,
        materials: materialCounts
    };
}

async function main() {
    console.log("🔎 PMOBILE × B2B — auditoria massiva (somente leitura)");
    console.log("📌 Branch esperada: MAIN/main");
    console.log("🔒 Supabase: somente SELECT");
    console.log("🌐 B2B: " + B2B_BASE);
    console.log("");

    const config = await readSupabaseConfig();

    if (!config.url.includes("rxyvllbebtgbfbqoimwe.supabase.co")) {
        throw new Error("A URL do Supabase em supabase.js não é a esperada.");
    }

    const checkpoint = await loadCheckpoint();

    let materials;
    let pairs;
    let results = [];
    let nextIndex = 0;

    if (checkpoint) {
        console.log("♻️ Checkpoint encontrado: " + CHECKPOINT);

        materials = checkpoint.materials;
        pairs = checkpoint.pairs;
        results = checkpoint.results ?? [];
        nextIndex = checkpoint.nextIndex ?? 0;

        console.log(
            "♻️ Retomando em " +
            nextIndex.toLocaleString("pt-BR") +
            "/" +
            pairs.length.toLocaleString("pt-BR") +
            " combinações."
        );
    } else {
        materials = await loadAllMaterials(config);

        if (materials.length === 0) {
            throw new Error("Supabase retornou zero materiais.");
        }

        pairs = makeUniquePairs(materials);

        console.log(
            "\n📊 Materiais: " +
            materials.length.toLocaleString("pt-BR")
        );
        console.log(
            "📊 Combinações referência+marca: " +
            pairs.length.toLocaleString("pt-BR")
        );

        await saveCheckpoint({
            version: 1,
            createdAt: new Date().toISOString(),
            materials,
            pairs,
            results,
            nextIndex
        });
    }

    while (nextIndex < pairs.length && !stopping) {
        const batch = pairs.slice(
            nextIndex,
            nextIndex + B2B_CONCURRENCY
        );

        const batchResults = await Promise.all(
            batch.map(pair => auditPair(pair))
        );

        results.push(...batchResults);
        nextIndex += batchResults.length;

        if (
            nextIndex % PROGRESS_EVERY === 0 ||
            nextIndex >= pairs.length
        ) {
            const partial = summarize(materials, pairs, results);

            console.log(
                "🔎 " +
                nextIndex.toLocaleString("pt-BR") +
                "/" +
                pairs.length.toLocaleString("pt-BR") +
                " — imagem: " +
                partial.pairCounts.foundImage.toLocaleString("pt-BR") +
                " | sem imagem: " +
                partial.pairCounts.foundNoImage.toLocaleString("pt-BR") +
                " | não encontrado: " +
                partial.pairCounts.notFound.toLocaleString("pt-BR") +
                " | erro: " +
                partial.pairCounts.networkError.toLocaleString("pt-BR")
            );
        }

        await saveCheckpoint({
            version: 1,
            createdAt: checkpoint?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            materials,
            pairs,
            results,
            nextIndex
        });
    }

    const final = summarize(materials, pairs, results);

    if (nextIndex < pairs.length) {
        console.log("");
        console.log("⏸️ Auditoria interrompida com segurança.");
        console.log(
            "📌 Progresso salvo: " +
            nextIndex.toLocaleString("pt-BR") +
            "/" +
            pairs.length.toLocaleString("pt-BR")
        );
        console.log("▶️ Execute o mesmo comando novamente para continuar.");
        return;
    }

    console.log("");
    console.log("========================================");
    console.log("AUDITORIA B2B FINALIZADA");
    console.log("========================================");
    console.log(
        "Materiais analisados: " +
        materials.length.toLocaleString("pt-BR")
    );
    console.log(
        "Com imagem: " +
        final.materials.foundImage.toLocaleString("pt-BR")
    );
    console.log(
        "Encontrados sem imagem: " +
        final.materials.foundNoImage.toLocaleString("pt-BR")
    );
    console.log(
        "Não encontrados: " +
        final.materials.notFound.toLocaleString("pt-BR")
    );
    console.log(
        "Erros transitórios: " +
        final.materials.networkError.toLocaleString("pt-BR")
    );
    console.log("========================================");
    console.log("📁 Checkpoint: " + CHECKPOINT);
}

main().catch(error => {
    console.error("\n❌ Auditoria interrompida por erro:", error);
    console.error("O checkpoint anterior permanece preservado.");
    process.exitCode = 1;
});
