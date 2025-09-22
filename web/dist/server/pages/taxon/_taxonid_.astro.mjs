import { e as createComponent, f as createAstro, m as maybeRenderHead, h as addAttribute, r as renderTemplate, k as renderComponent, o as renderTransition } from '../../chunks/astro/server_C3VUefGl.mjs';
import 'kleur/colors';
import 'clsx';
import { u as getTaxon } from '../../chunks/mongo_BayYJVct.mjs';
/* empty css                                        */
import { $ as $$Base } from '../../chunks/base_uF4SXvUR.mjs';
export { renderers } from '../../renderers.mjs';

const $$Astro$5 = createAstro();
const $$FichaLink = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$5, $$props, $$slots);
  Astro2.self = $$FichaLink;
  const { kingdom, id } = Astro2.props;
  return renderTemplate`${renderTemplate`${maybeRenderHead()}<a class="text-green-800 underline hover:text-green-600" target="blank"${addAttribute(`${kingdom === "Animalia" ? "http://fauna.jbrj.gov.br/fauna/listaBrasil/FichaPublicaTaxonUC/FichaPublicaTaxonUC.do?id=" : "https://floradobrasil.jbrj.gov.br/consulta/ficha.html?idDadosListaBrasil="}${id}`, "href")}><i class="la la-file-alt"></i> Ficha na${" "}${kingdom === "Animalia" ? "Cat\xE1logo Taxon\xF4mico da Fauna do Brasil" : "Flora e Funga do Brasil"}</a>`}`;
}, "F:/git/DarwinCoreJSON/web/src/components/FichaLink.astro", void 0);

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a;
const $$Astro$4 = createAstro();
const $$Map = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$4, $$props, $$slots);
  Astro2.self = $$Map;
  const { full, stateList } = Astro2.props;
  const data = Astro2.props.data ?? (stateList && [
    ["Estado", "Ocorr\xEAncia"],
    ...stateList.map((state) => [state, state])
  ]);
  return renderTemplate(_a || (_a = __template([`<script type="module">
  import 'https://cdn.skypack.dev/@google-web-components/google-chart'
<\/script> `, ""])), renderComponent($$result, "google-chart", "google-chart", { "class": full ? "w-full h-full" : "h-[200px] w-auto", "type": "geo", "data": JSON.stringify(data), "options": '{"region":"BR", "resolution":"provinces","title":"Ocorr\xEAncias"}' }));
}, "F:/git/DarwinCoreJSON/web/src/components/Map.astro", void 0);

const $$Astro$3 = createAstro();
const $$TaxonLink = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$3, $$props, $$slots);
  Astro2.self = $$TaxonLink;
  const { kingdom, taxonId } = Astro2.props;
  const taxon = await getTaxon(kingdom, taxonId);
  return renderTemplate`${maybeRenderHead()}<a${addAttribute(`/taxon/${kingdom[0].toUpperCase()}${taxonId}`, "href")} class="text-green-800 underline">${taxon?.scientificName ?? "??"}</a>`;
}, "F:/git/DarwinCoreJSON/web/src/components/TaxonLink.astro", void 0);

const $$Astro$2 = createAstro();
const $$Section = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$Section;
  const { title, kingdom, fields } = Astro2.props;
  const filteredFieldsArray = Object.entries(fields).reduce(
    (acc, [name, data], _, array) => {
      if (!name.endsWith(" ID")) {
        if (array.some(([otherName]) => otherName === `${name} ID`)) {
          return acc;
        }
      }
      acc.push({ name, data });
      return acc;
    },
    []
  );
  return renderTemplate`${maybeRenderHead()}<section> ${title && filteredFieldsArray.length > 0 && renderTemplate`<h2 class="pt-2 font-bold">${title}</h2>`} ${filteredFieldsArray.map(({ name, data }) => {
    return data && renderTemplate`<div> <span class="font-semibold">${name.replace(" ID", "")}:</span>${" "} <span> ${typeof data === "string" ? name.endsWith(" ID") ? renderTemplate`${renderComponent($$result, "TaxonLink", $$TaxonLink, { "kingdom": kingdom, "taxonId": data })}` : data : renderTemplate`<a${addAttribute(data.link, "href")} class="text-green-800 underline"> ${data.text} </a>`} </span> </div>`;
  })} </section>`;
}, "F:/git/DarwinCoreJSON/web/src/components/Section.astro", void 0);

const $$Astro$1 = createAstro();
const $$Taxon = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$Taxon;
  const { pageId, json } = Astro2.props;
  const fichaId = json.kingdom === "Animalia" ? json.bibliographicCitation?.match(/.+\/(\w+)/)?.[1] ?? "" : json.taxonID;
  return renderTemplate`${maybeRenderHead()}<div class="m-4 w-full lg:w-[960px] bg-white shadow-lg border-slate-200 border rounded"> <div class="bg-green-800 text-white p-4 mb-4 rounded-t sticky top-0 z-10 flex gap-4 items-center"> <a href="/taxa" class="p-1 px-2 bg-white text-black rounded-lg hover:text-green-800 whitespace-nowrap"><i class="las la-search"></i> Busca</a> <h1 class="font-bold text-lg"${addAttribute(renderTransition($$result, "i3n7i2wr", "", `hero-${pageId}`), "data-astro-transition-scope")}> ${json.scientificName} </h1> <div class="flex-1"></div> ${json.occurrences?.length > 0 && renderTemplate`<a${addAttribute(`/taxon/${pageId}/ocorrencias`, "href")} class="p-1 px-2 bg-white text-black rounded-lg hover:text-green-800 whitespace-nowrap"> <i class="las la-th-list"></i> Ocorrências
