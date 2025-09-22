import { c as countTaxaRegions } from '../../chunks/mongo_BayYJVct.mjs';
export { renderers } from '../../renderers.mjs';

const GET = async ({ url }) => {
  try {
    const params = url.searchParams;
    const filter = {};
    for (const [key, value] of params.entries()) {
      if (value.trim()) {
        filter[key] = value.trim();
      }
    }
    const regions = await countTaxaRegions(filter);
    if (!regions) {
      return new Response(
        JSON.stringify({ error: "Falha ao conectar ao banco de dados" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }
    return new Response(JSON.stringify(regions), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
