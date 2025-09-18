;[
  {
    $match:
      /**
       * query: The query in MQL.
       */
      {
        kingdom: 'Animalia'
      }
  },
  {
    $lookup: {
      from: 'ameacadasFauna202402',
      localField: 'flatScientificName',
      foreignField: 'flatScientificName',
      as: 'threatStatus'
    }
  },
  {
    $match:
      /**
       * query: The query in MQL.
       */
      {
        'threatStatus.threatStatus': {
          $exists: 1
        }
      }
  }
]
