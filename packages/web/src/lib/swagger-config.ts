/**
 * Swagger/OpenAPI Configuration
 * Generates API documentation using swagger-jsdoc
 */

export const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Biodiversidade.Online API',
      version: '5.1.0',
      description:
        'RESTful API for biodiversity data access and analytics. Provides access to species, occurrences, conservation units, and threat assessments.',
      contact: {
        name: 'Biodiversidade.Online',
        url: 'https://biodiversidade.online'
      }
    },
    servers: [
      {
        url: 'http://localhost:4321',
        description: 'Development server'
      },
      {
        url: 'https://biodiversidade.online',
        description: 'Production server'
      }
    ],
    components: {
      schemas: {
        Taxa: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            scientificName: { type: 'string' },
            kingdom: { type: 'string' },
            phylum: { type: 'string' },
            class: { type: 'string' },
            order: { type: 'string' },
            family: { type: 'string' },
            genus: { type: 'string' },
            species: { type: 'string' },
            threatStatus: {
              type: 'string',
              enum: [
                'threatened',
                'near-threatened',
                'least-concern',
                'unknown'
              ]
            },
            invasiveStatus: {
              type: 'string',
              enum: ['invasive', 'native', 'unknown']
            },
            conservationUnitAssociations: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['_id', 'scientificName']
        },
        Occurrence: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            taxonID: { type: 'string' },
            scientificName: { type: 'string' },
            decimalLatitude: { type: 'number' },
            decimalLongitude: { type: 'number' },
            eventDate: { type: 'string' },
            basisOfRecord: { type: 'string' },
            country: { type: 'string' },
            stateProvince: { type: 'string' },
            county: { type: 'string' },
            municipality: { type: 'string' },
            threatStatus: { type: 'string' },
            invasiveStatus: { type: 'string' },
            conservationUnit: { type: 'string' }
          },
          required: ['_id', 'decimalLatitude', 'decimalLongitude']
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: { type: 'array' },
            total: { type: 'integer' },
            limit: { type: 'integer' },
            offset: { type: 'integer' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            status: { type: 'integer' },
            message: { type: 'string' },
            code: { type: 'string' }
          }
        }
      }
    },
    paths: {
      '/api/dashboard/summary': {
        get: {
          summary: 'Get dashboard summary statistics',
          tags: ['Dashboard'],
          responses: {
            200: {
              description: 'Dashboard summary with species counts',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      totalSpecies: { type: 'integer' },
                      threatenedCount: { type: 'integer' },
                      invasiveCount: { type: 'integer' },
                      totalOccurrences: { type: 'integer' }
                    }
                  }
                }
              }
            },
            500: {
              description: 'Server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/api/taxa': {
        get: {
          summary: 'List taxa with filtering and pagination',
          tags: ['Taxa'],
          parameters: [
            {
              name: 'type',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['native', 'threatened', 'invasive']
              },
              description: 'Filter by species type'
            },
            {
              name: 'region',
              in: 'query',
              schema: { type: 'string' },
              description: 'Filter by state/region'
            },
            {
              name: 'conservation_status',
              in: 'query',
              schema: { type: 'string' },
              description: 'Filter by conservation status'
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 100 },
              description: 'Number of results to return'
            },
            {
              name: 'offset',
              in: 'query',
              schema: { type: 'integer', default: 0 },
              description: 'Number of results to skip'
            }
          ],
          responses: {
            200: {
              description: 'List of taxa',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/PaginatedResponse' },
                      {
                        properties: {
                          data: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Taxa' }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            },
            400: {
              description: 'Invalid query parameters',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/api/occurrences': {
        get: {
          summary: 'List occurrences with filtering and pagination',
          tags: ['Occurrences'],
          parameters: [
            {
              name: 'taxonID',
              in: 'query',
              schema: { type: 'string' },
              description: 'Filter by taxon ID'
            },
            {
              name: 'region',
              in: 'query',
              schema: { type: 'string' },
              description: 'Filter by state/region'
            },
            {
              name: 'geobox',
              in: 'query',
              schema: { type: 'string' },
              description:
                'Filter by bounding box (minLat,minLon,maxLat,maxLon)'
            },
            {
              name: 'threat_status',
              in: 'query',
              schema: { type: 'string' },
              description: 'Filter by threat status'
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 100 },
              description: 'Number of results to return'
            },
            {
              name: 'offset',
              in: 'query',
              schema: { type: 'integer', default: 0 },
              description: 'Number of results to skip'
            }
          ],
          responses: {
            200: {
              description: 'List of occurrences',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/PaginatedResponse' },
                      {
                        properties: {
                          data: {
                            type: 'array',
                            items: {
                              $ref: '#/components/schemas/Occurrence'
                            }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            },
            400: {
              description: 'Invalid query parameters'
            }
          }
        }
      },
      '/api/occurrences/geojson': {
        get: {
          summary: 'Get occurrences as GeoJSON',
          tags: ['Occurrences'],
          parameters: [
            {
              name: 'region',
              in: 'query',
              schema: { type: 'string' }
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 1000 }
            }
          ],
          responses: {
            200: {
              description: 'GeoJSON FeatureCollection of occurrences'
            }
          }
        }
      },
      '/api/chat/send': {
        post: {
          summary: 'Send natural language query to ChatBB',
          tags: ['Chat'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'Natural language query'
                    },
                    conversationId: {
                      type: 'string',
                      description: 'Optional conversation ID for context'
                    }
                  },
                  required: ['query']
                }
              }
            }
          },
          responses: {
            200: {
              description: 'ChatBB response with data sources',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      response: { type: 'string' },
                      dataSources: {
                        type: 'array',
                        items: { type: 'string' }
                      },
                      conversationId: { type: 'string' }
                    }
                  }
                }
              }
            },
            400: {
              description: 'Invalid request'
            },
            500: {
              description: 'Claude API error'
            }
          }
        }
      }
    }
  }
}
