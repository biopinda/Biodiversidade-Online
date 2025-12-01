# Quickstart: Split up mongo.ts

## Overview

This guide provides step-by-step validation scenarios for the mongo.ts refactoring. Each scenario tests a specific aspect of the Least Complex Solution Theorem - ensuring each module can function independently while maintaining overall system integrity.

## Prerequisites

1. **Environment Setup**:

   ```bash
   # Ensure MongoDB is running and accessible
   export MONGO_URI="mongodb://dwc2json:VLWQ8Bke65L52hfBM635@192.168.1.10:27017/?authSource=admin&authMechanism=DEFAULT"

   # Navigate to web package
   cd packages/web/

   # Install dependencies
   bun install
   ```

2. **Build Validation**:

   ```bash
   # Check TypeScript compilation
   bunx tsc --noEmit

   # Check formatting
   bunx prettier --check src/

   # Build application
   bun run build
   ```

## Validation Scenarios

### Scenario 1: Import Compatibility

**User Story**: As a developer, I need imports to work seamlessly after refactoring

**Steps**:

1. Start the development server: `bun run dev`
2. Visit http://localhost:4321/api/taxa?page=0
3. Verify taxa data loads without errors
4. Check browser console for any import errors

**Expected Result**: API returns paginated taxa data, no console errors

### Scenario 2: Taxa Operations Independence

**User Story**: Taxa-related functions work independently of other modules

**Steps**:

1. Visit http://localhost:4321/api/family/Plantae
2. Verify family statistics load correctly
3. Visit http://localhost:4321/taxa (if available)
4. Check that taxa search functionality works

**Expected Result**: All taxa operations function without errors

### Scenario 3: Occurrence Data Integrity

**User Story**: Occurrence queries maintain accuracy after refactoring

**Steps**:

1. Visit http://localhost:4321/api/occurrenceCountByState
2. Verify state-wise occurrence counts are returned
3. Check that totals are reasonable (> 0)
4. Verify Brazilian states are properly normalized

**Expected Result**: Occurrence data aggregates correctly by state

### Scenario 4: Cache Functionality

**User Story**: Caching system works independently

**Steps**:

1. Run the cache initialization script:
   ```bash
   bun run scripts/init-occurrence-cache.ts
   ```
2. Check MongoDB for `occurrenceCache` collection creation
3. Verify TTL index exists on `createdAt` field
4. Confirm cache key index exists

**Expected Result**: Cache collection created with proper indexes

### Scenario 5: Threatened Species Data

**User Story**: Threatened species queries work in isolation

**Steps**:

1. Query threatened species via direct database access (if API exists)
2. Or verify through dashboard that shows threatened counts
3. Check that different kingdoms (Plantae, Animalia, Fungi) return appropriate data

**Expected Result**: Threatened species data loads correctly per kingdom

### Scenario 6: Invasive Species Statistics

**User Story**: Invasive species functions operate independently

**Steps**:

1. Query invasive species data via database
2. Verify top orders and families calculations work
3. Check kingdom-specific filtering

**Expected Result**: Invasive species statistics generate correctly

### Scenario 7: Phenological Data

**User Story**: Phenological calendar functions work in isolation

**Steps**:

1. Query phenological data via database
2. Verify family/genus/species filtering works
3. Check heatmap generation logic

**Expected Result**: Phenological data queries return valid results

### Scenario 8: Connection Resilience

**User Story**: Connection management handles failures gracefully

**Steps**:

1. Temporarily stop MongoDB service
2. Attempt to access any API endpoint
3. Verify graceful error handling (not crashes)
4. Restart MongoDB and verify recovery

**Expected Result**: Application handles connection failures gracefully

### Scenario 9: Performance Validation

**User Story**: Refactoring maintains performance standards

**Steps**:

1. Time API response for `/api/occurrenceCountByState`
2. Verify response time < 30 seconds
3. Check application startup time < 2 seconds
4. Verify build time < 60 seconds

**Expected Result**: All performance requirements met

### Scenario 10: DRY Compliance

**User Story**: Common patterns are properly abstracted

**Steps**:

1. Review new module files for code duplication
2. Verify shared utilities are used across modules
3. Check that kingdom-specific patterns use common helpers
4. Confirm state normalization is centralized

**Expected Result**: No code duplication, proper abstraction

## Automated Testing

### Build and Lint Checks

```bash
# From packages/web/
bunx prettier --check src/
bunx tsc --noEmit
bun run build
```

### Docker Production Test

```bash
# Build production image
docker build -t chatbb-test .

# Run production container
docker run -p 4321:4321 -e MONGO_URI="your_mongo_uri" chatbb-test

# Test endpoints
curl http://localhost:4321/api/health
curl http://localhost:4321/api/taxa?page=0
```

## Troubleshooting

### Common Issues

1. **Import Errors**: Check that barrel exports in `index.ts` include all functions
2. **MongoDB Connection**: Verify MONGO_URI environment variable
3. **Missing Functions**: Ensure all functions from original mongo.ts are exported
4. **Type Errors**: Run `bunx tsc --noEmit` to identify type issues

### Rollback Plan

If issues occur:

1. Revert to original mongo.ts file
2. Check git history for incremental commits
3. Restore from backup branch if needed

## Success Criteria

- [ ] All API endpoints return valid data
- [ ] No console errors in browser
- [ ] Build completes successfully
- [ ] TypeScript compilation passes
- [ ] Performance requirements met
- [ ] Docker production build works
- [ ] No code duplication introduced
- [ ] All original functionality preserved
