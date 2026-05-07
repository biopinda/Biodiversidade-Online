package dwca

import (
	"archive/zip"
	"encoding/xml"
	"fmt"
	"io"
	"strings"
)

func Open(zipPath string) (*Archive, error) {
	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, fmt.Errorf("open zip: %w", err)
	}
	defer zr.Close()

	archive := &Archive{}

	if err := parseMetaXML(zr, archive); err != nil {
		return nil, err
	}

	if err := parseEmlXML(zr, archive); err != nil {
		// EML is optional — warn but don't fail
		_ = err
	}

	return archive, nil
}

func parseMetaXML(zr *zip.ReadCloser, archive *Archive) error {
	f := findFile(zr, "meta.xml")
	if f == nil {
		return fmt.Errorf("meta.xml not found in DwC-A archive")
	}

	rc, err := f.Open()
	if err != nil {
		return fmt.Errorf("open meta.xml: %w", err)
	}
	defer rc.Close()

	data, err := io.ReadAll(rc)
	if err != nil {
		return fmt.Errorf("read meta.xml: %w", err)
	}

	if err := xml.Unmarshal(data, archive); err != nil {
		return fmt.Errorf("parse meta.xml: %w", err)
	}

	// Apply defaults
	if archive.Core.FieldsTerminatedBy == "" {
		archive.Core.FieldsTerminatedBy = "\t"
	}
	if archive.Core.Encoding == "" {
		archive.Core.Encoding = "UTF-8"
	}
	for i := range archive.Extensions {
		if archive.Extensions[i].FieldsTerminatedBy == "" {
			archive.Extensions[i].FieldsTerminatedBy = "\t"
		}
		if archive.Extensions[i].Encoding == "" {
			archive.Extensions[i].Encoding = "UTF-8"
		}
	}

	return nil
}

func parseEmlXML(zr *zip.ReadCloser, archive *Archive) error {
	f := findFile(zr, "eml.xml")
	if f == nil {
		return fmt.Errorf("eml.xml not found")
	}

	rc, err := f.Open()
	if err != nil {
		return err
	}
	defer rc.Close()

	data, err := io.ReadAll(rc)
	if err != nil {
		return err
	}

	archive.Metadata = parseEml(data)
	return nil
}

func parseEml(data []byte) EmlMetadata {
	var eml struct {
		PubDate string `xml:"dataset>pubDate"`
		Title   string `xml:"dataset>title"`
		Version string `xml:"additionalMetadata>metadata>gbif>dateStamp"`
	}
	_ = xml.Unmarshal(data, &eml)

	meta := EmlMetadata{
		PubDate: strings.TrimSpace(eml.PubDate),
		Title:   strings.TrimSpace(eml.Title),
		Version: strings.TrimSpace(eml.Version),
	}

	// Try alternate version location
	if meta.Version == "" {
		var alt struct {
			Version string `xml:"additionalMetadata>metadata>gbif>resourceLogoUrl"`
		}
		_ = xml.Unmarshal(data, &alt)
	}

	return meta
}

// CoreReader returns a Reader for the core file of the archive.
// The zip file must remain open; caller must call Close on returned Reader.
func CoreReader(zipPath string) (*Reader, error) {
	archive, err := Open(zipPath)
	if err != nil {
		return nil, err
	}

	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, err
	}

	f := findFile(zr, archive.Core.Files.Location)
	if f == nil {
		zr.Close()
		return nil, fmt.Errorf("core file %q not found in archive", archive.Core.Files.Location)
	}

	return newReader(zr, f, archive.Core.Fields, archive.Core.ID.Index,
		archive.Core.FieldsTerminatedBy, archive.Core.IgnoreHeaderLines)
}

// ExtensionReader returns a Reader for the named extension rowType.
func ExtensionReader(zipPath, rowType string) (*Reader, error) {
	archive, err := Open(zipPath)
	if err != nil {
		return nil, err
	}

	var ext *Extension
	for i := range archive.Extensions {
		if archive.Extensions[i].RowType == rowType {
			ext = &archive.Extensions[i]
			break
		}
	}
	if ext == nil {
		return nil, fmt.Errorf("extension rowType %q not found", rowType)
	}

	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, err
	}

	f := findFile(zr, ext.Files.Location)
	if f == nil {
		zr.Close()
		return nil, fmt.Errorf("extension file %q not found in archive", ext.Files.Location)
	}

	return newReader(zr, f, ext.Fields, ext.CoreID.Index,
		ext.FieldsTerminatedBy, ext.IgnoreHeaderLines)
}

func findFile(zr *zip.ReadCloser, name string) *zip.File {
	for _, f := range zr.File {
		if f.Name == name || strings.HasSuffix(f.Name, "/"+name) {
			return f
		}
	}
	return nil
}
