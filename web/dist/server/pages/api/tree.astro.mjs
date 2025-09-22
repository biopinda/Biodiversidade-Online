import { e as getTree } from '../../chunks/mongo_BayYJVct.mjs';
export { renderers } from '../../renderers.mjs';

async function GET() {
  return new Response(JSON.stringify(await getTree()), {
    headers: {
      "Content-Type": "application/json"
    }
  });
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
