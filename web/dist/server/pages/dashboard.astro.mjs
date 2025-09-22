import { e as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead, u as unescapeHTML, l as renderScript, h as addAttribute } from '../chunks/astro/server_C3VUefGl.mjs';
import 'kleur/colors';
import { $ as $$Base } from '../chunks/base_uF4SXvUR.mjs';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { i as getOccurrenceCountPerKingdom, j as getTaxaCountPerKingdom, k as getThreatenedCountPerKingdom, m as getThreatenedCategoriesPerKingdom, n as getInvasiveCountPerKingdom, o as getInvasiveTopOrders, p as getInvasiveTopFamilies, q as getTaxaCountPerOrderByKingdom, r as getTaxaCountPerFamilyByKingdom, s as getTopCollectionsByKingdom } from '../chunks/mongo_BayYJVct.mjs';
export { renderers } from '../renderers.mjs';

config();
async function generateDashboardCache() {
  console.log("Iniciando geração do cache do dashboard...");
  try {
    const [
      // Occurrences data
      occurrencesPlantae,
      occurrencesFungi,
      occurrencesAnimalia,
      // Taxa data
      taxaPlantae,
      taxaFungi,
      taxaAnimalia,
      // Threatened species data
      threatenedPlantae,
      threatenedFungi,
      threatenedAnimalia,
      // Threatened categories data
      threatenedCategoriesPlantae,
      threatenedCategoriesFungi,
      threatenedCategoriesAnimalia,
      // Invasive species data
      invasivePlantae,
      invasiveFungi,
      invasiveAnimalia,
      // Invasive top rankings
      invasiveTopOrdersAnimalia,
      invasiveTopFamiliesPlantae,
      // Taxa breakdown data
      taxaOrdersAnimalia,
      taxaFamiliesPlantae,
      taxaOrdersFungi,
      // Top collections data
      topCollectionsAnimalia,
      topCollectionsPlantae,
      topCollectionsFungi
    ] = await Promise.all([
      getOccurrenceCountPerKingdom("Plantae"),
      getOccurrenceCountPerKingdom("Fungi"),
      getOccurrenceCountPerKingdom("Animalia"),
      getTaxaCountPerKingdom("Plantae"),
      getTaxaCountPerKingdom("Fungi"),
      getTaxaCountPerKingdom("Animalia"),
      getThreatenedCountPerKingdom("Plantae"),
      getThreatenedCountPerKingdom("Fungi"),
      getThreatenedCountPerKingdom("Animalia"),
      getThreatenedCategoriesPerKingdom("Plantae"),
      getThreatenedCategoriesPerKingdom("Fungi"),
      getThreatenedCategoriesPerKingdom("Animalia"),
      getInvasiveCountPerKingdom("Plantae"),
      getInvasiveCountPerKingdom("Fungi"),
      getInvasiveCountPerKingdom("Animalia"),
      getInvasiveTopOrders("Animalia"),
      getInvasiveTopFamilies("Plantae"),
      getTaxaCountPerOrderByKingdom("Animalia"),
      getTaxaCountPerFamilyByKingdom("Plantae"),
      getTaxaCountPerOrderByKingdom("Fungi"),
      getTopCollectionsByKingdom("Animalia"),
      getTopCollectionsByKingdom("Plantae"),
      getTopCollectionsByKingdom("Fungi")
    ]);
    const dashboardData = {
      occurrences: {
        plantae: occurrencesPlantae,
        fungi: occurrencesFungi,
        animalia: occurrencesAnimalia
      },
      taxa: {
        plantae: taxaPlantae,
        fungi: taxaFungi,
        animalia: taxaAnimalia
      },
      threatened: {
        counts: {
          plantae: threatenedPlantae,
          fungi: threatenedFungi,
          animalia: threatenedAnimalia
        },
        categories: {
          plantae: threatenedCategoriesPlantae,
          fungi: threatenedCategoriesFungi,
          animalia: threatenedCategoriesAnimalia
        }
      },
      invasive: {
        counts: {
          plantae: invasivePlantae,
          fungi: invasiveFungi,
          animalia: invasiveAnimalia
        },
        topOrders: invasiveTopOrdersAnimalia,
        topFamilies: invasiveTopFamiliesPlantae
      },
      taxa_breakdown: {
        ordersAnimalia: taxaOrdersAnimalia,
        familiesPlantae: taxaFamiliesPlantae,
        ordersFungi: taxaOrdersFungi
      },
      top_collections: {
        animalia: topCollectionsAnimalia,
        plantae: topCollectionsPlantae,
        fungi: topCollectionsFungi
      },
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
    console.log("Cache do dashboard gerado com sucesso!");
    return dashboardData;
  } catch (error) {
    console.error("Erro ao gerar cache do dashboard:", error);
    throw error;
  }
}
async function saveDashboardCache(data, filePath) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    console.log(`Cache salvo em: ${filePath}`);
  } catch (error) {
    console.error("Erro ao salvar cache:", error);
    throw error;
  }
}
async function loadDashboardCache(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log("Arquivo de cache não encontrado:", filePath);
      return null;
    }
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Erro ao carregar cache:", error);
    return null;
  }
}
async function main() {
  try {
    console.log("=== JOB DE CACHE DO DASHBOARD ===");
    console.log(`Iniciado em: ${(/* @__PURE__ */ new Date()).toISOString()}`);
    const cacheFilePath = path.join(
      process.cwd(),
      "cache",
      "dashboard-data.json"
    );
    const data = await generateDashboardCache();
    await saveDashboardCache(data, cacheFilePath);
    console.log(`Job finalizado com sucesso em: ${(/* @__PURE__ */ new Date()).toISOString()}`);
  } catch (error) {
    console.error("Erro no job de cache do dashboard:", error);
    process.exit(1);
  }
}
main();

