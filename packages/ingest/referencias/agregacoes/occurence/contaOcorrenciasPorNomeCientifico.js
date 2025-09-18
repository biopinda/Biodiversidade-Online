;[
  {
    $group: {
      _id: '$scientificName',
      total: {
        $count: {}
      }
    }
  },
  {
    $sort: {
      total: -1
    }
  }
]
