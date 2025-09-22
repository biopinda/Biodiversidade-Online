import { e as createComponent, r as renderTemplate, k as renderComponent } from '../chunks/astro/server_C3VUefGl.mjs';
import 'kleur/colors';
import { $ as $$Base } from '../chunks/base_uF4SXvUR.mjs';
export { renderers } from '../renderers.mjs';

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a;
const $$Tree = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate(_a || (_a = __template(['<script src="/d3.min.js"><\/script> <script src="/arf.js"><\/script> ', ""])), renderComponent($$result, "BaseLayout", $$Base, { "title": "\xC1rvore Taxon\xF4mica" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "TreeComponent", null, { "client:only": "react", "client:component-hydration": "only", "client:component-path": "F:/git/DarwinCoreJSON/web/src/components/Tree.tsx", "client:component-export": "default" })} ` }));
}, "F:/git/DarwinCoreJSON/web/src/pages/tree.astro", void 0);

const $$file = "F:/git/DarwinCoreJSON/web/src/pages/tree.astro";
const $$url = "/tree";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Tree,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
