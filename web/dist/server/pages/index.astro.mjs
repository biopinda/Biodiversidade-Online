import { e as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_C3VUefGl.mjs';
import 'kleur/colors';
import { $ as $$Base } from '../chunks/base_uF4SXvUR.mjs';
export { renderers } from '../renderers.mjs';

const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Base, { "title": "Flora e Funga do Brasil" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="h-screen v-screen flex flex-col items-center justify-center"> <div>
Acesse a <a class="text-green-800 font-bold" href="/taxa">página de pesquisa de taxa</a> para buscas
</div> </div> ` })}`;
}, "F:/git/DarwinCoreJSON/web/src/pages/index.astro", void 0);

const $$file = "F:/git/DarwinCoreJSON/web/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
