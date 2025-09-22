import { MongoClient } from 'mongodb';

const url = (
  // @ts-ignore ignore node stuff
  process.env.MONGO_URI ?? // @ts-ignore astro stuff
  (typeof globalThis !== "undefined" && globalThis.process?.env?.MONGO_URI)
);
if (!url) {
  console.error("❌ MONGO_URI environment variable is not defined");
  throw new Error(
    "Please define the MONGO_URI environment variable inside .env.local"
  );
}
const client = new MongoClient(url);
function connectClientWithTimeout(timeout = 5e3) {
  return new Promise((resolve) => {
    const timeoutTimer = setTimeout(() => {
      console.warn("⚠️  MongoDB connection timeout after", timeout, "ms");
      resolve(false);
    }, timeout);
    client.connect().then(
      () => {
        console.log("✅ MongoDB connected successfully");
        resolve(true);
      },
      (error) => {
        console.error("❌ MongoDB connection failed:", error.message);
        resolve(false);
      }
    ).finally(() => {
      clearTimeout(timeoutTimer);
    });
  });
}
async function getCollection(dbName, collection) {
  try {
    if (!await connectClientWithTimeout()) {
      console.warn(
        `⚠️  Could not connect to MongoDB for ${dbName}.${collection}`
      );
      return null;
    }
    return client.db(dbName).collection(collection);
  } catch (error) {
    console.error(`❌ Error getting collection ${dbName}.${collection}:`, error);
    return null;
  }
}
async function listOccurrences(filter = {}, _projection = {}) {
  try {
    const occurrences = await getCollection("dwc2json", "ocorrencias");
    if (!occurrences) {
      console.warn("⚠️  Occurrences collection not available");
      return [];
    }
    return await occurrences.find(filter).toArray();
  } catch (error) {
    console.error("❌ Error listing occurrences:", error);
    return [];
  }
}
async function listTaxaPaginated(filter = {}, page = 0, _projection = {}) {
  const taxa = await getCollection("dwc2json", "taxa");
  if (!taxa) return null;
  const total = await taxa.countDocuments(filter);
  const totalPages = Math.ceil(total / 50);
  const data = await taxa.find(filter).sort({ scientificName: 1 }).skip(page * 50).limit(50).toArray();
  return {
    data,
    total,
    totalPages
  };
}
async function countTaxa(filter = {}) {
  const taxa = await getCollection("dwc2json", "taxa");
  if (!taxa) return null;
  return await taxa.countDocuments(filter);
}
async function countTaxaRegions(filter = {}) {
  const taxa = await getCollection("dwc2json", "taxa");
  if (!taxa) return null;
  const matchStage = {
    taxonomicStatus: /NOME[_ ]ACEITO/
  };
  Object.entries(filter).forEach(([key, value]) => {
    if (value) {
      if (key === "genus" || key === "specificEpithet") {
        matchStage[key] = value instanceof RegExp ? value : new RegExp(`^${value.trim()}$`, "i");
      } else {
        matchStage[key] = value instanceof RegExp ? value : new RegExp(`\\b${value.trim()}\\b`, "i");
      }
    }
  });
  const [result] = await taxa.aggregate([
    {
      $match: matchStage
    },
    {
      $facet: {
        total: [
          {
            $count: "count"
          }
        ],
        byRegion: [
          {
            $unwind: {
              path: "$distribution.occurrence"
            }
          },
          {
            $group: {
              _id: "$distribution.occurrence",
              count: {
                $count: {}
              }
            }
          }
        ]
      }
    }
  ]).toArray();
  if (!result) {
    return {
      total: 0,
      regions: []
    };
  }
  return {
    total: result.total[0]?.count || 0,
    regions: result.byRegion
  };
}
async function getTaxonomicStatusPerKingdom(kingdom) {
  const taxa = await getCollection("dwc2json", "taxa");
  if (!taxa) return null;
  return await taxa.aggregate([
    {
      $match: {
        kingdom: kingdom[0].toUpperCase() + kingdom.slice(1).toLowerCase()
      }
    },
    {
      $group: {
        _id: {
          $ifNull: ["$taxonomicStatus", "$nomenclaturalStatus"]
        },
        count: {
          $count: {}
        }
      }
    }
  ]).toArray();
}
function splitNodeAlphabetically(node) {
  const sortedChildren = node.children.sort(
    (a, b) => (a.name ?? "").localeCompare(b.name ?? "")
  );
  if (sortedChildren.length <= 20) {
    const processedChildren = sortedChildren.map((child) => {
      if (child.type === "folder") {
        return splitNodeAlphabetically(child);
      }
      return child;
    });
    return {
      ...node,
      children: processedChildren
    };
  }
  const nGroups = Math.min(Math.ceil(sortedChildren.length / 20), 26);
  const lettersInEachGroup = Math.ceil(26 / nGroups);
  const groupNames = new Array(nGroups).fill(0).map(
    (_, i) => `${String.fromCharCode(65 + i * lettersInEachGroup)} - ${String.fromCharCode(Math.min(65 + (i + 1) * lettersInEachGroup - 1, 90))}`
  );
  const groups = new Array(nGroups).fill(0).map((_, i) => ({
    name: groupNames[i],
    type: "folder",
    children: []
  }));
  const output = {
    ...node,
    children: groups
  };
  sortedChildren.forEach((child) => {
    const firstLetter = child.name?.charAt(0)?.toLowerCase() ?? "z";
    const groupIndex = Math.floor(
      (firstLetter.charCodeAt(0) - 97) / lettersInEachGroup
    );
    if (groupIndex >= 0 && groupIndex < groups.length) {
      if (child.type === "folder") {
        groups[groupIndex]?.children.push(
          splitNodeAlphabetically(child)
        );
      } else {
        groups[groupIndex]?.children.push(child);
      }
    }
  });
  return output;
}
async function getTree() {
  const taxaCollection = await getCollection("dwc2json", "taxa");
  const taxa = await taxaCollection?.find(
    {
      taxonomicStatus: "NOME_ACEITO"
    },
    {
      projection: {
        _id: 0,
        kingdom: 1,
        phylum: 1,
        class: 1,
        order: 1,
        family: 1,
        genus: 1,
        specificEpithet: 1,
        scientificName: 1,
        taxonID: 1
      }
    }
  ).toArray();
  const tree = taxa?.reduce(
    (acc, taxon) => {
      let kingdomIndex = acc.children.findIndex(
        (child) => child.name === taxon.kingdom
      );
      if (kingdomIndex === -1) {
        kingdomIndex = acc.children.length;
        acc.children.push({
          name: taxon.kingdom,
          type: "folder",
          children: []
        });
      }
      const kingdom = acc.children[kingdomIndex];
      let phylumIndex = kingdom.children.findIndex(
        (child) => child.name === taxon.phylum
      );
      if (phylumIndex === -1) {
        phylumIndex = kingdom.children.length;
        kingdom.children.push({
          name: taxon.phylum,
          type: "folder",
          children: []
        });
      }
      const phylum = kingdom.children[phylumIndex];
      let classIndex = phylum.children.findIndex(
        (child) => child.name === taxon.class
      );
      if (classIndex === -1) {
        classIndex = phylum.children.length;
        phylum.children.push({
          name: taxon.class,
          type: "folder",
          children: []
        });
      }
      const classNode = phylum.children[classIndex];
      let orderIndex = classNode.children.findIndex(
        (child) => child.name === taxon.order
      );
      if (orderIndex === -1) {
        orderIndex = classNode.children.length;
        classNode.children.push({
          name: taxon.order,
          type: "folder",
          children: []
        });
      }
      const orderNode = classNode.children[orderIndex];
      let familyIndex = orderNode.children.findIndex(
        (child) => child.name === taxon.family
      );
      if (familyIndex === -1) {
        familyIndex = orderNode.children.length;
        orderNode.children.push({
          name: taxon.family,
          type: "folder",
          children: []
        });
      }
      const family = orderNode.children[familyIndex];
      let genusIndex = family.children.findIndex(
        (child) => child.name === taxon.genus
      );
      if (genusIndex === -1) {
        genusIndex = family.children.length;
        family.children.push({
          name: taxon.genus,
          type: "folder",
          children: []
        });
      }
      const genus = family.children[genusIndex];
      genus.children.push({
        name: taxon.scientificName,
        type: "url",
        url: `/taxon/${taxon.kingdom.slice(0, 1)}${taxon.taxonID}`
      });
      return acc;
    },
    { name: "Árvore da vida", type: "folder", children: [] }
  );
  return tree ? splitNodeAlphabetically(tree) : null;
}
async function getFamilyPerKingdom(kingdom) {
  const taxa = await getCollection("dwc2json", "taxa");
  if (!taxa) return null;
  return await taxa.aggregate([
    {
      $match: {
        kingdom: kingdom[0].toUpperCase() + kingdom.slice(1).toLowerCase(),
        taxonomicStatus: "NOME_ACEITO",
        taxonRank: "ESPECIE"
      }
    },
    {
      $addFields: {
        family: {
          $cond: {
            if: { $eq: ["$higherClassification", "Algas"] },
            then: { $concat: ["[Algae]: ", "$class"] },
            else: "$family"
          }
        }
      }
    },
    {
      $group: {
        // _id: kingdom.toLocaleLowerCase() === 'fungi' ? '$phylum' : '$family',
        _id: "$family",
        count: {
          $count: {}
        }
      }
    }
  ]).toArray();
}
async function getOccurrenceCountPerKingdom(kingdom) {
  const occurrences = await getCollection("dwc2json", "ocorrencias");
  if (!occurrences) return null;
  const result = await occurrences.countDocuments({
    kingdom: kingdom[0].toUpperCase() + kingdom.slice(1).toLowerCase()
  });
  return result;
}
async function getTaxaCountPerKingdom(kingdom) {
  const taxa = await getCollection("dwc2json", "taxa");
  if (!taxa) return null;
  const result = await taxa.countDocuments({
    kingdom: kingdom[0].toUpperCase() + kingdom.slice(1).toLowerCase(),
    taxonomicStatus: "NOME_ACEITO"
  });
  return result;
}
async function getThreatenedCountPerKingdom(kingdom) {
  if (kingdom.toLowerCase() === "animalia") {
    const fauna = await getCollection("dwc2json", "faunaAmeacada");
    if (!fauna) return null;
    return await fauna.countDocuments({
      threatStatus: { $ne: "Não Avaliada (NE)" }
    });
  } else if (kingdom.toLowerCase() === "plantae") {
    const flora = await getCollection("dwc2json", "cncfloraPlantae");
    if (!flora) return null;
    return await flora.countDocuments({
      "Categoria de Risco": { $ne: "NE" }
    });
  } else if (kingdom.toLowerCase() === "fungi") {
    const flora = await getCollection("dwc2json", "cncfloraFungi");
    if (!flora) return null;
    return await flora.countDocuments({
      "Categoria de Risco": { $ne: "NE" }
    });
  }
  return null;
}
async function getThreatenedCategoriesPerKingdom(kingdom) {
  if (kingdom.toLowerCase() === "animalia") {
    const fauna = await getCollection("dwc2json", "faunaAmeacada");
    if (!fauna) return null;
    return await fauna.aggregate([
      {
        $match: { threatStatus: { $ne: "Não Avaliada (NE)" } }
      },
      {
        $group: {
          _id: "$threatStatus",
          count: { $count: {} }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).toArray();
  } else if (kingdom.toLowerCase() === "plantae") {
    const flora = await getCollection("dwc2json", "cncfloraPlantae");
    if (!flora) return null;
    return await flora.aggregate([
      {
        $match: {
          "Categoria de Risco": { $exists: true, $ne: null, $nin: ["NE"] }
        }
      },
      {
        $group: {
          _id: "$Categoria de Risco",
          count: { $count: {} }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).toArray();
  } else if (kingdom.toLowerCase() === "fungi") {
    const flora = await getCollection("dwc2json", "cncfloraFungi");
    if (!flora) return null;
    return await flora.aggregate([
      {
        $match: {
          "Categoria de Risco": { $exists: true, $ne: null, $nin: ["NE"] }
        }
      },
      {
        $group: {
          _id: "$Categoria de Risco",
          count: { $count: {} }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).toArray();
  }
  return null;
}
async function getInvasiveCountPerKingdom(kingdom) {
  const invasive = await getCollection("dwc2json", "invasoras");
  if (!invasive) return null;
  const result = await invasive.countDocuments({
    kingdom: kingdom[0].toUpperCase() + kingdom.slice(1).toLowerCase()
  });
  return result;
}
async function getInvasiveTopOrders(kingdom, limit = 10) {
  const invasive = await getCollection("dwc2json", "invasoras");
  if (!invasive) return null;
  const result = await invasive.aggregate([
    {
      $match: {
        kingdom: kingdom[0].toUpperCase() + kingdom.slice(1).toLowerCase(),
        oorder: { $exists: true, $ne: null, $not: { $eq: "" } }
      }
    },
    {
      $group: {
        _id: "$oorder",
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: limit
    }
  ]).toArray();
  return result;
}
async function getInvasiveTopFamilies(kingdom, limit = 10) {
  const invasive = await getCollection("dwc2json", "invasoras");
  if (!invasive) return null;
  const result = await invasive.aggregate([
    {
      $match: {
        kingdom: kingdom[0].toUpperCase() + kingdom.slice(1).toLowerCase(),
        family: { $exists: true, $ne: null, $not: { $eq: "" } }
      }
    },
    {
      $group: {
        _id: "$family",
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: limit
    }
  ]).toArray();
  return result;
}
async function getTaxaCountPerOrderByKingdom(kingdom, limit = 10) {
  const taxa = await getCollection("dwc2json", "taxa");
  if (!taxa) return null;
  const result = await taxa.aggregate([
    {
      $match: {
        kingdom: kingdom[0].toUpperCase() + kingdom.slice(1).toLowerCase(),
        taxonomicStatus: "NOME_ACEITO",
        order: { $exists: true, $ne: null, $not: { $eq: "" } }
      }
    },
    {
      $group: {
        _id: "$order",
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: limit
    }
  ]).toArray();
  return result;
}
async function getTaxaCountPerFamilyByKingdom(kingdom, limit = 10) {
  const taxa = await getCollection("dwc2json", "taxa");
  if (!taxa) return null;
  const result = await taxa.aggregate([
    {
      $match: {
        kingdom: kingdom[0].toUpperCase() + kingdom.slice(1).toLowerCase(),
        taxonomicStatus: "NOME_ACEITO",
        family: { $exists: true, $ne: null, $not: { $eq: "" } }
      }
    },
    {
      $addFields: {
        family: {
          $cond: {
            if: { $eq: ["$higherClassification", "Algas"] },
            then: { $concat: ["[Algae]: ", "$class"] },
            else: "$family"
          }
        }
      }
    },
    {
      $group: {
        _id: "$family",
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: limit
    }
  ]).toArray();
  return result;
}
async function getTopCollectionsByKingdom(kingdom, limit = 10) {
  const occurrences = await getCollection("dwc2json", "ocorrencias");
  if (!occurrences) return null;
  const result = await occurrences.aggregate([
    {
      $match: {
        kingdom: kingdom[0].toUpperCase() + kingdom.slice(1).toLowerCase(),
        rightsHolder: { $exists: true, $ne: null, $not: { $eq: "" } }
      }
    },
    {
      $group: {
        _id: "$rightsHolder",
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: limit
    }
  ]).toArray();
  return result;
}
async function getTaxon(kingdom, id, includeOccurrences = false) {
  const taxa = await getCollection("dwc2json", "taxa");
  if (!taxa) return null;
  return includeOccurrences ? (await taxa.aggregate([
    {
      $match: {
        kingdom,
        taxonID: id
      }
    },
    {
      $lookup: {
        from: "ocorrencias",
        localField: "scientificName",
        foreignField: "scientificName",
        as: "occurrences"
      }
    }
  ]).toArray())[0] : await taxa.findOne({ kingdom, taxonID: id });
}
async function getCalFenoData(filter = {}) {
  try {
    const calFeno = await getCollection("dwc2json", "calFeno");
    if (!calFeno) {
      console.warn("⚠️  calFeno view not available");
      return [];
    }
    const baseFilter = {
      kingdom: "Plantae",
      ...filter
    };
    return await calFeno.find(baseFilter).toArray();
  } catch (error) {
    console.error("❌ Error querying calFeno:", error);
    return [];
  }
}
function generatePhenologicalHeatmap(occurrences) {
  const monthCounts = Array(12).fill(0);
  occurrences.forEach((occ) => {
    const month = parseInt(occ.month);
    if (month >= 1 && month <= 12) {
      monthCounts[month - 1] += 1;
    }
  });
  const maxCount = Math.max(...monthCounts);
  return monthCounts.map((count, index) => ({
    month: index + 1,
    monthName: [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez"
    ][index],
    count,
    intensity: maxCount > 0 ? count / maxCount : 0
  }));
}

export { getCollection as a, listTaxaPaginated as b, countTaxaRegions as c, getTaxonomicStatusPerKingdom as d, getTree as e, getCalFenoData as f, getFamilyPerKingdom as g, generatePhenologicalHeatmap as h, getOccurrenceCountPerKingdom as i, getTaxaCountPerKingdom as j, getThreatenedCountPerKingdom as k, listOccurrences as l, getThreatenedCategoriesPerKingdom as m, getInvasiveCountPerKingdom as n, getInvasiveTopOrders as o, getInvasiveTopFamilies as p, getTaxaCountPerOrderByKingdom as q, getTaxaCountPerFamilyByKingdom as r, getTopCollectionsByKingdom as s, countTaxa as t, getTaxon as u };