</a>`} </div> <div class="grid grid-cols-1 lg:grid-cols-2 p-4 gap-2"> ${renderComponent($$result, "Section", $$Section, { "kingdom": json.kingdom, "fields": {
    TaxonID: json.taxonID,
    "Nome cient\xEDfico": json.scientificName,
    "Nome cient\xEDfico autor": json.scientificNameAuthorship,
    "Nome aceito": json.acceptedNameUsage,
    "Nome aceito ID": json.acceptedNameUsageID,
    "Nome original ID": json.originalNameUsageID,
    "Nome publicado em": json.namePublishedIn,
    "Nome publicado em ano": {
      link: `/taxa?namePublishedInYear=${json.namePublishedInYear}`,
      text: json.namePublishedInYear
    },
    Reino: { link: `/taxa?kingdom=${json.kingdom}`, text: json.kingdom },
    Grupo: {
      link: `/taxa?higherClassification=${json.higherClassification}`,
      text: json.higherClassification
    },
    Fam\u00EDlia: { link: `/taxa?family=${json.family}`, text: json.family },
    G\u00EAnero: { link: `/taxa?genus=${json.genus}`, text: json.genus },
    "Ep\xEDteto espec\xEDfico": json.specificEpithet,
    Rank: json.taxonRank,
    "Status taxon\xF4mico": json.taxonomicStatus,
    "Status nomenclatural": json.nomenclaturalStatus,
    Modificado: json.modified,
    "Cita\xE7\xE3o bibliogr\xE1fica": json.bibliographicCitation
  } })} ${Object.keys(json.distribution?.occurrence ?? {}).length > 0 && renderTemplate`<section class="flex flex-col"> ${json.distribution?.occurrence && renderTemplate`<div> ${renderComponent($$result, "Map", $$Map, { "stateList": json.distribution.occurrence })} </div>`} <div> ${renderComponent($$result, "Section", $$Section, { "title": "Distribui\xE7\xE3o", "fields": {
    Origem: json.distribution?.origin,
    Endemismo: json.distribution?.endemism,
    "Dom\xEDnios fitogeogr\xE1ficos": json.distribution?.phytogeographicDomains?.join(", "),
    Ocorr\u00EAncia: json.distribution?.occurrence?.sort().join(", "),
    "Tipo de vegeta\xE7\xE3o": json.distribution?.vegetationType?.join(", ")
  } })} </div> </section>`} ${json.othernames?.length > 0 && renderTemplate`<details> <summary class="pt-2 font-bold">Outros nomes</summary> <ul class="list-disc list-inside"> ${json.othernames?.map(({ taxonID, taxonomicStatus }) => renderTemplate`<li class="pl-2"> ${renderComponent($$result, "TaxonLink", $$TaxonLink, { "kingdom": json.kingdom, "taxonId": taxonID })} -${" "} ${taxonomicStatus} </li>`)} </ul> </details>`} ${json.vernacularname && renderTemplate`<details> <summary class="pt-2 font-bold">Nomes vernaculares</summary> <ul class="list-disc pl-5"> ${json.vernacularname.sort(
    (a, b) => a.vernacularName?.localeCompare(b.vernacularName ?? "") ?? 0
  ).map(({ vernacularName, language, locality }) => renderTemplate`<li> ${vernacularName}, ${locality} -${" "} <span class="text-xs italic">${language}</span> </li>`)} </ul> </details>`} </div> <footer class="p-2 col-span-2 bg-slate-100 rounded-b" title="Referência"> ${json.reference?.length > 0 && renderTemplate`<div class="italic"> ${json.reference?.map(({ creator, bibliographicCitation }) => renderTemplate`<div> ${[creator, bibliographicCitation].filter(Boolean).join(", ")} </div>`)} </div>`} ${renderComponent($$result, "FichaLink", $$FichaLink, { "kingdom": json.kingdom, "id": fichaId })} </footer> </div>`;
}, "F:/git/DarwinCoreJSON/web/src/components/Taxon.astro", "self");

const $$Astro = createAstro();
const $$taxonId = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$taxonId;
  const { taxonId } = Astro2.params;
  const [kingdomId, id] = [taxonId[0], taxonId.slice(1)];
  const kingdom = {
    P: "Plantae",
    F: "Fungi",
    A: "Animalia"
  }[kingdomId];
  const taxon = kingdom && await getTaxon(kingdom, id, true);
  return renderTemplate`${renderComponent($$result, "Layout", $$Base, { "useTransition": true, "title": `Taxon: ${taxon ? taxon.scientificName : `<n\xE3o encontrado (${taxonId})>`}`, "metaDescription": taxon?.scientificName ? `Flora e Funga do Brasil: ${taxon.scientificName}` : null, "bodyClasses": "bg-green-100" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="flex flex-row justify-center items-start"> ${taxon ? renderTemplate`${renderComponent($$result2, "Taxon", $$Taxon, { "pageId": taxonId, "json": taxon })}` : renderTemplate`<p>Taxon não encontrado</p>`} </div> ` })}`;
}, "F:/git/DarwinCoreJSON/web/src/pages/taxon/[taxonId].astro", void 0);

const $$file = "F:/git/DarwinCoreJSON/web/src/pages/taxon/[taxonId].astro";
const $$url = "/taxon/[taxonId]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$taxonId,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
