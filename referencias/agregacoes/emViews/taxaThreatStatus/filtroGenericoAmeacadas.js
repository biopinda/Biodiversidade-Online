[
  {
    $match:
      /**
       * query: The query in MQL.
       */
      {
        "distribution.occurrence": ["BR-MG"],
      },
  },
  {
    $match:
      /**
       * query: The query in MQL.
       */
      {
        "distribution.phytogeographicDomains": [
          "Caatinga",
        ],
      },
  },
  {
    $match:
      /**
       * query: The query in MQL.
       */
      {
        $or: [
          {
            "threatStatus.threatStatus": "CR",
          },
          {
            "threatStatus.threatStatus": "EN",
          },
          {
            "threatStatus.threatStatus": "VU",
          },
        ],
      },
  },
]
