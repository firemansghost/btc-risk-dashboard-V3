# Cursor Agent Guidelines

Development rules and best practices for AI-assisted development.

## Core Principles

### Always Read Documentation First
- **Before making any changes**: Read relevant documentation in `/docs/`
- **Understand the system**: Review `PROJECT_BRIEF.md` and `FACTOR_SPECS.md`
- **Check data contracts**: Consult `ARTIFACT_SCHEMAS.md` for API specifications
- **Follow runbook**: Use `RUNBOOK.md` for operational procedures

### Keep Documentation in Sync
- **Update docs with changes**: Any code change must update relevant documentation
- **Version bump required**: Contract changes require version increments
- **Decision tracking**: Document significant choices in `DECISIONS.md`
- **Schema updates**: Modify `ARTIFACT_SCHEMAS.md` for any data structure changes
- **Brand consistency**: Consult `/docs/BRAND_CARD.md` for voice, naming, band labels; keep UI copy in sync

## Development Workflow

### Plan → Changes → Acceptance Checklist
Every PR must include:

**Plan**:
- [ ] What is being changed and why
- [ ] Which documentation needs updating
- [ ] What tests need to be added/modified
- [ ] How to verify the changes work

**Changes**:
- [ ] Code modifications with clear commit messages
- [ ] Documentation updates
- [ ] Type definitions updated
- [ ] Tests added/updated

**Acceptance**:
- [ ] All tests pass
- [ ] Documentation is accurate and complete
- [ ] No breaking changes without version bump
- [ ] ETL pipeline runs successfully
- [ ] Dashboard displays correctly

## System Constraints

### Never Rely on Vercel Runtime Writes
- **Artifacts are ETL-built**: All data artifacts come from ETL pipeline
- **Read-only production**: Vercel functions cannot write to filesystem
- **Cache for performance**: Use caching strategies, not file writes
- **ETL as source of truth**: All data originates from scheduled ETL runs

### Node-Safe Modules with Retries/Backoff
- **Robust API calls**: Implement exponential backoff for all external APIs
- **Error handling**: Graceful degradation when data sources fail
- **Timeout handling**: Set appropriate timeouts for all network requests
- **Retry logic**: Automatic retries with backoff for transient failures

### Mark Stale Factors and Re-normalize Weights
- **Staleness detection**: Factors older than TTL must be marked as stale
- **Weight re-normalization**: Exclude stale factors from composite calculation
- **Transparent UI**: Show staleness status clearly to users
- **Fallback behavior**: Use cached data when live sources fail

## Data Contract Discipline

### If Contract Changes, Update Schemas and Bump Version
- **Schema documentation**: Update `ARTIFACT_SCHEMAS.md` for any data structure changes
- **Version increment**: Bump version in `latest.json` for contract changes
- **Type safety**: Update TypeScript interfaces in `lib/types.ts`
- **Backward compatibility**: Maintain compatibility for at least 2 major versions

### Factor Specification Updates
- **Math contracts**: Update `FACTOR_SPECS.md` for any factor calculation changes
- **Window specifications**: Document all time windows and data sources
- **Mapping directions**: Clearly specify when factors are inverted
- **Staleness TTL**: Define staleness thresholds for each factor

## Code Quality Standards

### TypeScript First
- **Strict typing**: All code must be properly typed
- **Interface definitions**: Define clear interfaces for all data structures
- **Type checking**: Run `npm run typecheck` before committing
- **No any types**: Avoid `any` types except in specific, documented cases

### Error Handling
- **Graceful degradation**: System must continue working when individual components fail
- **User feedback**: Clear error messages for users when things go wrong
- **Logging**: Appropriate logging for debugging and monitoring
- **Recovery**: Automatic recovery mechanisms where possible

### Testing
- **Unit tests**: Test all factor calculations and utility functions
- **Integration tests**: Test ETL pipeline end-to-end
- **Type tests**: Verify TypeScript types are correct
- **Manual testing**: Verify dashboard functionality manually

## API Design Principles

### RESTful and Consistent
- **Clear endpoints**: Use descriptive endpoint names
- **Consistent responses**: Standardize response formats across all APIs
- **Error codes**: Use appropriate HTTP status codes
- **Documentation**: Document all API endpoints and their contracts

### Performance and Reliability
- **Caching headers**: Set appropriate cache headers for static data
- **Rate limiting**: Implement rate limiting for expensive operations
- **Timeout handling**: Set reasonable timeouts for all operations
- **Monitoring**: Include performance metrics in responses

## Security Considerations

### API Key Management
- **Environment variables**: Store all API keys in environment variables
- **No hardcoded secrets**: Never commit API keys to repository
- **Key rotation**: Support for easy API key rotation
- **Access control**: Implement appropriate access controls for sensitive endpoints

### Data Validation
- **Input validation**: Validate all inputs to prevent injection attacks
- **Output sanitization**: Sanitize all outputs to prevent XSS
- **Type checking**: Use TypeScript for compile-time type safety
- **Range validation**: Validate all numeric inputs are within expected ranges

## Monitoring and Observability

### Health Checks
- **System health**: Implement comprehensive health check endpoints
- **Data freshness**: Monitor staleness of all data sources
- **Error rates**: Track error rates and response times
- **Alerting**: Set up alerts for critical system failures

### Logging and Debugging
- **Structured logging**: Use structured logging for easy parsing
- **Debug information**: Include debug information in development builds
- **Performance metrics**: Track performance metrics for optimization
- **Error tracking**: Implement error tracking and reporting

## Deployment and Operations

### CI/CD Pipeline
- **Automated testing**: Run all tests before deployment
- **Type checking**: Verify TypeScript types before deployment
- **Build verification**: Ensure builds complete successfully
- **Deployment validation**: Verify deployments work correctly

### Environment Management
- **Environment parity**: Keep development and production environments similar
- **Configuration management**: Use environment variables for configuration
- **Secret management**: Secure handling of API keys and secrets
- **Rollback capability**: Ability to quickly rollback problematic deployments
