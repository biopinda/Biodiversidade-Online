export { renderers } from '../../renderers.mjs';

async function GET({ request: { url } }) {
  const searchParams = new URL(url).searchParams;
  const scientificName = searchParams.get("scientificName");
  let json = [];
  if (scientificName) {
    json = await fetch(
      `https://api.gbif.org/v1/occurrence/search?scientificName=${scientificName}`
    ).then((res) => res.json());
  }
  return new Response(JSON.stringify(json), {
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
