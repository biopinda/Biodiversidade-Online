[
    {
      $group: {
        _id: "$recordedBy",
        total: {
          $count: {},
        },
      },
    },
    {
      $sort: {
        total: -1,
      },
    },
  ]