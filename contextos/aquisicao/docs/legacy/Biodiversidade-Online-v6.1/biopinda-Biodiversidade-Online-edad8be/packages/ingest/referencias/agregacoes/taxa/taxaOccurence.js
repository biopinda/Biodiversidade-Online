;[
  {
    $lookup: {
      from: 'ocorrencias',
      localField: 'scientificName',
      foreignField: 'scientificName',
      as: 'ocorrencias'
    }
  },
  {
    $unset: [
      'ocorrencias.modified',
      'ocorrencias.type',
      'ocorrencias.license',
      'ocorrencias.institutionID',
      'ocorrencias.basisOfRecord',
      'ocorrencias.family',
      'ocorrencias.genus',
      'ocorrencias.specificEpithet',
      'ocorrencias.taxonRank',
      'ocorrencias.scientificNameAuthorship'
    ]
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
