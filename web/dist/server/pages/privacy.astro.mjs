import { e as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_C3VUefGl.mjs';
import 'kleur/colors';
import { $ as $$Base } from '../chunks/base_uF4SXvUR.mjs';
export { renderers } from '../renderers.mjs';

const $$Privacy = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Base, { "title": "Dwca2JSON: Pol\xEDtica de Privacidade" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="flex flex-row justify-center items-startmin-h-screen"> <div class="w-full md:w-[700px] p-8"> <div class="font-bold text-2xl">
Política de Privacidade para o Dwca2JSON
</div> <p class="text-sm">
Última Atualização: <span class="italic">10 de Novembro de 2023</span> </p> <p class="mt-8">
Bem-vindo(a) ao Dwca2JSON, uma plataforma dedicada à exploração da rica
        diversidade da flora brasileira. Esta política de privacidade descreve
        nossas práticas em relação à coleta, uso e divulgação de informações
        através do nosso website.
</p> <ol class="list-decimal ml-4"> <li class="mt-4"> <div class="font-bold text-l">
Coleta e Uso de Informações No Dwca2JSON
</div>
Estamos comprometidos em proteger a privacidade de nossos usuários.
          Nosso serviço foi desenvolvido para fornecer informações taxonômicas
          sobre a flora brasileira sem a necessidade de coletar informações
          pessoais de nossos visitantes.
</li> <li class="mt-4"> <div class="font-bold text-l">
Cookies e Tecnologia de Rastreamento
</div>
Utilizamos cookies exclusivamente para rastrear visitas ao nosso
          website. Esses cookies não coletam informações pessoais. Em vez disso,
          eles nos ajudam a entender como nosso site está sendo usado,
          permitindo-nos melhorar a experiência do usuário e a qualidade do
          serviço.
</li> <li class="mt-4"> <div class="font-bold text-l">Segurança dos Dados</div>
Tomamos medidas razoáveis para proteger os dados que coletamos por
          meio de cookies de acesso não autorizado, uso, alteração ou
          destruição.
</li> <li class="mt-4"> <div class="font-bold text-l">
Alterações nesta Política dePrivacidade
</div>
Podemos atualizar nossa Política de Privacidade de tempos em tempos.
          Notificaremos você sobre quaisquer alterações, publicando a nova
          Política de Privacidade nesta página. Encorajamos você a revisar esta
          Política de Privacidade periodicamente para quaisquer mudanças.
</li> </ol> </div> </div> ` })}`;
}, "F:/git/DarwinCoreJSON/web/src/pages/privacy.astro", void 0);

const $$file = "F:/git/DarwinCoreJSON/web/src/pages/privacy.astro";
const $$url = "/privacy";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Privacy,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
