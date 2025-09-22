import { e as createComponent, f as createAstro, k as renderComponent, r as renderTemplate, m as maybeRenderHead, h as addAttribute, n as Fragment, o as renderTransition } from '../chunks/astro/server_C3VUefGl.mjs';
import 'kleur/colors';
import { $ as $$Base } from '../chunks/base_uF4SXvUR.mjs';
import { t as countTaxa, b as listTaxaPaginated } from '../chunks/mongo_BayYJVct.mjs';
/* empty css                                     */
export { renderers } from '../renderers.mjs';

const $$Astro = createAstro();
const $$Taxa = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Taxa;
  const taxaNum = await countTaxa() ?? 0;
  const searchParams = Object.fromEntries(
    Array.from(Astro2.url.searchParams.entries())
  );
  const filter = structuredClone(searchParams);
  if (filter.scientificName !== void 0) {
    filter.scientificName = new RegExp(filter.scientificName, "i");
  }
  delete filter.page;
  let taxa = [];
  let total = 0;
  let totalPages = 0;
  const currentPage = searchParams.page ? +searchParams.page : 1;
  if (Object.keys(searchParams).length > 0) {
    ({
      data: taxa,
      total,
      totalPages
    } = await listTaxaPaginated(
      filter,
      searchParams.page ? +searchParams.page - 1 : 0,
      {
        }
    ) ?? { data: [], total: 0, totalPages: 0 });
  }
  const searchParamsWithPage = (page) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    return `?${params.toString()}`;
  };
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$Base, { "title": "Procura de Taxa" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="m-2 p-2 border rounded border-slate-400 inline-block"> <h2 class="text-xl font-bold">Filtro</h2> <form class="inline-flex flex-col gap-1"> <div class="row"> <label for="scientificName">Nome Completo ou Gênero</label> <input id="scientificName" name="scientificName" type="text" class="border border-green-800 rounded p-1"${addAttribute(searchParams.scientificName, "value")}> </div> <div class="flex justify-between items-center"> <div>Taxa disponíveis: <b>${taxaNum}</b></div> <input class="p-1 px-2 rounded bg-green-800 text-white" type="submit" value="Filtrar"> </div> </form> </section> ${taxa.length > 0 && renderTemplate`<section class="m-2"> <div class="flex flex-row items-center pb-2 gap-2"> <h2 class="text-xl font-bold">
Resultados${total > 0 && renderTemplate`${renderComponent($$result2, "Fragment", Fragment, {}, { "default": async ($$result3) => renderTemplate`: ${total}` })}`} </h2> <a class="p-1 px-2 rounded bg-green-800 text-white hover:drop-shadow"${addAttribute(`/api/taxa?scientificName=${searchParams.scientificName}`, "href")}${addAttribute(`${searchParams.scientificName}.json`, "download")}> <li class="las la-save"></li>
Baixar em JSON
</a> <div class="grow"></div> ${totalPages > 1 && renderTemplate`${renderComponent($$result2, "Fragment", Fragment, {}, { "default": async ($$result3) => renderTemplate` <div class="text-sm italic">
Página ${currentPage} / ${totalPages} </div> <div class="flex flex-row gap-1"> ${currentPage > 1 && renderTemplate`<a class="p-1 px-2 rounded bg-green-800 text-white"${addAttribute(searchParamsWithPage(currentPage - 1), "href")}>
Anterior
</a>`} ${currentPage < totalPages && renderTemplate`<a class="p-1 px-2 rounded bg-green-800 text-white"${addAttribute(searchParamsWithPage(currentPage + 1), "href")}>
Próxima
</a>`} </div> ` })}`} </div> <ul class="grid grid-cols-2 gap-2"> ${taxa.map((taxon) => {
    const pageId = `${taxon.kingdom[0]?.toUpperCase()}${taxon.taxonID}`;
    return renderTemplate`<li class="border border-slate-400 rounded p-1"> <a class="text-green-800"${addAttribute(`/taxon/${taxon.kingdom[0]?.toUpperCase()}${taxon.taxonID}`, "href")}${addAttribute(renderTransition($$result2, "at46cy6d", "", `hero-${pageId}`), "data-astro-transition-scope")}> ${taxon.scientificName} </a> <a class="text-blue-600"${addAttribute(`/taxon/${pageId}.json`, "href")}>
(json)
</a> </li>`;
  })} </ul> </section>`}` })}`;
}, "F:/git/DarwinCoreJSON/web/src/pages/taxa.astro", "self");

const $$file = "F:/git/DarwinCoreJSON/web/src/pages/taxa.astro";
const $$url = "/taxa";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Taxa,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
