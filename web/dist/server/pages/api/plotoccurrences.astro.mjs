import { l as listOccurrences } from '../../chunks/mongo_BayYJVct.mjs';
export { renderers } from '../../renderers.mjs';

const getOccurrencePlot = async (query) => {
  const { canonicalName, lat, long, maxDistance } = query;
  const filter = {};
  if (canonicalName) filter.canonicalName = new RegExp(canonicalName, "i");
  if (lat && long) {
    filter.geoPoint = {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [long, lat]
        },
        $maxDistance: maxDistance ?? 1e3
      }
    };
  } else if (!canonicalName) {
    return null;
  }
  const data = await listOccurrences(filter);
  return data.reduce(
    (acc, cur) => {
      if (cur.geoPoint) {
        acc.features.push({
          type: "Feature",
          properties: {
            scientificName: cur.scientificName,
            locality: cur.locality,
            country: cur.country,
            stateProvince: cur.stateProvince,
            county: cur.county,
            recordedBy: cur.recordedBy,
            eventDate: cur.eventDate,
            catalogNumber: cur.catalogNumber,
            decimalLatitude: cur.decimalLatitude,
            decimalLongitude: cur.decimalLongitude
          },
          geometry: cur.geoPoint
        });
      }
      return acc;
    },
    {
      type: "FeatureCollection",
      features: []
    }
  );
};

async function GET({ request: { url } }) {
  const searchParams = new URL(url).searchParams;
  const [canonicalName, lat, long, maxDistance] = [
    searchParams.get("canonicalName") ?? "",
    searchParams.get("lat"),
    searchParams.get("long"),
    searchParams.get("maxDistance")
  ];
  const data = await getOccurrencePlot({
    canonicalName,
    ...lat && long ? { lat: +lat, long: +long } : {},
    ...maxDistance ? { maxDistance: +maxDistance } : {}
  });
  if (!data) {
    return new Response(
      "Either canonicalName or Latitude and longitude are required",
      {
        status: 400
      }
    );
  }
  return new Response(JSON.stringify(data), {
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
