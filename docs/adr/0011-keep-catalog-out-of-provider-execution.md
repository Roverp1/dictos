# Keep the Model Catalog Out of Provider Execution

models.dev includes URLs and SDK package names alongside Model metadata, but it is an external data source, not trusted routing configuration. We will keep supported Provider IDs, SDK adapters, and request endpoints in Dictos-owned code; catalog entries may suggest eligible Models but cannot choose code to load or where credentials are sent. This requires explicit work for each new Provider, but a bad catalog refresh cannot redirect API keys to another endpoint.
