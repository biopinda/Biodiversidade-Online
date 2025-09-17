[
  {
    $lookup: {
      from: "cncflora2022",
      localField: "scientificName",
      foreignField: "scientificName",
      as: "threatStatus",
    },
  },
  {
    $match: {
      threatStatus: {
        $not: {
          $size: 0,
        },
      },
    },
  },
  {
    $unset: [
      "threatStatus.canonicalName",
      "threatStatus._id",
      "threatStatus.kingdom",
      "threatStatus.scientificName",
      "threatStatus.family",
      "threatStatus.higherClassification",
      "_id",
      "parentNameUsageID",
      "parentNameUsage",
      "namePublishedIn",
      "namePublishedInYear",
      "modified",
      "bibliographicCitation",
      "references",
      "nomenclaturalStatus",
      "typesandspecimen",
      "reference",
      "originalNameUsageID",
      "acceptedNameUsageID",
    ],
  },
  {
    $match: {
      taxonomicStatus: "SINONIMO",
    },
  },
]
