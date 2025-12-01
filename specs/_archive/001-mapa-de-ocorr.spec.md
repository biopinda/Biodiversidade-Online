# Feature Specification: Mapa de Ocorr�ncias por Estado

**Feature Branch**: `001-mapa-de-ocorr`
**Created**: 2025-09-22
**Status**: Draft
**Input**: User description: "Mapa de ocorr�ncias. Use o @packages\web\src\pages\plan\mapaocorrencia-implementation.md"

## Execution Flow (main)

```
1. Parse user description from Input
   � Feature request: Create occurrence map by Brazilian states
2. Extract key concepts from description
   � Actors: Biodiversity researchers, scientists, public users
   � Actions: View occurrence data, filter by taxonomy, visualize by state
   � Data: Species occurrence records with geographic information
   � Constraints: Brazilian states only, existing taxonomic filters
3. For each unclear aspect:
   � Performance requirements for large datasets [CLARIFIED: Based on existing taxa map performance]
4. Fill User Scenarios & Testing section
   � Primary flow: Browse occurrence data by state visualization
5. Generate Functional Requirements
   � Display interactive map, count occurrences, apply filters
6. Identify Key Entities
   � Occurrence records, Brazilian states, taxonomic classifications
7. Run Review Checklist
   � No implementation details included
8. Return: SUCCESS (spec ready for planning)
```

---

## � Quick Guidelines

-  Focus on WHAT users need and WHY
- L Avoid HOW to implement (no tech stack, APIs, code structure)
- =e Written for business stakeholders, not developers

---

## User Scenarios & Testing _(mandatory)_

### Primary User Story

Biodiversity researchers and scientists need to visualize the geographic distribution of species occurrence records across Brazilian states. They want to see aggregated counts of occurrence records per state in an interactive map format, with the ability to filter results by taxonomic classifications (kingdom, phylum, class, order, family, genus, species) to focus on specific groups of organisms.

### Acceptance Scenarios

1. **Given** a user visits the occurrence map page, **When** the page loads, **Then** they see an interactive map of Brazil showing occurrence counts by state with a color-coded legend
2. **Given** a user is viewing the occurrence map, **When** they apply a taxonomic filter (e.g., select "Mammalia" class), **Then** the map updates to show only occurrence counts for mammals by state
3. **Given** a user hovers over a state on the map, **When** the mouse cursor is over the state, **Then** they see a tooltip displaying the state name and exact occurrence count
4. **Given** a user wants to filter multiple taxonomic levels, **When** they select both family and genus filters, **Then** the map shows occurrences that match both criteria simultaneously
5. **Given** a user applies filters that return no results, **When** the filtered query has zero matches, **Then** the map displays with all states showing zero occurrences and an appropriate message
6. **Given** a user applies a filter to the large dataset, **When** the system is processing 11+ million records, **Then** they see a loading spinner and progress indicator within 500ms
7. **Given** a user applies multiple filters rapidly, **When** they change filters before the previous request completes, **Then** the system cancels the previous request and processes only the latest filter combination
8. **Given** the initial map is loading, **When** the system is aggregating the complete dataset, **Then** the user sees a skeleton loader with estimated completion time

### Edge Cases

- What happens when occurrence records have inconsistent state naming (e.g., "Amazonas" vs "AM")?
- How does the system handle very large occurrence datasets (11+ million records) that might impact loading performance?
- What occurs when states have zero occurrence records for the applied filters?
- How are occurrence records without valid state information handled?
- How does the system handle timeout scenarios when processing large datasets?
- What happens when users apply multiple filters rapidly in succession?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display an interactive map of Brazil divided by states
- **FR-002**: System MUST show aggregated occurrence counts for each Brazilian state
- **FR-003**: System MUST provide color-coding or visual indicators to represent occurrence density by state
- **FR-004**: System MUST allow users to filter occurrence data by taxonomic classifications (kingdom, phylum, class, order, superfamily, family, genus, specific epithet)
- **FR-005**: System MUST update the map visualization in real-time when filters are applied
- **FR-006**: System MUST display tooltips or hover information showing state names and exact occurrence counts
- **FR-007**: System MUST normalize inconsistent state naming in occurrence records (e.g., abbreviations vs full names, accent variations)
- **FR-008**: System MUST handle occurrence records with missing or invalid state information gracefully
- **FR-009**: Users MUST be able to clear all applied filters and return to the complete dataset view
- **FR-010**: System MUST provide a legend or scale to help users interpret the occurrence count visualization
- **FR-011**: System MUST maintain consistent visual design and navigation with the existing taxonomic distribution map
- **FR-012**: System MUST provide visual loading indicators during data processing and map updates
- **FR-013**: System MUST implement progressive loading for large datasets (11+ million records)
- **FR-014**: System MUST complete initial map loading within 5 seconds for the complete dataset
- **FR-015**: System MUST complete filter updates within 3 seconds for any taxonomic filter combination
- **FR-016**: System MUST prevent multiple simultaneous filter requests and queue subsequent requests
- **FR-017**: System MUST provide estimated loading time or progress indicators for operations taking longer than 2 seconds
- **FR-018**: System MUST implement client-side caching for previously loaded state aggregations
- **FR-019**: System MUST handle network timeouts gracefully with retry mechanisms and user feedback

### Performance Requirements _(mandatory for large datasets)_

- **PR-001**: Initial map load MUST complete within 5 seconds for 11+ million occurrence records
- **PR-002**: Filter application MUST complete within 3 seconds for any taxonomic combination
- **PR-003**: Loading indicators MUST appear within 500ms of user interaction
- **PR-004**: System MUST handle up to 11 million occurrence records without memory issues
- **PR-005**: Database aggregation queries MUST be optimized with proper indexing for state and taxonomic fields
- **PR-006**: Client-side caching MUST reduce subsequent filter requests by at least 50% for common combinations
- **PR-007**: Progressive loading MUST display state counts as they become available rather than waiting for complete dataset
- **PR-008**: System MUST degrade gracefully if performance targets cannot be met, showing partial results with notifications

### Key Entities _(include if feature involves data)_

- **Occurrence Record**: Individual documented observation of a species at a specific location and time, containing taxonomic information and geographic data (state/province)
- **Brazilian State**: Administrative divisions of Brazil used for geographic aggregation, requiring standardized naming to handle variations in data sources
- **Taxonomic Classification**: Hierarchical biological classification system including kingdom, phylum, class, order, superfamily, family, genus, and specific epithet used for filtering occurrence data
- **Occurrence Count**: Aggregated number of occurrence records per state after applying any taxonomic filters
- **Loading State**: System state indicating data processing progress, including initial loading, filter updates, and error conditions
- **Cache Entry**: Client-side stored aggregation results to improve performance for previously requested filter combinations

---

## Review & Acceptance Checklist

_GATE: Automated checks run during main() execution_

### Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status

_Updated by main() during processing_

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---
