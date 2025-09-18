;[
  {
    $match:
      /**
       * pega Animalia
       */
      {
        kingdom: 'Animalia'
      }
  },
  {
    $match:
      /**
       * procura "(" nos epitetos específicos
       */
      {
        specificEpithet: /\(/
      }
  }
]
