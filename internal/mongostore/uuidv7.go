package mongostore

import (
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"time"
)

// NewRunID generates a UUID v7 (timestamp-prefixed, random suffix).
// Format: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
func NewRunID() string {
	now := time.Now().UnixMilli()

	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic("crypto/rand unavailable: " + err.Error())
	}

	// Embed 48-bit millisecond timestamp in high bytes
	binary.BigEndian.PutUint32(b[0:4], uint32(now>>16))
	binary.BigEndian.PutUint16(b[4:6], uint16(now))

	// Set version 7
	b[6] = (b[6] & 0x0f) | 0x70

	// Set variant bits (10xx)
	b[8] = (b[8] & 0x3f) | 0x80

	return fmt.Sprintf("%s-%s-%s-%s-%s",
		hex.EncodeToString(b[0:4]),
		hex.EncodeToString(b[4:6]),
		hex.EncodeToString(b[6:8]),
		hex.EncodeToString(b[8:10]),
		hex.EncodeToString(b[10:16]),
	)
}
