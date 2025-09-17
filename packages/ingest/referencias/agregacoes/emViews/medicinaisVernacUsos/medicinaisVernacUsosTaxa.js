[
    {
      $lookup: {
        from: "taxa",
        localField: "vernacularName",
        foreignField:
          "vernacularname.vernacularName",
        as: "taxa",
      },
    },
    {
      $unset: [
        "taxa.parentNameUsageID",
        "taxa.parentNameUsage",
        "taxa.flatScientificName",
        "taxa.typesandspecimen",
        "taxa.namePublishedIn",
        "taxa.namePublishedInYear",
        "usos.vernacularName",
      ],
    },
  ]