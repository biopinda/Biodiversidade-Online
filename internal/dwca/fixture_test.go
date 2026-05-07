package dwca

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
)

const metaXML = `<?xml version="1.0" encoding="UTF-8"?>
<archive xmlns="http://rs.tdwg.org/dwc/text/" metadata="eml.xml">
  <core rowType="http://rs.tdwg.org/dwc/terms/Taxon"
        fieldsTerminatedBy="\t"
        linesTerminatedBy="\n"
        encoding="UTF-8"
        ignoreHeaderLines="1">
    <files><location>taxa.txt</location></files>
    <id index="0"/>
    <field index="0" term="http://rs.tdwg.org/dwc/terms/taxonID"/>
    <field index="1" term="http://rs.tdwg.org/dwc/terms/scientificName"/>
    <field index="2" term="http://rs.tdwg.org/dwc/terms/taxonRank"/>
    <field index="3" term="http://rs.tdwg.org/dwc/terms/kingdom"/>
  </core>
</archive>`

const emlXML = `<?xml version="1.0" encoding="UTF-8"?>
<eml:eml xmlns:eml="eml://ecoinformatics.org/eml-2.1.1">
  <dataset>
    <title>Test Fauna Dataset</title>
    <pubDate>2026-04-30</pubDate>
  </dataset>
  <additionalMetadata>
    <metadata>
      <gbif><dateStamp>2.3</dateStamp></gbif>
    </metadata>
  </additionalMetadata>
</eml:eml>`

const taxaTXT = "taxonID\tscientificName\ttaxonRank\tkingdom\n" +
	"1\tSpecies one\tspecies\tAnimalia\n" +
	"2\tSpecies two\tspecies\tAnimalia\n" +
	"3\tGenus three\tgenus\tAnimalia\n" +
	"4\tFamily four\tfamily\tAnimalia\n" +
	"5\tOrder five\torder\tAnimalia\n"

func createFixture(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	zipPath := filepath.Join(dir, "sample.zip")

	f, err := os.Create(zipPath)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	zw := zip.NewWriter(f)

	for name, content := range map[string]string{
		"meta.xml": metaXML,
		"eml.xml":  emlXML,
		"taxa.txt": taxaTXT,
	} {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}

	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}

	return zipPath
}
