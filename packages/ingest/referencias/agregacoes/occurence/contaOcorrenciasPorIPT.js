[
    {
      $group: {
        _id: "$ipt",
        total: {
          $count: {},
        },
      },
    },
  ]