import { g as getFamilyPerKingdom } from '../../../chunks/mongo_BayYJVct.mjs';
export { renderers } from '../../../renderers.mjs';

const GET = async ({ params }) => {
  const { kingdom } = params;
  const data = await getFamilyPerKingdom(kingdom);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
