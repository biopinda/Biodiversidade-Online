[
  {
    $match:
      {
        locality: /parque nacional/i,
      },
  },
  {
    $lookup: {
      from: "invasoras",
      localField: "canonicalName",
      foreignField: "scientific_name",
      as: "invasoras",
    },
  },
  {
    $match:
      {
        invasoras: {
          $not: {
            $size: 0,
          },
        },
      },
  },
  {
    $project:
      {
        family: 1,
        canonicalName: 1,
        datasetName: 1,
        catalogNumber: 1,
        stateProvince: 1,
        locality: 1,
      },
  },
  {
    $sort:
      {
        family: 1,
        canonicalname: 1,
      },
  },
]
