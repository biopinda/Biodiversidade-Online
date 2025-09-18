;[
  {
    $match: {
      kingdom: 'Animalia'
    }
  },
  {
    $match: {
      ocorrencias: {
        $not: {
          $size: 0
        }
      }
    }
  }
]
