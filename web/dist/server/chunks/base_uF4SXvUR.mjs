import { e as createComponent, f as createAstro, h as addAttribute, l as renderScript, r as renderTemplate, p as renderHead, q as renderSlot, k as renderComponent } from './astro/server_C3VUefGl.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                       */

const $$Astro$1 = createAstro();
const $$ClientRouter = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$ClientRouter;
  const { fallback = "animate" } = Astro2.props;
  return renderTemplate`<meta name="astro-view-transitions-enabled" content="true"><meta name="astro-view-transitions-fallback"${addAttribute(fallback, "content")}>${renderScript($$result, "F:/git/DarwinCoreJSON/web/node_modules/.pnpm/astro@5.13.5_@types+node@22_9dae374f75b7b09dde1676337edd23b3/node_modules/astro/components/ClientRouter.astro?astro&type=script&index=0&lang.ts")}`;
}, "F:/git/DarwinCoreJSON/web/node_modules/.pnpm/astro@5.13.5_@types+node@22_9dae374f75b7b09dde1676337edd23b3/node_modules/astro/components/ClientRouter.astro", void 0);

const $$Astro = createAstro();
const $$Base = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Base;
  const { title, useTransition, metaDescription, bodyClasses } = Astro2.props;
  return renderTemplate`<html lang="pt-BR"> <head><meta charset="UTF-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="description"${addAttribute(metaDescription ?? "Base de Dados Integrada da Biodiversidade Brasileira - ChatBB", "content")}><link rel="icon" type="image/png" href="/favicon.png"><link rel="stylesheet" href="https://maxst.icons8.com/vue-static/landings/line-awesome/line-awesome/1.3.0/css/line-awesome.min.css">${useTransition && renderTemplate`${renderComponent($$result, "ClientRouter", $$ClientRouter, {})}`}<!-- Matomo -->${renderScript($$result, "F:/git/DarwinCoreJSON/web/src/layouts/base.astro?astro&type=script&index=0&lang.ts")}<!-- End Matomo Code -->${renderHead()}</head> <body${addAttribute(bodyClasses ?? "", "class")}> ${renderSlot($$result, $$slots["default"])} </body></html>`;
}, "F:/git/DarwinCoreJSON/web/src/layouts/base.astro", void 0);

export { $$Base as $ };
