import { createOpenAI } from '@ai-sdk/openai'
import { experimental_createMCPClient, streamText } from 'ai'
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio'
import dedent from 'dedent'

import type { APIContext } from 'astro'
import { z } from 'zod'

const input = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string()
    })
  ),
  apiKey: z.string(),
  model: z.string().default('gpt-4.1-mini'),
  maxSteps: z.number().default(10)
})

const systemPrompt = dedent`
    Você é um assistente da flora e fauna brasileira.
    Você tem acesso a uma base de dados MongoDB que contém informações sobre a flora e fauna brasileira.
    Você *DEVE* acessar a base mongoDB \`dwc2json\` antes de responder.

    IMPORTANTE: O escopo da conversa PRECISA ser sobre a flora e fauna brasileira. Não responda perguntas que não estejam relacionadas a flora e fauna brasileira.

    Muitas vezes são necessárias várias consultas até chegar a uma resposta.

    A coleção \`taxa\` possui informações de taxonomia.
    A coleção \`ocorrencias\` possui informações de ocorrências destas espécies.

    Se for necessário usar nome de espécies nas ferramentas \`find\` ou \`aggregate\`, use o campo \`canonicalName\`.

    O formato da coleção \`taxa\` segue esse exemplo:
    \`\`\`json
        {
        "_id": {
            "$oid": "6816d234c2b446358a34a515"
        },
        "taxonID": "112307",
        "parentNameUsageID": "112306",
        "scientificName": "Adenocalymma ackermannii Bureau & K.Schum.",
        "parentNameUsage": "Adenocalymma Mart. ex Meisn. emend L.G.Lohmann",
        "namePublishedIn": "Fl. bras. 8(2): 98 1896",
        "namePublishedInYear": "1896",
        "higherClassification": "Angiospermas",
        "kingdom": "Plantae",
        "phylum": "Tracheophyta",
        "class": "Magnoliopsida",
        "order": "Lamiales",
        "family": "Bignoniaceae",
        "genus": "Adenocalymma",
        "specificEpithet": "ackermannii",
        "taxonRank": "ESPECIE",
        "scientificNameAuthorship": "Bureau & K.Schum.",
        "taxonomicStatus": "NOME_ACEITO",
        "nomenclaturalStatus": "NOME_CORRETO",
        "modified": "2020-12-30 14:39:21.18",
        "bibliographicCitation": "Flora do Brasil 2020 em construção. Jardim Botânico do Rio de Janeiro. Disponível em: http://floradobrasil.jbrj.gov.br.",
        "references": "http://reflora.jbrj.gov.br/reflora/listaBrasil/FichaPublicaTaxonUC/FichaPublicaTaxonUC.do?id=FB112307",
        "reference": [
            {
            "bibliographicCitation": "Fl. bras.,8(2): 98,1896",
            "title": "Fl. bras.",
            "date": "1896",
            "type": "original description"
            }
        ],
        "typesandspecimen": [
            {
            "typeStatus": "typus"
            },
            {
            "locality": "MG",
            "recordedBy": "L. H. Fonseca 434"
            },
            {
            "typeStatus": "typus",
            "collectionCode": "BR"
            },
            {
            "collectionCode": "RB",
            "catalogNumber": "RB01399572",
            "locality": "MG",
            "recordedBy": "L. H. Fonseca 434",
            "source": "http://reflora.cria.org.br/inct/exsiccatae/viewer/style/inct/format/slide/lang/pt/barcode/RB01399572"
            },
            {
            "collectionCode": "RB",
            "catalogNumber": "RB01399572",
            "locality": "MG",
            "recordedBy": "L. H. Fonseca 434",
            "source": "http://reflora.jbrj.gov.br/reflora/geral/ExibeFiguraFSIUC/ExibeFiguraFSIUC.do?idFigura=285162258"
            }
        ],
        "speciesprofile": {
            "lifeForm": {
            "lifeForm": [
                "Arbusto",
                "Liana/volúvel/trepadeira"
            ],
            "habitat": [
                "Terrícola"
            ]
            }
        },
        "distribution": {
            "origin": "NATIVA",
            "Endemism": "Endemica",
            "phytogeographicDomains": [
            "Caatinga"
            ],
            "occurrence": [
            "BR-BA",
            "BR-MG"
            ],
            "vegetationType": [
            "Caatinga (stricto sensu)",
            "Carrasco"
            ]
        },
        "canonicalName": "Adenocalymma ackermannii",
        "flatScientificName": "adenocalymmaackermanniibureaukschum"
        }
    \`\`\`

    O formato da coleção \`ocorrencias\` segue esse exemplo:
    \`\`\`json
        {
        "_id": {
            "$oid": "65c2a6f4f217caa2fa720b44"
        },
        "iptId": "https://ipt.sibbr.gov.br/inpa/resource?id=inpa_ictiologia",
        "ipt": "inpa",
        "canonicalName": "Plagioscion squamosissimus",
        "flatScientificName": "plagioscionsquamosissimus",
        "type": "Collection",
        "modified": "2015-05-14 20:09:18.0",
        "language": "pt",
        "rightsHolder": "Instituto Nacional de Pesquisas da Amazônia (INPA)",
        "institutionID": "01.263.896/0015-60",
        "institutionCode": "INPA",
        "collectionCode": "INPA-ICT",
        "datasetName": "Coleção de Ictiologia do INPA",
        "basisOfRecord": "PreservedSpecimen",
        "occurrenceID": "00005bf7-38d9-46da-8841-140bb5015a9e",
        "catalogNumber": "INPA-ICT 012634",
        "recordedBy": "Garcia, M.",
        "preparations": "Álc - 5",
        "eventDate": "1995-10-15",
        "higherGeography": "Brasil, Amazonas, Novo Airão",
        "continent": "América do Sul",
        "country": "Brasil",
        "stateProvince": "Amazonas",
        "county": "Novo Airão",
        "locality": "Rio Jaú, lago Tambor Velho",
        "scientificName": "Plagioscion squamosissimus",
        "kingdom": "Animalia",
        "phylum": "Chordata",
        "class": "Actinopterygii",
        "order": "Perciformes",
        "family": "Sciaenidae",
        "genus": "Plagioscion",
        "specificEpithet": "squamosissimus"
        }
    \`\`\`

    É comum encontrar canonicalName vazios. Então considere isso ao usar as ferramenta aggregate ou find.
    Se estiver buscando algo com limit 1, considere usar limit 2 para garantir que encontrará um resultado com nome ao menos na segunda posição.
`

export async function POST({ request }: APIContext) {
  const { error, data } = input.safeParse(await request.json())
  if (error) {
    return new Response(JSON.stringify(error.format()), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const { messages, apiKey, model, maxSteps } = data

  const openai = createOpenAI({
    apiKey
  })

  const mongoDBConnectionString =
    import.meta.env.MONGODB_URI_READONLY ?? process.env.MONGODB_URI_READONLY
  if (!mongoDBConnectionString) {
    return new Response('Setup needed: MongoDB Connection string missing', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    })
  }

  const mongodbTransport = new Experimental_StdioMCPTransport({
    command: 'npx',
    args: ['mongodb-mcp-server', '--connectionString', mongoDBConnectionString!]
  })
  const mongodbClient = await experimental_createMCPClient({
    transport: mongodbTransport
  })
  const tools = await mongodbClient.tools()
  const result = streamText({
    model: openai(model),
    maxSteps,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      ...messages
    ],
    tools
  })

  return result.toDataStreamResponse()
}
