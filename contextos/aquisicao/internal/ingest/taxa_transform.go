package ingest

import (
	"strings"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// allowedTaxonRanks lists the ranks (case-insensitive, normalized) that pass through
// to the taxa collection. All other ranks (genus, family, order, etc.) are rejected.
var allowedTaxonRanks = map[string]bool{
	// Portuguese (Flora/Fauna do Brasil canonical)
	"ESPECIE":     true,
	"SUB_ESPECIE": true,
	"SUBESPECIE":  true,
	"VARIEDADE":   true,
	"FORMA":       true,
	// English (Darwin Core canonical)
	"SPECIES":    true,
	"SUBSPECIES": true,
	"VARIETY":    true,
	"FORM":       true,
}

// shouldKeepTaxon returns true iff the given rank is species-level or below.
func shouldKeepTaxon(rank string) bool {
	if rank == "" {
		return false
	}
	norm := strings.ToUpper(strings.TrimSpace(rank))
	norm = strings.ReplaceAll(norm, "-", "_")
	return allowedTaxonRanks[norm]
}

// buildCanonicalName joins genus + specificEpithet [+ infraspecificEpithet] with single spaces.
func buildCanonicalName(genus, specificEpithet, infraspecificEpithet string) string {
	parts := make([]string, 0, 3)
	for _, p := range []string{genus, specificEpithet, infraspecificEpithet} {
		p = strings.TrimSpace(p)
		if p != "" {
			parts = append(parts, p)
		}
	}
	return strings.Join(parts, " ")
}

// buildFlatScientificName lowercases the input and strips everything that is not [a-z0-9].
func buildFlatScientificName(scientificName string) string {
	s := strings.ToLower(strings.TrimSpace(scientificName))
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// normalizeDistribution collapses multiple distribution rows into a single object.
//
// Output shape (matches V6 schema):
//
//	{ origin, Endemism, phytogeographicDomains[], occurrence[], vegetationType[], countryCode[] }
//
// - occurrence[]: dedup of all locationID values
// - origin: first non-empty establishmentMeans
// - Endemism: first non-empty endemism (from occurrenceRemarks JSON or own column)
// - phytogeographicDomains[] / vegetationType[]: dedup from occurrenceRemarks
// - countryCode[]: dedup of countryCode column
func normalizeDistribution(rows []map[string]string) bson.M {
	if len(rows) == 0 {
		return nil
	}

	occurrence := newStringSet()
	phytoDomains := newStringSet()
	vegetationTypes := newStringSet()
	countryCodes := newStringSet()
	var origin, endemism string

	for _, r := range rows {
		if v := strings.TrimSpace(r["locationID"]); v != "" {
			occurrence.Add(v)
		}
		for _, code := range splitMulti(r["countryCode"]) {
			countryCodes.Add(code)
		}
		if origin == "" {
			if v := strings.TrimSpace(r["establishmentMeans"]); v != "" {
				origin = v
			}
		}
		if endemism == "" {
			if v := strings.TrimSpace(r["endemism"]); v != "" {
				endemism = v
			}
		}
		// occurrenceRemarks may be a plain string or a JSON-ish blob —
		// extract phytogeographicDomain / vegetationType / endemism by substring scan.
		if remarks := r["occurrenceRemarks"]; remarks != "" {
			extractKVList(remarks, "phytogeographicDomain", phytoDomains)
			extractKVList(remarks, "phytogeographicDomains", phytoDomains)
			extractKVList(remarks, "vegetationType", vegetationTypes)
			if endemism == "" {
				if v := extractKVScalar(remarks, "endemism"); v != "" {
					endemism = v
				}
			}
		}
	}

	out := bson.M{
		"occurrence": occurrence.Slice(),
	}
	if origin != "" {
		out["origin"] = origin
	}
	if endemism != "" {
		out["Endemism"] = endemism
	}
	if !phytoDomains.Empty() {
		out["phytogeographicDomains"] = phytoDomains.Slice()
	}
	if !vegetationTypes.Empty() {
		out["vegetationType"] = vegetationTypes.Slice()
	}
	if !countryCodes.Empty() {
		out["countryCode"] = countryCodes.Slice()
	}
	return out
}

// normalizeVernacular returns array of {vernacularName, language, locality}.
// Defaults language to "Portugues" when missing.
func normalizeVernacular(rows []map[string]string) []bson.M {
	if len(rows) == 0 {
		return nil
	}
	out := make([]bson.M, 0, len(rows))
	for _, r := range rows {
		name := strings.TrimSpace(r["vernacularName"])
		if name == "" {
			continue
		}
		entry := bson.M{
			"vernacularName": name,
			"language":       firstNonEmpty(r["language"], "Portugues"),
		}
		if v := strings.TrimSpace(r["locality"]); v != "" {
			entry["locality"] = v
		}
		out = append(out, entry)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// normalizeSpeciesProfile collapses one or more rows into { lifeForm: { lifeForm[], habitat[] } }.
// Splits multi-value fields by ; or ,
func normalizeSpeciesProfile(rows []map[string]string) bson.M {
	if len(rows) == 0 {
		return nil
	}
	lifeForms := newStringSet()
	habitats := newStringSet()
	for _, r := range rows {
		for _, v := range splitMulti(r["lifeForm"]) {
			lifeForms.Add(v)
		}
		for _, v := range splitMulti(r["habitat"]) {
			habitats.Add(v)
		}
	}
	if lifeForms.Empty() && habitats.Empty() {
		return nil
	}
	inner := bson.M{}
	if !lifeForms.Empty() {
		inner["lifeForm"] = lifeForms.Slice()
	}
	if !habitats.Empty() {
		inner["habitat"] = habitats.Slice()
	}
	return bson.M{"lifeForm": inner}
}

// normalizeOthernames maps resourcerelationship rows to {taxonID, scientificName, taxonomicStatus}.
func normalizeOthernames(rows []map[string]string) []bson.M {
	if len(rows) == 0 {
		return nil
	}
	out := make([]bson.M, 0, len(rows))
	for _, r := range rows {
		relatedID := firstNonEmpty(r["relatedResourceID"], r["relatedTaxonID"])
		entry := bson.M{}
		if relatedID != "" {
			entry["taxonID"] = relatedID
		}
		if v := strings.TrimSpace(r["scientificName"]); v != "" {
			entry["scientificName"] = v
		}
		status := firstNonEmpty(r["relationshipOfResource"], r["taxonomicStatus"])
		if status != "" {
			entry["taxonomicStatus"] = status
		}
		if len(entry) == 0 {
			continue
		}
		out = append(out, entry)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// normalizeReference returns array of bibliographic references.
func normalizeReference(rows []map[string]string) []bson.M {
	if len(rows) == 0 {
		return nil
	}
	out := make([]bson.M, 0, len(rows))
	keys := []string{"bibliographicCitation", "title", "creator", "date", "type", "identifier"}
	for _, r := range rows {
		entry := bson.M{}
		for _, k := range keys {
			if v := strings.TrimSpace(r[k]); v != "" {
				entry[k] = v
			}
		}
		if len(entry) == 0 {
			continue
		}
		out = append(out, entry)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// normalizeTypes returns array of typesandspecimen entries.
func normalizeTypes(rows []map[string]string) []bson.M {
	if len(rows) == 0 {
		return nil
	}
	out := make([]bson.M, 0, len(rows))
	keys := []string{"locality", "recordedBy", "catalogNumber", "collectionCode", "source", "typeStatus"}
	for _, r := range rows {
		entry := bson.M{}
		for _, k := range keys {
			if v := strings.TrimSpace(r[k]); v != "" {
				entry[k] = v
			}
		}
		if len(entry) == 0 {
			continue
		}
		out = append(out, entry)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// ptToEnTaxonomicStatus maps Portuguese Flora/Fauna do Brasil values to DwC canonical English.
var ptToEnTaxonomicStatus = map[string]string{
	"NOME_ACEITO": "accepted",
	"SINONIMO":    "synonym",
}

// ptToEnTaxonRank maps Portuguese Flora/Fauna do Brasil values to DwC canonical English.
var ptToEnTaxonRank = map[string]string{
	"ESPECIE":     "species",
	"SUB_ESPECIE": "subspecies",
	"SUBESPECIE":  "subspecies",
	"VARIEDADE":   "variety",
	"FORMA":       "form",
}

// normalizeTaxonomicStatus returns the DwC English canonical value when input is a known
// Portuguese synonym; otherwise returns the original value unchanged.
func normalizeTaxonomicStatus(s string) string {
	if mapped, ok := ptToEnTaxonomicStatus[strings.ToUpper(strings.TrimSpace(s))]; ok {
		return mapped
	}
	return s
}

// normalizeTaxonRank returns the DwC English canonical value when input is a known
// Portuguese synonym; otherwise returns the original value unchanged.
func normalizeTaxonRank(s string) string {
	norm := strings.ToUpper(strings.TrimSpace(s))
	norm = strings.ReplaceAll(norm, "-", "_")
	if mapped, ok := ptToEnTaxonRank[norm]; ok {
		return mapped
	}
	return s
}

// enrichTaxonDoc mutates doc in place: filters do not happen here, only enrichment.
// Caller must have validated rank already.
func enrichTaxonDoc(doc bson.M, te *taxonExtensions) {
	// Harmonize PT→EN for DwC fields before storing.
	if v, ok := doc["taxonomicStatus"].(string); ok && v != "" {
		doc["taxonomicStatus"] = normalizeTaxonomicStatus(v)
	}
	if v, ok := doc["taxonRank"].(string); ok && v != "" {
		doc["taxonRank"] = normalizeTaxonRank(v)
	}

	// Computed names
	genus, _ := doc["genus"].(string)
	species, _ := doc["specificEpithet"].(string)
	infra, _ := doc["infraspecificEpithet"].(string)
	if cn := buildCanonicalName(genus, species, infra); cn != "" {
		doc["canonicalName"] = cn
	}
	if sn, ok := doc["scientificName"].(string); ok && sn != "" {
		doc["flatScientificName"] = buildFlatScientificName(sn)
	}

	if te == nil {
		return
	}
	if dist := normalizeDistribution(te.Distribution); dist != nil {
		doc["distribution"] = dist
	}
	if vern := normalizeVernacular(te.Vernacular); vern != nil {
		doc["vernacularname"] = vern
	}
	if prof := normalizeSpeciesProfile(te.SpeciesProfile); prof != nil {
		doc["speciesprofile"] = prof
	}
	if refs := normalizeReference(te.Reference); refs != nil {
		doc["reference"] = refs
	}
	if types := normalizeTypes(te.TypesAndSpecimen); types != nil {
		doc["typesandspecimen"] = types
	}
	if others := normalizeOthernames(te.ResourceRelationship); others != nil {
		doc["othernames"] = others
	}
}

// --- helpers ---

// stringSet preserves insertion order while deduping.
type stringSet struct {
	idx  map[string]int
	list []string
}

func newStringSet() *stringSet { return &stringSet{idx: map[string]int{}} }

func (s *stringSet) Add(v string) {
	v = strings.TrimSpace(v)
	if v == "" {
		return
	}
	if _, ok := s.idx[v]; ok {
		return
	}
	s.idx[v] = len(s.list)
	s.list = append(s.list, v)
}

func (s *stringSet) Empty() bool { return len(s.list) == 0 }

func (s *stringSet) Slice() []string {
	out := make([]string, len(s.list))
	copy(out, s.list)
	return out
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v = strings.TrimSpace(v); v != "" {
			return v
		}
	}
	return ""
}

func splitMulti(s string) []string {
	if s == "" {
		return nil
	}
	// split on ; or , (single-line)
	rep := strings.NewReplacer(";", "\x00", ",", "\x00")
	parts := strings.Split(rep.Replace(s), "\x00")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// extractKVScalar searches for `key:value` or `"key":"value"` in remarks; returns first match.
func extractKVScalar(remarks, key string) string {
	idx := strings.Index(remarks, key)
	if idx < 0 {
		return ""
	}
	rest := remarks[idx+len(key):]
	rest = strings.TrimLeft(rest, "\":= \t")
	end := strings.IndexAny(rest, ",;}\"\n\r")
	if end < 0 {
		end = len(rest)
	}
	return strings.TrimSpace(rest[:end])
}

// extractKVList finds all `key:value` or `key:[v1,v2]` segments in remarks and adds them to set.
// Conservative: handles the common JSON-ish format used by Flora/Fauna do Brasil
// occurrenceRemarks and falls back to single scalar.
func extractKVList(remarks, key string, set *stringSet) {
	cursor := 0
	for {
		rel := strings.Index(remarks[cursor:], key)
		if rel < 0 {
			return
		}
		start := cursor + rel + len(key)
		rest := remarks[start:]
		rest = strings.TrimLeft(rest, "\":= \t")
		if strings.HasPrefix(rest, "[") {
			end := strings.Index(rest, "]")
			if end < 0 {
				return
			}
			body := rest[1:end]
			for _, v := range splitMulti(strings.ReplaceAll(body, "\"", "")) {
				set.Add(v)
			}
			cursor = start + end
			continue
		}
		end := strings.IndexAny(rest, ",;}\"\n\r")
		if end < 0 {
			end = len(rest)
		}
		set.Add(strings.TrimSpace(rest[:end]))
		cursor = start + end
	}
}
