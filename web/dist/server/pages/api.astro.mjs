import { e as createComponent, k as renderComponent, r as renderTemplate } from '../chunks/astro/server_C3VUefGl.mjs';
import 'kleur/colors';
import { $ as $$Base } from '../chunks/base_uF4SXvUR.mjs';
export { renderers } from '../renderers.mjs';

const $$Api = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$Base, { "title": "API - Documenta\xE7\xE3o" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "SwaggerDocs", null, { "client:only": "react", "client:component-hydration": "only", "client:component-path": "F:/git/DarwinCoreJSON/web/src/components/SwaggerDocs", "client:component-export": "default" })}` })}`;
}, "F:/git/DarwinCoreJSON/web/src/pages/api.astro", void 0);

const $$file = "F:/git/DarwinCoreJSON/web/src/pages/api.astro";
const $$url = "/api";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Api,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
