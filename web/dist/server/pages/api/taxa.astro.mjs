import { b as listTaxaPaginated } from '../../chunks/mongo_BayYJVct.mjs';
export { renderers } from '../../renderers.mjs';

async function GET({ request: { url } }) {
  const searchParams = new URL(url).searchParams;
  const filter = Object.fromEntries(
    Array.from(searchParams.entries()).map(([key, value]) => {
      if (key.endsWith("[]")) {
        return [key.slice(0, -2), [value.split(",")]];
      }
      if (value.startsWith("[") || value.startsWith("{")) {
        return [key, JSON.parse(value)];
      }
      return [key, value];
    })
  );
  if (filter.scientificName) {
    filter.scientificName = new RegExp(filter.scientificName, "i");
  }
  return new Response(JSON.stringify(await listTaxaPaginated(filter)), {
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
