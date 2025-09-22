import { e as createComponent, f as createAstro, k as renderComponent, r as renderTemplate, m as maybeRenderHead, h as addAttribute, l as renderScript } from '../chunks/astro/server_C3VUefGl.mjs';
import 'kleur/colors';
import { $ as $$Base } from '../chunks/base_uF4SXvUR.mjs';
import { a as getCollection, f as getCalFenoData, h as generatePhenologicalHeatmap } from '../chunks/mongo_BayYJVct.mjs';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
/* empty css                                                 */
export { renderers } from '../renderers.mjs';

const CACHE_FILE = join(process.cwd(), "src", "data", "phenological-cache.json");
function shouldUpdateCache(lastUpdated) {
  const now = /* @__PURE__ */ new Date();
  const lastUpdate = new Date(lastUpdated);
  const isMonday = now.getDay() === 1;
  const weekInMs = 7 * 24 * 60 * 60 * 1e3;
  const weekPassed = now.getTime() - lastUpdate.getTime() > weekInMs;
  return isMonday && weekPassed;
}
async function loadCache() {
  try {
    if (!existsSync(CACHE_FILE)) {
      return null;
    }
    const cacheData = await readFile(CACHE_FILE, "utf-8");
    const cache = JSON.parse(cacheData);
    if (shouldUpdateCache(cache.lastUpdated)) {
      console.log("📅 Cache precisa ser atualizado - é segunda-feira");
      return null;
    }
    return cache;
  } catch (error) {
    console.error("❌ Erro ao carregar cache:", error);
    return null;
  }
}
async function generateCache() {
  try {
    console.log("🔄 Gerando cache taxonomico para calendario fenológico...");
    const calFeno = await getCollection("dwc2json", "calFeno");
    if (!calFeno) {
      throw new Error("Collection calFeno não disponível");
    }
    const families = await calFeno.distinct("family", { kingdom: "Plantae" });
    const cleanFamilies = families.filter((f) => f && f.trim() !== "").sort();
    const genera = {};
    for (const family of cleanFamilies) {
      const familyGenera = await calFeno.distinct("genus", {
        kingdom: "Plantae",
        family
      });
      genera[family] = familyGenera.filter((g) => g && g.trim() !== "").sort();
    }
    const species = {};
    for (const family of cleanFamilies) {
      for (const genus of genera[family] || []) {
        const key = `${family}|${genus}`;
        const familySpecies = await calFeno.distinct("canonicalName", {
          kingdom: "Plantae",
          family,
          genus
        });
        species[key] = familySpecies.filter((s) => s && s.trim() !== "").sort();
      }
    }
    const cache = {
      families: cleanFamilies,
      genera,
      species,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
    const fs = await import('fs');
    const cacheDir = join(process.cwd(), "src", "data");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log("✅ Cache taxonomico salvo com sucesso");
    return cache;
  } catch (error) {
    console.error("❌ Erro ao gerar cache:", error);
    throw error;
  }
}
async function getCachedFamilies() {
  try {
    let cache = await loadCache();
    if (!cache) {
      console.log("🔄 Cache não encontrado ou desatualizado, gerando novo cache...");
      try {
        cache = await generateCache();
      } catch (cacheError) {
        console.warn("⚠️  Falha ao gerar cache, usando fallback:", cacheError);
        const calFeno = await getCollection("dwc2json", "calFeno");
        if (!calFeno) {
          console.warn("⚠️  Collection calFeno não disponível");
          return [];
        }
        const families = await calFeno.distinct("family", { kingdom: "Plantae" });
        return families.filter((f) => f && f.trim() !== "").sort();
      }
    }
    return cache.families;
  } catch (error) {
    console.error("❌ Erro ao obter famílias em cache:", error);
    return [];
  }
}
async function getCachedGenera(family) {
  try {
    let cache = await loadCache();
    if (!cache) {
      try {
        cache = await generateCache();
      } catch (cacheError) {
        console.warn("⚠️  Falha ao gerar cache, usando fallback para gêneros:", cacheError);
        const calFeno = await getCollection("dwc2json", "calFeno");
        if (!calFeno) return [];
        const genera = await calFeno.distinct("genus", {
          kingdom: "Plantae",
          family
        });
        return genera.filter((g) => g && g.trim() !== "").sort();
      }
    }
    return cache.genera[family] || [];
  } catch (error) {
    console.error("❌ Erro ao obter gêneros em cache:", error);
    return [];
  }
}
async function getCachedSpecies(family, genus) {
  try {
    let cache = await loadCache();
    if (!cache) {
      try {
        cache = await generateCache();
      } catch (cacheError) {
        console.warn("⚠️  Falha ao gerar cache, usando fallback para espécies:", cacheError);
        const calFeno = await getCollection("dwc2json", "calFeno");
        if (!calFeno) return [];
        const species = await calFeno.distinct("canonicalName", {
          kingdom: "Plantae",
          family,
          genus
        });
        return species.filter((s) => s && s.trim() !== "").sort();
      }
    }
    const key = `${family}|${genus}`;
    return cache.species[key] || [];
  } catch (error) {
    console.error("❌ Erro ao obter espécies em cache:", error);
    return [];
  }
}

const $$Astro = createAstro();
const prerender = false;
const $$CalendarioFenologico = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$CalendarioFenologico;
  let families = [];
  let selectedFamily = "";
  let genera = [];
  let selectedGenus = "";
  let species = [];
  let selectedSpecies = "";
  let heatmapData = [];
  try {
    families = await getCachedFamilies();
    const url = new URL(Astro2.request.url);
    selectedFamily = url.searchParams.get("family") || "";
    selectedGenus = url.searchParams.get("genus") || "";
    selectedSpecies = url.searchParams.get("species") || "";
    if (selectedFamily) {
      genera = await getCachedGenera(selectedFamily);
      if (selectedGenus) {
        species = await getCachedSpecies(selectedFamily, selectedGenus);
        let filter = { family: selectedFamily, genus: selectedGenus };
        if (selectedSpecies) {
          filter.canonicalName = selectedSpecies;
        }
        const occurrences = await getCalFenoData(filter);
        heatmapData = generatePhenologicalHeatmap(occurrences);
      } else {
        const occurrences = await getCalFenoData({ family: selectedFamily });
        heatmapData = generatePhenologicalHeatmap(occurrences);
      }
    }
  } catch (error) {
    console.error("\u274C Error loading phenological data:", error);
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Base, { "title": "Calend\xE1rio Fenol\xF3gico", "data-astro-cid-osjqyddn": true }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="h-screen w-screen p-6" data-astro-cid-osjqyddn> <div class="max-w-6xl mx-auto" data-astro-cid-osjqyddn> <h1 class="text-3xl font-bold text-center mb-8 text-gray-800" data-astro-cid-osjqyddn>
Calendário Fenológico - Reino Plantae
</h1> <div class="mb-8" data-astro-cid-osjqyddn> <p class="text-gray-600 text-center mb-6" data-astro-cid-osjqyddn>
Visualize os períodos de floração das plantas através dos meses do ano. 
          Selecione uma família, gênero ou espécie para ver seu calendário fenológico.
</p> </div> <!-- Filtros Hierárquicos --> <div class="bg-white rounded-lg shadow-lg p-6 mb-8" data-astro-cid-osjqyddn> <h2 class="text-xl font-semibold mb-4" data-astro-cid-osjqyddn>Filtros Taxonômicos</h2> <div class="grid grid-cols-1 md:grid-cols-3 gap-4" data-astro-cid-osjqyddn> <!-- Seleção de Família --> <div data-astro-cid-osjqyddn> <label class="block text-sm font-medium text-gray-700 mb-2" data-astro-cid-osjqyddn>
Família
</label> <select id="family-select" class="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" data-astro-cid-osjqyddn> <option value="" data-astro-cid-osjqyddn>Selecione uma família</option> ${families.map((family) => renderTemplate`<option${addAttribute(family, "value")}${addAttribute(family === selectedFamily, "selected")} data-astro-cid-osjqyddn> ${family} </option>`)} </select> </div> <!-- Seleção de Gênero --> <div data-astro-cid-osjqyddn> <label class="block text-sm font-medium text-gray-700 mb-2" data-astro-cid-osjqyddn>
Gênero
</label> <select id="genus-select" class="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"${addAttribute(!selectedFamily, "disabled")} data-astro-cid-osjqyddn> <option value="" data-astro-cid-osjqyddn>Selecione um gênero</option> ${genera.map((genus) => renderTemplate`<option${addAttribute(genus, "value")}${addAttribute(genus === selectedGenus, "selected")} data-astro-cid-osjqyddn> ${genus} </option>`)} </select> </div> <!-- Seleção de Espécie --> <div data-astro-cid-osjqyddn> <label class="block text-sm font-medium text-gray-700 mb-2" data-astro-cid-osjqyddn>
Espécie
</label> <select id="species-select" class="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"${addAttribute(!selectedGenus, "disabled")} data-astro-cid-osjqyddn> <option value="" data-astro-cid-osjqyddn>Selecione uma espécie</option> ${species.map((sp) => renderTemplate`<option${addAttribute(sp, "value")}${addAttribute(sp === selectedSpecies, "selected")} data-astro-cid-osjqyddn> ${sp} </option>`)} </select> </div> </div> </div> <!-- Mapa de Calor Fenológico --> ${heatmapData.length > 0 && renderTemplate`<div class="bg-white rounded-lg shadow-lg p-6" data-astro-cid-osjqyddn> <h2 class="text-xl font-semibold mb-4" data-astro-cid-osjqyddn>
Calendário Fenológico
${selectedSpecies && ` - ${selectedSpecies}`} ${!selectedSpecies && selectedGenus && ` - ${selectedGenus}`} ${!selectedSpecies && !selectedGenus && selectedFamily && ` - ${selectedFamily}`} </h2> <div class="mb-4" data-astro-cid-osjqyddn> <p class="text-sm text-gray-600" data-astro-cid-osjqyddn>
Intensidade de floração por mês (baseado em ${heatmapData.reduce((sum, d) => sum + d.count, 0)} registros)
</p> </div> <div class="grid grid-cols-12 gap-2 mb-4" data-astro-cid-osjqyddn> ${heatmapData.map((data) => renderTemplate`<div class="text-center" data-astro-cid-osjqyddn> <div class="w-full h-20 rounded-lg border border-gray-200 flex items-center justify-center text-sm font-medium text-white transition-all duration-300"${addAttribute(`background-color: hsl(${120 - data.intensity * 60}, 70%, ${50 + data.intensity * 30}%)`, "style")}${addAttribute(`${data.monthName}: ${data.count} registros`, "title")} data-astro-cid-osjqyddn> ${data.count} </div> <div class="text-xs font-medium text-gray-600 mt-1" data-astro-cid-osjqyddn> ${data.monthName} </div> </div>`)} </div> <div class="flex items-center justify-between text-xs text-gray-500" data-astro-cid-osjqyddn> <span data-astro-cid-osjqyddn>Menor intensidade</span> <div class="flex items-center space-x-1" data-astro-cid-osjqyddn> <div class="w-4 h-4 bg-red-200 rounded" data-astro-cid-osjqyddn></div> <div class="w-4 h-4 bg-yellow-300 rounded" data-astro-cid-osjqyddn></div> <div class="w-4 h-4 bg-green-400 rounded" data-astro-cid-osjqyddn></div> <div class="w-4 h-4 bg-green-600 rounded" data-astro-cid-osjqyddn></div> <div class="w-4 h-4 bg-green-800 rounded" data-astro-cid-osjqyddn></div> </div> <span data-astro-cid-osjqyddn>Maior intensidade</span> </div> </div>`} ${!selectedFamily && renderTemplate`<div class="bg-gray-50 rounded-lg p-8 text-center" data-astro-cid-osjqyddn> <p class="text-gray-500 text-lg" data-astro-cid-osjqyddn>
Selecione uma família para visualizar o calendário fenológico
</p> </div>`} </div> </div> ${renderScript($$result2, "F:/git/DarwinCoreJSON/web/src/pages/calendario-fenologico.astro?astro&type=script&index=0&lang.ts")}  ` })}`;
}, "F:/git/DarwinCoreJSON/web/src/pages/calendario-fenologico.astro", void 0);

const $$file = "F:/git/DarwinCoreJSON/web/src/pages/calendario-fenologico.astro";
const $$url = "/calendario-fenologico";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$CalendarioFenologico,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
