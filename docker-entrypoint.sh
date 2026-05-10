#!/bin/sh

# Set default values for environment variables if not already set
: ${SERVER_URL:="http://74.224.122.231:8080/"}
: ${SERVER_URL2:="http://74.224.122.231:5000/"}
: ${GRAFANA_URL:="http://74.224.122.231:9097/"}
: ${CUSTOMER_ID:="690d2210-8a3a-11f0-a3ac-9b534c07af2b"}
: ${SMC_CUSTOMER_ID:="527951c0-c50b-11f0-878e-073dc60e4f9a"}
: ${MARKS_CUSTOMER_ID:="f05b99b0-da4c-11f0-a7b3-dbcd7348bdb3"}
: ${MAKINO_CUSTOMER_ID:="29c6cb40-74fc-11f0-b2ca-b34d1d1b8f24"}
: ${ATECH_CUSTOMER_ID:="05391cd0-3d37-11f0-b2f2-c1aac5b33cac"}
: ${HITECH_CUSTOMER_ID:="84fd0f90-9ac4-11f0-a20b-db03187ae4d2"}
: ${GPLAST_CUSTOMER_ID:="9e435d50-e0b6-11f0-915f-9f39a11b7cf8"}
: ${DEMO_CUSTOMER_ID:="006dc270-fb3f-11f0-9e22-affd28d5654a"}
: ${TENANT_GMAIL:="pms@gmail.com"}
: ${TENANT_PASSWORD:="pmspms"}
: ${LOGO:="b0coVWpU9C1Ztg9CrjtkHgi87ia4gFxH"}
: ${BG_IMAGE:="76qC9HzBmPBNFqTBaHGwF40Wka0Ri03C"}
: ${SENTRY_DSN:=""}
: ${POSTHOG_KEY:=""}

# Replace placeholders in the template with actual environment variables
# Note: Use -u to only replace variables that have a value set (or use defaults above)
envsubst < /usr/share/nginx/html/env.template.js > /usr/share/nginx/html/env.js

# Start nginx
exec "$@"
