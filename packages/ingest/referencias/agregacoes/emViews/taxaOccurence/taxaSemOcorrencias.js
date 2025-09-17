[
    {
      $match: {
        ocorrencias: [],
      },
    },
    {
      $unset: [
        "parentNameUsageID",
        "parentNameUsage",
        "namePublishedIn",
        "namePublishedInYear",
        "kingdom",
        "genus",
        "specificEpithet",
        "taxonRank",
        "modified",
        "bibliographicCitation",
        "references",
        "distribution",
        "typesandspecimen",
        "reference",
        "speciesprofile",
        "ocorrencias",
        "scientificNameAuthorship",
        "vernacularname",
        "othernames",
        "infraspecificEpithet",
        "originalNameUsageID",
        "acceptedNameUsageID",
        "acceptedNameUsage",
      ],
    },
  ]