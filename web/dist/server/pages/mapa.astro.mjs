import { e as createComponent, h as addAttribute, k as renderComponent, r as renderTemplate } from '../chunks/astro/server_C3VUefGl.mjs';
import 'kleur/colors';
import { jsx, jsxs } from 'react/jsx-runtime';
import { useRef, useEffect, useState, useCallback } from 'react';
import { twMerge } from 'tailwind-merge';
import { g as cn, S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, f as SelectItem, B as Button } from '../chunks/select_DW06wDgX.mjs';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { X, Plus } from 'lucide-react';
import { s as styles } from '../chunks/mapa.9ac0fc02_Cy-DXr1N.mjs';
export { renderers } from '../renderers.mjs';

const Map = ({ full, stateList, className = "", data: propData }) => {
  const chartRef = useRef(null);
  const data = propData ?? (stateList && [
    ["Estado", "Ocorrência"],
    ...stateList.map((state) => [state, state])
  ]);
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.skypack.dev/@google-web-components/google-chart";
    script.type = "module";
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);
  useEffect(() => {
    if (chartRef.current && data) {
      const chart = document.createElement("google-chart");
      chart.setAttribute("type", "geo");
      chart.setAttribute("data", JSON.stringify(data));
      chart.setAttribute(
        "options",
        JSON.stringify({
          region: "BR",
          resolution: "provinces",
          title: "Ocorrências"
        })
      );
      chart.className = full ? "w-full h-full" : "h-[200px] w-auto";
      chartRef.current.innerHTML = "";
      chartRef.current.appendChild(chart);
    }
  }, [data, full, className]);
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: twMerge(
        full ? "w-full h-full" : "h-[200px] w-auto",
        className
      ),
      ref: chartRef
    }
  );
};

function Card({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-slot": "card",
      className: cn(
        "bg-card text-card-foreground rounded-xl border shadow-sm",
        className
      ),
      ...props
    }
  );
}

function Popover({
  ...props
}) {
  return /* @__PURE__ */ jsx(PopoverPrimitive.Root, { "data-slot": "popover", ...props });
}
function PopoverTrigger({
  ...props
}) {
  return /* @__PURE__ */ jsx(PopoverPrimitive.Trigger, { "data-slot": "popover-trigger", ...props });
}
function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}) {
  return /* @__PURE__ */ jsx(PopoverPrimitive.Portal, { children: /* @__PURE__ */ jsx(
    PopoverPrimitive.Content,
    {
      "data-slot": "popover-content",
      align,
      sideOffset,
      className: cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 rounded-md border p-4 shadow-md outline-hidden",
        className
      ),
      ...props
    }
  ) });
}

function FilterSelect({
  value,
  availableFields,
  onChange,
  className
}) {
  return /* @__PURE__ */ jsxs(
    Select,
    {
      value,
      onValueChange: (value2) => onChange(value2),
      children: [
        /* @__PURE__ */ jsx(SelectTrigger, { className: `text-nowrap ${className}`, children: /* @__PURE__ */ jsx(SelectValue, { placeholder: "Campo" }) }),
        /* @__PURE__ */ jsx(SelectContent, { children: availableFields.map((field) => /* @__PURE__ */ jsx(SelectItem, { value: field, children: field.slice(0, 1).toUpperCase() + field.slice(1) }, field)) })
      ]
    }
  );
}

function SimpleSelect({
  values,
  onChange,
  value,
  nullOptionLabel,
  placeholder = "Selecione uma opção",
  className
}) {
  return /* @__PURE__ */ jsxs(
    Select,
    {
      value: value ?? "<clear>",
      onValueChange: (value2) => onChange(value2 === "<clear>" ? null : value2),
      children: [
        /* @__PURE__ */ jsx(SelectTrigger, { className, children: /* @__PURE__ */ jsx(SelectValue, { placeholder }) }),
        /* @__PURE__ */ jsxs(SelectContent, { children: [
          nullOptionLabel && /* @__PURE__ */ jsx(SelectItem, { value: "<clear>", children: nullOptionLabel }, ""),
          values.map(({ label, value: value2 }) => /* @__PURE__ */ jsx(SelectItem, { value: value2, children: label }, value2))
        ] })
      ]
    }
  );
}