const $$Dashboard = createComponent(async ($$result, $$props, $$slots) => {
  let readmeContent = "";
  try {
    const possiblePaths = [
      path.resolve(process.cwd(), "../../../dashReadme.md"),
      path.resolve(process.cwd(), "../../dashReadme.md"),
      path.resolve(process.cwd().split("web")[0], "dashReadme.md"),
      path.resolve(process.cwd(), "../dashReadme.md"),
      path.resolve(process.cwd(), "./dashReadme.md"),
      path.resolve(__dirname, "../../../dashReadme.md"),
      path.resolve(__dirname, "../../../../dashReadme.md"),
      // Caminho direto baseado na estrutura conhecida
      "F:\\git\\DarwinCoreJSON\\dashReadme.md"
    ];
    let fileFound = false;
    for (const filePath of possiblePaths) {
      try {
        if (fs.existsSync(filePath)) {
          readmeContent = fs.readFileSync(filePath, "utf-8");
          console.log(`README carregado com sucesso de: ${filePath}`);
          fileFound = true;
          break;
        }
      } catch (pathError) {
        continue;
      }
    }
    if (!fileFound) {
      throw new Error("Arquivo dashReadme.md n\xE3o encontrado em nenhum dos caminhos");
    }
  } catch (error) {
    console.error("Erro ao carregar dashReadme.md:", error);
    readmeContent = `### Biodiversidade Online - Dashboard
Eduardo Dalcin e Henrique Pinheiro

#### Fontes de dados
* [Flora e Funga do Brasil](https://floradobrasil.jbrj.gov.br/consulta/).
* [Cat\xE1logo Taxon\xF4mico da Fauna do Brasil](http://fauna.jbrj.gov.br/)
* Banco de dados de esp\xE9cies invasoras do [Instituto H\xF3rus](https://institutohorus.org.br/).
* Esp\xE9cies da flora avaliadas quanto ao risco de extin\xE7\xE3o pelo [CNCFlora](https://cncflora.jbrj.gov.br/), at\xE9 2022.
* [FAUNA - Lista de Esp\xE9cies Amea\xE7adas - 2021](https://dados.mma.gov.br/dataset/especies-ameacadas/resource/544f9312-d4c6-4d12-b6ac-51bf3039bbb7)
* [Lista das UCs ativas no CNUC com respectivas categorias de manejo, \xE1rea, esfera de governo, ano de cria\xE7\xE3o e outras informa\xE7\xF5es. Dados atualizados at\xE9 mar\xE7o/2025](https://dados.mma.gov.br/dataset/unidadesdeconservacao/resource/f6bf9940-cf30-4ef2-927d-2bd278e4c8af).
* Registros de ocorr\xEAncia da fauna e flora, provenientes de cerca de 490 reposit\xF3rios (IPTs) - [lista](https://github.com/biopinda/DarwinCoreJSON/blob/main/referencias/occurrences.csv).`;
  }
  const categoryMapping = {
    "EX": "Extinta (EX)",
    "EW": "Extinta na Natureza (EW)",
    "CR": "Criticamente em Perigo (CR)",
    "EN": "Em Perigo (EN)",
    "VU": "Vulner\xE1vel (VU)",
    "NT": "Quase Amea\xE7ada (NT)",
    "LC": "Pouco Preocupante (LC)",
    "DD": "Dados Insuficientes (DD)",
    "NE": "N\xE3o Avaliada (NE)"
  };
  const validCategories = ["EX", "EW", "CR", "EN", "VU", "NT", "LC", "DD", "NE"];
  const faunaReverseMapping = {
    "Extinta (EX)": "EX",
    "Extinta na Natureza (EW)": "EW",
    "Criticamente em Perigo (CR)": "CR",
    "Em Perigo (EN)": "EN",
    "Vulner\xE1vel (VU)": "VU",
    "Quase Amea\xE7ada (NT)": "NT",
    "Pouco Preocupante (LC)": "LC",
    "Dados Insuficientes (DD)": "DD",
    "N\xE3o Avaliada (NE)": "NE"
  };
  function filterAndMapCategories(categories) {
    if (!categories) return [];
    return categories.filter((category) => validCategories.includes(category._id)).map((category) => ({
      ...category,
      displayName: categoryMapping[category._id] || category._id
    }));
  }
  function filterAndMapFaunaCategories(categories) {
    if (!categories) return [];
    return categories.filter((category) => {
      const code = faunaReverseMapping[category._id];
      return code && validCategories.includes(code);
    }).map((category) => ({
      ...category,
      displayName: category._id
      // Já está no formato completo
    }));
  }
  function processMarkdown(content) {
    return content.replace(/^### (.*)$/gm, '<h3 class="text-lg font-medium text-gray-800 mb-3 mt-4 pb-1 border-b border-gray-200">$1</h3>').replace(/^#### (.*)$/gm, '<h4 class="text-base font-medium text-blue-700 mb-2 mt-3">$1</h4>').replace(/^##### (.*)$/gm, '<h5 class="text-sm font-medium text-gray-600 mb-2 mt-3">$1</h5>').replace(/^## (.*)$/gm, '<h2 class="text-xl font-semibold text-gray-800 mb-3 mt-6 pb-1 border-b border-gray-200">$1</h2>').replace(/^# (.*)$/gm, '<h1 class="text-2xl font-bold text-gray-800 mb-4">$1</h1>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-800 underline text-sm" target="_blank" rel="noopener noreferrer">$1</a>').replace(/^\* (.*)$/gm, '<li class="text-gray-600 text-sm leading-relaxed">$1</li>').replace(/(<li[^>]*>.*<\/li>\s*)+/gs, '<ul class="mb-3 ml-4 list-disc space-y-1">$&</ul>').replace(/\n\n/g, '</p><p class="mb-3 text-gray-600 text-sm leading-relaxed">').replace(/\n/g, "<br>").replace(/^(?!<[hul])/gm, '<p class="mb-3 text-gray-600 text-sm leading-relaxed">').replace(/(?<!>)$/gm, "</p>").replace(/<p class="mb-3 text-gray-600 text-sm leading-relaxed"><\/p>/g, "");
  }
  const cacheFilePath = path.join(process.cwd(), "cache", "dashboard-data.json");
  const dashboardData = await loadDashboardCache(cacheFilePath);
  if (!dashboardData) {
    return new Response(null, { status: 503 });
  }
  const occurrencesPlantae = dashboardData.occurrences.plantae;
  const occurrencesFungi = dashboardData.occurrences.fungi;
  const occurrencesAnimalia = dashboardData.occurrences.animalia;
  const taxaPlantae = dashboardData.taxa.plantae;
  const taxaFungi = dashboardData.taxa.fungi;
  const taxaAnimalia = dashboardData.taxa.animalia;
  const threatenedPlantae = dashboardData.threatened.counts.plantae;
  const threatenedFungi = dashboardData.threatened.counts.fungi;
  const threatenedAnimalia = dashboardData.threatened.counts.animalia;
  const threatenedCategoriesPlantae = dashboardData.threatened.categories.plantae;
  const threatenedCategoriesFungi = dashboardData.threatened.categories.fungi;
  const threatenedCategoriesAnimalia = dashboardData.threatened.categories.animalia;
  const invasivePlantae = dashboardData.invasive.counts.plantae;
  const invasiveFungi = dashboardData.invasive.counts.fungi;
  const invasiveAnimalia = dashboardData.invasive.counts.animalia;
  const invasiveTopOrdersAnimalia = dashboardData.invasive.topOrders;
  const invasiveTopFamiliesPlantae = dashboardData.invasive.topFamilies;
  const taxaOrdersAnimalia = dashboardData.taxa_breakdown.ordersAnimalia;
  const taxaFamiliesPlantae = dashboardData.taxa_breakdown.familiesPlantae;
  const taxaOrdersFungi = dashboardData.taxa_breakdown.ordersFungi;
  const topCollectionsAnimalia = dashboardData.top_collections.animalia;
  const topCollectionsPlantae = dashboardData.top_collections.plantae;
  const topCollectionsFungi = dashboardData.top_collections.fungi;
  return renderTemplate`${renderComponent($$result, "Layout", $$Base, { "title": "Dashboard" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="h-screen w-screen p-2"> <h1 class="text-3xl font-bold text-center mb-4">Biodiversidade On-line</h1> <!-- Tabs Navigation --> <div class="flex border-b border-gray-200 mb-4"> <button class="tab-button px-6 py-3 font-medium text-sm border-b-2 border-blue-500 text-blue-600 bg-white" data-tab="taxa">
Taxa
</button> <button class="tab-button px-6 py-3 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 bg-white" data-tab="ocorrencias">
Ocorrências
</button> <button class="tab-button px-6 py-3 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 bg-white" data-tab="ameacadas">
Espécies Ameaçadas
</button> <button class="tab-button px-6 py-3 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 bg-white" data-tab="invasoras">
Espécies Invasoras
</button> <button class="tab-button px-6 py-3 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 bg-white" data-tab="sobre">
Sobre
</button> </div> <!-- Tab Contents --> <div class="tab-content h-full"> <!-- Taxa Tab --> <div id="taxa-content" class="tab-panel"> <div class="grid grid-cols-1 md:grid-cols-3 gap-6 h-full"> <!-- Card Animalia --> <div class="bg-white rounded-lg border border-slate-300 shadow-lg p-6 min-h-[500px]"> <div class="flex items-center justify-center mb-4"> <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center"> <img src="/animalia.svg" alt="Animalia" class="w-12 h-12 text-blue-600"> </div> </div> <h3 class="text-2xl font-bold text-gray-800 mb-2 text-center">Animalia</h3> <p class="text-4xl font-bold text-blue-600 mb-2 text-center">${taxaAnimalia?.toLocaleString()}</p> <p class="text-gray-500 text-center mb-3">nomes aceitos</p> ${taxaOrdersAnimalia && taxaOrdersAnimalia.length > 0 ? renderTemplate`<div class="space-y-2 max-h-80 overflow-y-auto"> <p class="text-sm font-semibold text-gray-700">Top 10 Ordens:</p> ${taxaOrdersAnimalia.map((order) => renderTemplate`<div class="flex justify-between text-sm"> <span class="text-gray-600 truncate pr-2">${order._id}</span> <span class="text-blue-600 font-medium">${order.count.toLocaleString()}</span> </div>`)} </div>` : renderTemplate`<p class="text-gray-400 text-sm text-center">dados não disponíveis</p>`} </div> <!-- Card Plantae --> <div class="bg-white rounded-lg border border-slate-300 shadow-lg p-6 min-h-[500px]"> <div class="flex items-center justify-center mb-4"> <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center"> <img src="/plantae.svg" alt="Plantae" class="w-12 h-12 text-green-600"> </div> </div> <h3 class="text-2xl font-bold text-gray-800 mb-2 text-center">Plantae</h3> <p class="text-4xl font-bold text-green-600 mb-2 text-center">${taxaPlantae?.toLocaleString()}</p> <p class="text-gray-500 text-center mb-3">nomes aceitos</p> ${taxaFamiliesPlantae && taxaFamiliesPlantae.length > 0 ? renderTemplate`<div class="space-y-2 max-h-80 overflow-y-auto"> <p class="text-sm font-semibold text-gray-700">Top 10 Famílias:</p> ${taxaFamiliesPlantae.map((family) => renderTemplate`<div class="flex justify-between text-sm"> <span class="text-gray-600 truncate pr-2">${family._id}</span> <span class="text-green-600 font-medium">${family.count.toLocaleString()}</span> </div>`)} </div>` : renderTemplate`<p class="text-gray-400 text-sm text-center">dados não disponíveis</p>`} </div> <!-- Card Fungi --> <div class="bg-white rounded-lg border border-slate-300 shadow-lg p-6 min-h-[500px]"> <div class="flex items-center justify-center mb-4"> <div class="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center"> <img src="/fungi.svg" alt="Fungi" class="w-12 h-12 text-orange-600"> </div> </div> <h3 class="text-2xl font-bold text-gray-800 mb-2 text-center">Fungi</h3> <p class="text-4xl font-bold text-orange-600 mb-2 text-center">${taxaFungi?.toLocaleString()}</p> <p class="text-gray-500 text-center mb-3">nomes aceitos</p> ${taxaOrdersFungi && taxaOrdersFungi.length > 0 ? renderTemplate`<div class="space-y-2 max-h-80 overflow-y-auto"> <p class="text-sm font-semibold text-gray-700">Top 10 Ordens:</p> ${taxaOrdersFungi.map((order) => renderTemplate`<div class="flex justify-between text-sm"> <span class="text-gray-600 truncate pr-2">${order._id}</span> <span class="text-orange-600 font-medium">${order.count.toLocaleString()}</span> </div>`)} </div>` : renderTemplate`<p class="text-gray-400 text-sm text-center">dados não disponíveis</p>`} </div> </div> </div> <!-- Ocorrências Tab --> <div id="ocorrencias-content" class="tab-panel hidden"> <div class="grid grid-cols-1 md:grid-cols-3 gap-6 h-full"> <!-- Card Animalia --> <div class="bg-white rounded-lg border border-slate-300 shadow-lg p-6 min-h-[500px]"> <div class="flex items-center justify-center mb-4"> <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center"> <img src="/animalia.svg" alt="Animalia" class="w-12 h-12 text-blue-600"> </div> </div> <h3 class="text-2xl font-bold text-gray-800 mb-2 text-center">Animalia</h3> <p class="text-4xl font-bold text-blue-600 mb-2 text-center">${occurrencesAnimalia?.toLocaleString()}</p> <p class="text-gray-500 text-center mb-3">ocorrências registradas</p> ${topCollectionsAnimalia && topCollectionsAnimalia.length > 0 ? renderTemplate`<div class="space-y-2 max-h-80 overflow-y-auto"> <p class="text-sm font-semibold text-gray-700">Top 10 Coleções:</p> ${topCollectionsAnimalia.map((collection) => renderTemplate`<div class="flex justify-between text-sm"> <span class="text-gray-600 truncate pr-2 text-xs"${addAttribute(collection._id, "title")}>${collection._id}</span> <span class="text-blue-600 font-medium">${collection.count.toLocaleString()}</span> </div>`)} </div>` : renderTemplate`<p class="text-gray-400 text-sm text-center">dados não disponíveis</p>`} </div> <!-- Card Plantae --> <div class="bg-white rounded-lg border border-slate-300 shadow-lg p-6 min-h-[500px]"> <div class="flex items-center justify-center mb-4"> <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center"> <img src="/plantae.svg" alt="Plantae" class="w-12 h-12 text-green-600"> </div> </div> <h3 class="text-2xl font-bold text-gray-800 mb-2 text-center">Plantae</h3> <p class="text-4xl font-bold text-green-600 mb-2 text-center">${occurrencesPlantae?.toLocaleString()}</p> <p class="text-gray-500 text-center mb-3">ocorrências registradas</p> ${topCollectionsPlantae && topCollectionsPlantae.length > 0 ? renderTemplate`<div class="space-y-2 max-h-80 overflow-y-auto"> <p class="text-sm font-semibold text-gray-700">Top 10 Coleções:</p> ${topCollectionsPlantae.map((collection) => renderTemplate`<div class="flex justify-between text-sm"> <span class="text-gray-600 truncate pr-2 text-xs"${addAttribute(collection._id, "title")}>${collection._id}</span> <span class="text-green-600 font-medium">${collection.count.toLocaleString()}</span> </div>`)} </div>` : renderTemplate`<p class="text-gray-400 text-sm text-center">dados não disponíveis</p>`} </div> <!-- Card Fungi --> <div class="bg-white rounded-lg border border-slate-300 shadow-lg p-6 min-h-[500px]"> <div class="flex items-center justify-center mb-4"> <div class="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center"> <img src="/fungi.svg" alt="Fungi" class="w-12 h-12 text-orange-600"> </div> </div> <h3 class="text-2xl font-bold text-gray-800 mb-2 text-center">Fungi</h3> <p class="text-4xl font-bold text-orange-600 mb-2 text-center">${occurrencesFungi?.toLocaleString()}</p> <p class="text-gray-500 text-center mb-3">ocorrências registradas</p> ${topCollectionsFungi && topCollectionsFungi.length > 0 ? renderTemplate`<div class="space-y-2 max-h-80 overflow-y-auto"> <p class="text-sm font-semibold text-gray-700">Top 10 Coleções:</p> ${topCollectionsFungi.map((collection) => renderTemplate`<div class="flex justify-between text-sm"> <span class="text-gray-600 truncate pr-2 text-xs"${addAttribute(collection._id, "title")}>${collection._id}</span> <span class="text-orange-600 font-medium">${collection.count.toLocaleString()}</span> </div>`)} </div>` : renderTemplate`<p class="text-gray-400 text-sm text-center">dados não disponíveis</p>`} </div> </div> </div> <!-- Espécies Ameaçadas Tab --> <div id="ameacadas-content" class="tab-panel hidden"> <div class="grid grid-cols-1 md:grid-cols-3 gap-6 h-full"> <!-- Card Animalia Ameaçada --> <div class="bg-white rounded-lg border border-slate-300 shadow-lg p-6 min-h-[500px]"> <div class="flex items-center justify-center mb-4"> <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center"> <img src="/animalia.svg" alt="Animalia" class="w-12 h-12 text-red-600" style="filter: hue-rotate(240deg) saturate(2);"> </div> </div> <h3 class="text-2xl font-bold text-gray-800 mb-2 text-center">Animalia</h3> <p class="text-4xl font-bold text-red-600 mb-2 text-center">${threatenedAnimalia?.toLocaleString()}</p> <p class="text-gray-500 text-center mb-1">espécies ameaçadas</p> ${threatenedAnimalia && taxaAnimalia ? renderTemplate`<p class="text-sm text-gray-400 text-center mb-3">
(${(threatenedAnimalia / taxaAnimalia * 100).toFixed(1)}% do total)
</p>` : renderTemplate`<div class="mb-3"></div>`} ${(() => {
    const filteredCategories = filterAndMapFaunaCategories(threatenedCategoriesAnimalia);
    return filteredCategories && filteredCategories.length > 0 ? renderTemplate`<div class="space-y-2 max-h-80 overflow-y-auto"> <p class="text-sm font-semibold text-gray-700">Por categoria:</p> ${filteredCategories.map((category) => renderTemplate`<div class="flex justify-between text-sm"> <span class="text-gray-600 truncate pr-2">${category.displayName}</span> <span class="text-red-600 font-medium">${category.count}</span> </div>`)} </div>` : renderTemplate`<p class="text-gray-400 text-sm text-center">dados não disponíveis</p>`;
  })()} </div> <!-- Card Plantae Ameaçada --> <div class="bg-white rounded-lg border border-slate-300 shadow-lg p-6 min-h-[500px]"> <div class="flex items-center justify-center mb-4"> <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center"> <img src="/plantae.svg" alt="Plantae" class="w-12 h-12 text-red-600" style="filter: hue-rotate(240deg) saturate(2);"> </div> </div> <h3 class="text-2xl font-bold text-gray-800 mb-2 text-center">Plantae</h3> <p class="text-4xl font-bold text-red-600 mb-2 text-center">${threatenedPlantae?.toLocaleString()}</p> <p class="text-gray-500 text-center mb-1">espécies ameaçadas</p> ${threatenedPlantae && taxaPlantae ? renderTemplate`<p class="text-sm text-gray-400 text-center mb-3">
(${(threatenedPlantae / taxaPlantae * 100).toFixed(1)}% do total)
</p>` : renderTemplate`<div class="mb-3"></div>`} ${(() => {
    const filteredCategories = filterAndMapCategories(threatenedCategoriesPlantae);
    return filteredCategories && filteredCategories.length > 0 ? renderTemplate`<div class="space-y-2 max-h-80 overflow-y-auto"> <p class="text-sm font-semibold text-gray-700">Por categoria:</p> ${filteredCategories.map((category) => renderTemplate`<div class="flex justify-between text-sm"> <span class="text-gray-600 truncate pr-2">${category.displayName}</span> <span class="text-red-600 font-medium">${category.count}</span> </div>`)} </div>` : renderTemplate`<p class="text-gray-400 text-sm text-center">dados não disponíveis</p>`;
  })()} </div> <!-- Card Fungi Ameaçada --> <div class="bg-white rounded-lg border border-slate-300 shadow-lg p-6 min-h-[500px]"> <div class="flex items-center justify-center mb-4"> <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center"> <img src="/fungi.svg" alt="Fungi" class="w-12 h-12 text-gray-500"> </div> </div> <h3 class="text-2xl font-bold text-gray-800 mb-2 text-center">Fungi</h3> <p class="text-4xl font-bold text-gray-500 mb-2 text-center">${threatenedFungi?.toLocaleString()}</p> <p class="text-gray-500 text-center mb-1">espécies ameaçadas</p> ${threatenedFungi && taxaFungi ? renderTemplate`<p class="text-sm text-gray-400 text-center mb-3">
(${(threatenedFungi / taxaFungi * 100).toFixed(1)}% do total)
</p>` : renderTemplate`<div class="mb-3"></div>`} ${(() => {
    const filteredCategories = filterAndMapCategories(threatenedCategoriesFungi);
    return filteredCategories && filteredCategories.length > 0 ? renderTemplate`<div class="space-y-2 max-h-80 overflow-y-auto"> <p class="text-sm font-semibold text-gray-700">Por categoria:</p> ${filteredCategories.map((category) => renderTemplate`<div class="flex justify-between text-sm"> <span class="text-gray-600 truncate pr-2">${category.displayName}</span> <span class="text-gray-500 font-medium">${category.count}</span> </div>`)} </div>` : renderTemplate`<p class="text-gray-400 text-sm text-center">dados não disponíveis</p>`;
  })()} </div> </div> </div> <!-- Espécies Invasoras Tab --> <div id="invasoras-content" class="tab-panel hidden"> <div class="grid grid-cols-1 md:grid-cols-3 gap-6 h-full"> <!-- Card Animalia Invasora --> <div class="bg-white rounded-lg border border-slate-300 shadow-lg p-6 min-h-[600px]"> <div class="flex items-center justify-center mb-4"> <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center"> <img src="/animalia.svg" alt="Animalia" class="w-12 h-12 text-purple-600" style="filter: hue-rotate(180deg) saturate(1.5);"> </div> </div> <h3 class="text-2xl font-bold text-gray-800 mb-2 text-center">Animalia</h3> <p class="text-4xl font-bold text-purple-600 mb-2 text-center">${invasiveAnimalia?.toLocaleString()}</p> <p class="text-gray-500 text-center mb-3">espécies invasoras</p> ${invasiveTopOrdersAnimalia && invasiveTopOrdersAnimalia.length > 0 ? renderTemplate`<div class="space-y-2 max-h-96 overflow-y-auto"> <p class="text-sm font-semibold text-gray-700">Top 10 Ordens:</p> ${invasiveTopOrdersAnimalia.map((order) => renderTemplate`<div class="flex justify-between text-sm"> <span class="text-gray-600 truncate pr-2">${order._id}</span> <span class="text-purple-600 font-medium">${order.count}</span> </div>`)} </div>` : renderTemplate`<p class="text-gray-400 text-sm text-center">dados não disponíveis</p>`} </div> <!-- Card Plantae Invasora --> <div class="bg-white rounded-lg border border-slate-300 shadow-lg p-6 min-h-[600px]"> <div class="flex items-center justify-center mb-4"> <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center"> <img src="/plantae.svg" alt="Plantae" class="w-12 h-12 text-purple-600" style="filter: hue-rotate(180deg) saturate(1.5);"> </div> </div> <h3 class="text-2xl font-bold text-gray-800 mb-2 text-center">Plantae</h3> <p class="text-4xl font-bold text-purple-600 mb-2 text-center">${invasivePlantae?.toLocaleString()}</p> <p class="text-gray-500 text-center mb-3">espécies invasoras</p> ${invasiveTopFamiliesPlantae && invasiveTopFamiliesPlantae.length > 0 ? renderTemplate`<div class="space-y-2 max-h-96 overflow-y-auto"> <p class="text-sm font-semibold text-gray-700">Top 10 Famílias:</p> ${invasiveTopFamiliesPlantae.map((family) => renderTemplate`<div class="flex justify-between text-sm"> <span class="text-gray-600 truncate pr-2">${family._id}</span> <span class="text-purple-600 font-medium">${family.count}</span> </div>`)} </div>` : renderTemplate`<p class="text-gray-400 text-sm text-center">dados não disponíveis</p>`} </div> <!-- Card Fungi Invasora --> <div class="bg-white rounded-lg border border-slate-300 shadow-lg p-6 min-h-[600px]"> <div class="flex items-center justify-center mb-4"> <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center"> <img src="/fungi.svg" alt="Fungi" class="w-12 h-12 text-purple-600" style="filter: hue-rotate(180deg) saturate(1.5);"> </div> </div> <h3 class="text-2xl font-bold text-gray-800 mb-2 text-center">Fungi</h3> <p class="text-4xl font-bold text-purple-600 mb-2 text-center">${invasiveFungi?.toLocaleString()}</p> <p class="text-gray-500 text-center mb-3">espécies invasoras</p> </div> </div> </div> <!-- Sobre Tab --> <div id="sobre-content" class="tab-panel hidden"> <div class="bg-white rounded-lg border border-slate-300 shadow-lg h-full overflow-auto"> <div class="max-w-3xl mx-auto p-6"> <div class="bg-gray-50 rounded-lg p-4 border border-gray-200"> <div class="markdown-content text-sm"> <div>${unescapeHTML(processMarkdown(readmeContent))}</div> </div> </div> </div> </div> </div> </div> </div> ${renderScript($$result2, "F:/git/DarwinCoreJSON/web/src/pages/dashboard.astro?astro&type=script&index=0&lang.ts")} ` })}`;
}, "F:/git/DarwinCoreJSON/web/src/pages/dashboard.astro", void 0);

const $$file = "F:/git/DarwinCoreJSON/web/src/pages/dashboard.astro";
const $$url = "/dashboard";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Dashboard,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
