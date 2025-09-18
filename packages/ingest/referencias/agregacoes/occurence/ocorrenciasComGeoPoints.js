;[
  {
    $match:
      /**
       * query: The query in MQL.
       */
      {
        geoPoint: {
          $exists: 1
        }
      }
  }
]
