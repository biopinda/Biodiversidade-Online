import { e as createComponent, f as createAstro, k as renderComponent, r as renderTemplate, m as maybeRenderHead, h as addAttribute } from '../../../chunks/astro/server_C3VUefGl.mjs';
import 'kleur/colors';
import { $ as $$Base } from '../../../chunks/base_uF4SXvUR.mjs';
import { u as getTaxon } from '../../../chunks/mongo_BayYJVct.mjs';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState } from 'react';
export { renderers } from '../../../renderers.mjs';

function TableHeader({
  title,
  onClick,
  sorted
}) {
  return /* @__PURE__ */ jsxs(
    "th",
    {
      className: "sticky top-0 px-2 z-10 bg-gray-200 text-left",
      onClick,
      children: [
        title,
        sorted ? /* @__PURE__ */ jsxs("span", { className: "text-slate-600", children: [
          " ",
          sorted === 1 ? "▲" : "▼"
        ] }) : ""
      ]
    }
  );
}
function Ocorrencias({ occurrences }) {
  const [selectedOccurrence, setSelectedOccurrence] = useState("");
  const [sortedOccurrences, setSortedOccurrences] = useState(occurrences);
  const [sortedBy, setSortedBy] = useState({ field: "", direction: 1 });
  const resortOccurrences = (byField) => {
    const direction = sortedBy.field === byField ? sortedBy.direction * -1 : 1;
    const sorted = [...occurrences].sort((a, b) => {
      if ((a[byField] ?? "") < (b[byField] ?? "")) return -1 * direction;
      if ((a[byField] ?? "") > (b[byField] ?? "")) return 1 * direction;
      return 0;
    });
    setSortedOccurrences(sorted);
    setSortedBy({ field: byField, direction });
  };
  const occurrence = occurrences.find(
    (occurrence2) => occurrence2._id === selectedOccurrence
  );
  return /* @__PURE__ */ jsxs("div", { className: "grid gap-2 grid-cols-1 lg:grid-cols-2 border border-slate-200 h-full overflow-y-auto", children: [
    /* @__PURE__ */ jsx("div", { className: "overflow-auto h-64 lg:h-auto border-b lg:border-r lg:border-b-0 border-slate-200 lg:row-span-2", children: /* @__PURE__ */ jsxs("table", { className: "border-collapse w-full cursor-default", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx(
          TableHeader,
          {
            title: "ipt",
            onClick: () => {
              resortOccurrences("ipt");
            },
            sorted: sortedBy.field === "ipt" ? sortedBy.direction : void 0
          }
        ),
        /* @__PURE__ */ jsx(
          TableHeader,
          {
            title: "inst.",
            onClick: () => {
              resortOccurrences("institutionCode");
            },
            sorted: sortedBy.field === "institutionCode" ? sortedBy.direction : void 0
          }
        ),
        /* @__PURE__ */ jsx(
          TableHeader,
          {
            title: "país",
            onClick: () => {
              resortOccurrences("country");
            },
            sorted: sortedBy.field === "country" ? sortedBy.direction : void 0
          }
        ),
        /* @__PURE__ */ jsx(
          TableHeader,
          {
            title: "estado",
            onClick: () => {
              resortOccurrences("stateProvince");
            },
            sorted: sortedBy.field === "stateProvince" ? sortedBy.direction : void 0
          }
        ),
        /* @__PURE__ */ jsx(
          TableHeader,
          {
            title: "município",
            onClick: () => {
              resortOccurrences("municipality");
            },
            sorted: sortedBy.field === "municipality" ? sortedBy.direction : void 0
          }
        )
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: sortedOccurrences.map((occurrence2) => /* @__PURE__ */ jsxs(
        "tr",
        {
          className: selectedOccurrence === occurrence2._id ? "bg-blue-600 text-white sticky top-6 bottom-0" : "",
          onClick: () => {
            setSelectedOccurrence(occurrence2._id);
          },
          children: [
            /* @__PURE__ */ jsx("td", { className: "px-2", children: occurrence2.ipt }),
            /* @__PURE__ */ jsx("td", { className: "px-2", children: occurrence2.institutionCode }),
            /* @__PURE__ */ jsx("td", { className: "px-2", children: occurrence2.country }),
            /* @__PURE__ */ jsx("td", { className: "px-2", children: occurrence2.stateProvince }),
            /* @__PURE__ */ jsx("td", { className: "px-2", children: occurrence2.municipality })
          ]
        },
        occurrence2._id
      )) })
    ] }) }),
    /* @__PURE__ */ jsx("div", { className: "mt-2 p-2 w-full h-64 lg:h-auto overflow-y-auto break-words", children: Object.entries(occurrence ?? {}).map(([key, value]) => /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsxs("span", { className: "font-bold", children: [
        key,
        ": "
      ] }),
      Array.isArray(value) ? value.map((item) => /* @__PURE__ */ jsx("div", { className: "border-l-4 border-slate-800 ml-2 pl-2", children: Object.entries(item).map(([_key, _value]) => /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("span", { className: "font-bold", children: [
          _key,
          ": "
        ] }),
        /* @__PURE__ */ jsx("span", { children: _value })
      ] })) })) : typeof value === "object" ? /* @__PURE__ */ jsx("span", { children: JSON.stringify(value) }) : /* @__PURE__ */ jsx("span", { children: value })
    ] })) }),
    /* @__PURE__ */ jsx("div", { className: "grid gap-2 items-start grid-cols-2 md:grid-cols-3 lg:grid-cols-4", children: occurrence?.multimedia?.map(
      ({ identifier, rightsHolder, created }) => /* @__PURE__ */ jsx("div", { className: "relative", children: /* @__PURE__ */ jsxs("a", { href: `https://${identifier}`, target: "_blank", children: [
        /* @__PURE__ */ jsx("img", { src: `https://${identifier}`, alt: rightsHolder }),
        /* @__PURE__ */ jsx("div", { className: "absolute bottom-0 right-0 left-0 bg-gray-200 text-xs px-2", children: created })
      ] }) })
    ) })
  ] });
}

