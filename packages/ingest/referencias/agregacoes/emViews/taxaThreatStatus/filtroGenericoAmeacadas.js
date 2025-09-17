[
  {
    $match:
      /**
       * espécies exclusivas de MG
       */
      {
        "distribution.occurrence": ["BR-MG"],
      },
  },
  {
    $match:
      /**
       * espécies exclusivas da Caatinga
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
       * espécies ameaçadas (nas categorias CR, EN e VU
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
