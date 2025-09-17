[
    {
      $lookup: {
        from: "threatStatus",
        localField: "canonicalName",
        foreignField: "canonicalName",
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
        "threatStatus.family",
        "_id",
        "parentNameUsageID",
        "parentNameUsage",
        "namePublishedIn",
        "namePublishedInYear",
        "taxonomicStatus",
        "nomenclaturalStatus",
        "modified",
        "bibliographicCitation",
        "references",
        "speciesprofile",
        "typesandspecimen",
        "distribution",
        "reference",
        "originalNameUsageID",
        "othernames",
        "vernacularname",
        "acceptedNameUsageID",
        "acceptedNameUsage",
      ],
    },
  ]