const $$Astro = createAstro();
const $$Ocorrencias = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Ocorrencias;
  const { taxonId } = Astro2.params;
  const [kingdomId, id] = [taxonId[0], taxonId.slice(1)];
  const kingdom = {
    P: "Plantae",
    F: "Fungi",
    A: "Animalia"
  }[kingdomId];
  const taxon = kingdom && await getTaxon(kingdom, id, true);
  return renderTemplate`${renderComponent($$result, "Layout", $$Base, { "useTransition": true, "title": `Taxon: ${taxon ? taxon.scientificName : `<n\xE3o encontrado (${taxonId})>`}`, "metaDescription": taxon?.scientificName ? `Flora e Funga do Brasil: ${taxon.scientificName}` : null, "bodyClasses": "bg-green-100" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="flex flex-row justify-center items-start"> <div class="mt-4 lg:mt-0 lg:top-4 lg:absolute lg:bottom-0 w-full lg:w-[960px] bg-white shadow-lg border-slate-200 border rounded"> <div class="bg-green-800 text-white p-4 rounded-t sticky top-0 z-10 flex gap-4 items-center"> <a href="/taxa" class="p-1 px-2 bg-white text-black rounded-lg hover:text-green-800 whitespace-nowrap"><i class="las la-search"></i> Busca</a> <a${addAttribute(`/taxon/${taxonId}`, "href")} class="font-bold text-lg"> ${taxon.scientificName} </a> <div class="flex-1"></div> <div class="p-1 px-2 bg-white text-green-800 rounded-lg hover:text-green-800 whitespace-nowrap font-bold cursor-default"> <i class="las la-th-list"></i> Ocorrências
</div> </div> <div class="h-auto lg:h-[calc(100vh-81px)]"> ${renderComponent($$result2, "OcorrenciasComponent", Ocorrencias, { "occurrences": taxon.occurrences?.map(({ _id, ...occurrence }) => ({
    _id: _id?.toString(),
    ...occurrence
  })) ?? [], "client:idle": true, "client:component-hydration": "idle", "client:component-path": "F:/git/DarwinCoreJSON/web/src/components/ocorrencias", "client:component-export": "default" })} </div> </div> </div> ` })}`;
}, "F:/git/DarwinCoreJSON/web/src/pages/taxon/[taxonId]/ocorrencias.astro", void 0);

const $$file = "F:/git/DarwinCoreJSON/web/src/pages/taxon/[taxonId]/ocorrencias.astro";
const $$url = "/taxon/[taxonId]/ocorrencias";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Ocorrencias,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