const KINGDOM_OPTIONS = [
  { label: "Plantae", value: "Plantae" },
  { label: "Fungi", value: "Fungi" },
  { label: "Animalia", value: "Animalia" }
];
function FilterPopover({ onFilterChange }) {
  const [filters, setFilters] = useState([]);
  const [open, setOpen] = useState(false);
  const inputRefs = useRef([]);
  const availableFields = [
    "reino",
    "filo",
    "classe",
    "ordem",
    "superfamília",
    "família",
    "gênero",
    "epíteto específico"
  ];
  const usedFields = new Set(filters.map((f) => f.field));
  const remainingFields = availableFields.filter(
    (field) => !usedFields.has(field)
  );
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const validFilters = filters.filter((filter) => filter.value !== "");
      onFilterChange(validFilters);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [filters, onFilterChange]);
  const addFilter = () => {
    const firstAvailableField = remainingFields[0];
    if (!firstAvailableField) return;
    const newFilter = {
      field: firstAvailableField,
      value: ""
    };
    setFilters([...filters, newFilter]);
  };
  const removeFilter = (index) => {
    const newFilters = filters.filter((_, i) => i !== index);
    setFilters(newFilters);
  };
  const updateFilter = (index, updates) => {
    const newFilters = [...filters];
    if (newFilters[index]) {
      newFilters[index] = { ...newFilters[index], ...updates };
      setFilters(newFilters);
      if (updates.field && updates.field !== "reino") {
        setTimeout(() => {
          console.log("focusing", inputRefs.current[index]);
          inputRefs.current[index]?.focus();
        }, 10);
      }
    }
  };
  return /* @__PURE__ */ jsxs(Popover, { open, onOpenChange: setOpen, children: [
    /* @__PURE__ */ jsx(PopoverTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(Button, { variant: "outline", className: "w-[180px]", children: [
      "Filtros (",
      filters.length,
      ")"
    ] }) }),
    /* @__PURE__ */ jsxs(PopoverContent, { className: "w-[300px] p-4 space-y-1", children: [
      filters.map((filter, index) => {
        const availableFieldsForSelect = [filter.field, ...remainingFields];
        return /* @__PURE__ */ jsxs("div", { className: "flex items-center", children: [
          /* @__PURE__ */ jsx(
            FilterSelect,
            {
              className: "w-[90px] rounded-e-none border-e-0 shadow-none shrink-0",
              value: filter.field,
              onChange: (value) => updateFilter(index, { field: value }),
              availableFields: availableFieldsForSelect
            }
          ),
          filter.field === "reino" ? /* @__PURE__ */ jsx(
            SimpleSelect,
            {
              className: "flex-1 rounded-s-none",
              value: filter.value || null,
              onChange: (value) => updateFilter(index, { value: value || "" }),
              values: KINGDOM_OPTIONS,
              placeholder: "Selecione um reino"
            }
          ) : /* @__PURE__ */ jsx(
            "input",
            {
              ref: (el) => {
                inputRefs.current[index] = el;
              },
              type: "text",
              value: filter.value,
              onChange: (e) => updateFilter(index, { value: e.target.value }),
              className: "flex h-9 pr-8 w-full rounded-e-md border border-input bg-transparent px-3 py-1 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              placeholder: "Digite o valor..."
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              className: "shrink-0 w-6",
              variant: "ghost",
              size: "icon",
              onClick: () => removeFilter(index),
              children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4" })
            }
          )
        ] }, index);
      }),
      remainingFields.length > 0 && /* @__PURE__ */ jsxs(Button, { variant: "outline", className: "mt-2 w-full", onClick: addFilter, children: [
        /* @__PURE__ */ jsx(Plus, { className: "mr-2 h-4 w-4" }),
        "Adicionar filtro"
      ] })
    ] })
  ] });
}

const numberFormatter = new Intl.NumberFormat();
const fieldToParam = {
  reino: "kingdom",
  filo: "phylum",
  classe: "class",
  ordem: "order",
  superfamília: "superfamily",
  família: "family",
  gênero: "genus",
  "epíteto específico": "specificEpithet"
};
function MapFilter({ onFilterChange, totalCount }) {
  const handleFilterChange = useCallback(
    (filters) => {
      const params = {};
      filters.forEach((filter) => {
        if (filter.value) {
          params[fieldToParam[filter.field]] = filter.value;
        }
      });
      onFilterChange(params);
    },
    [onFilterChange]
  );
  return /* @__PURE__ */ jsxs(Card, { className: "p-2 flex gap-2 items-center rounded-none", children: [
    /* @__PURE__ */ jsx(FilterPopover, { onFilterChange: handleFilterChange }),
    /* @__PURE__ */ jsx("div", { className: "flex-1" }),
    /* @__PURE__ */ jsxs("div", { className: "font-semibold", children: [
      "Total: ",
      numberFormatter.format(totalCount)
    ] })
  ] });
}

function MapPage() {
  const [taxaData, setTaxaData] = useState({
    total: 0,
    regions: []
  });
  const [error, setError] = useState(null);
  const fetchRegions = async (filter) => {
    try {
      const params = new URLSearchParams(filter);
      const response = await fetch(`/api/taxaCountByState?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Falha ao carregar dados dos estados");
      }
      const data = await response.json();
      setTaxaData(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao carregar dados dos estados"
      );
    }
  };
  const handleFilterChange = useCallback((filters) => {
    fetchRegions(filters);
  }, []);
  useEffect(() => {
    fetchRegions({});
  }, []);
  return /* @__PURE__ */ jsxs("div", { className: "h-screen w-screen flex flex-col overflow-hidden", children: [
    /* @__PURE__ */ jsx(
      MapFilter,
      {
        onFilterChange: handleFilterChange,
        totalCount: taxaData.total
      }
    ),
    error ? /* @__PURE__ */ jsx("div", { className: "flex-1 flex items-center justify-center text-red-500", children: error }) : /* @__PURE__ */ jsx(
      Map,
      {
        className: "flex-1",
        full: true,
        data: [
          ["Estado", "Taxa"],
          ...taxaData.regions.map(
            ({ _id, count }) => [_id, count]
          )
        ]
      }
    )
  ] });
}

const $$Mapa = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`<link rel="stylesheet"${addAttribute(styles, "href")}>${renderComponent($$result, "MapPage", MapPage, { "client:idle": true, "client:component-hydration": "idle", "client:component-path": "F:/git/DarwinCoreJSON/web/src/components/MapPage.tsx", "client:component-export": "default" })}`;
}, "F:/git/DarwinCoreJSON/web/src/pages/mapa.astro", void 0);

const $$file = "F:/git/DarwinCoreJSON/web/src/pages/mapa.astro";
const $$url = "/mapa";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Mapa,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
