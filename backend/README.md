# Sytelens Backend — Deploy Guide

AWS Lambda + DynamoDB + API Gateway, deployed as one CloudFormation stack via
[AWS SAM](https://docs.aws.amazon.com/serverless-application-model/). The
[template.yaml](template.yaml) provisions everything: the `sytelens-cache`
DynamoDB table (with TTL), the analysis Lambda, the REST API with API-key auth,
and the IAM role.

## Prerequisites

- **AWS CLI** configured with credentials (`aws sts get-caller-identity` should succeed).
- **AWS SAM CLI** — `brew install aws-sam-cli` (macOS).
- **Node.js 20+** (SAM installs production deps during `sam build`).
- An **Anthropic API key**, and optionally a **whoisjsonapi.com API key**
  (WHOIS is skipped if omitted — domain-age/registrar will read "unknown").

The deploying IAM principal needs permissions for CloudFormation, Lambda,
DynamoDB, API Gateway, IAM (role creation), and S3 (SAM's artifact bucket).

## Deploy

From `backend/`:

```bash
sam build
sam deploy --guided
```

On the first `--guided` run you'll be prompted. Suggested answers:

| Prompt | Answer |
|---|---|
| Stack Name | `sytelens` |
| AWS Region | `us-east-1` |
| Parameter AnthropicApiKey | *(paste your key)* |
| Parameter WhoisApiKey | *(paste, or leave blank)* |
| Confirm changes before deploy | `y` |
| Allow SAM CLI IAM role creation | `y` |
| Disable rollback | `N` |
| AnalyzeFunction may not have authorization defined | `y` *(auth is the API key, enforced at the gateway)* |
| Save arguments to samconfig.toml | `y` |

Your answers are saved to `samconfig.toml`, so later deploys are just
`sam build && sam deploy`. **Note:** `samconfig.toml` stores the API keys you
typed — it's git-ignored; never commit it.

## After deploy

The stack outputs the endpoint and the API key ID:

```bash
# Show outputs
aws cloudformation describe-stacks --stack-name sytelens \
  --query "Stacks[0].Outputs" --output table

# Fetch the API key SECRET value (needed by the extension)
aws apigateway get-api-key --api-key <ApiKeyId from outputs> \
  --include-value --query value --output text
```

## Smoke test

```bash
curl -s -X POST "<ApiEndpoint>" \
  -H "Content-Type: application/json" \
  -H "x-api-key: <api key value>" \
  -d '{"domain":"microsoft.com","fullUrl":"https://microsoft.com/","https":true}' | jq
```

First call for a domain runs a live analysis and writes to the cache; repeat the
same call and the response returns instantly with `"cached": true`.

## Update / tear down

```bash
sam build && sam deploy        # redeploy after code changes
sam delete --stack-name sytelens   # remove all resources
```
