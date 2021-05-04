# OpenID Connect

Stager supports authentication using OpenID Connect. If you use an Identity Provider (IdP) such as auth0 or Keycloak that supports OIDC, then you can use that for authenticating Stager users.

## Setting up Stager as a client

Stager uses a Python library called [authlib](https://github.com/lepture/authlib/) that provides OAuth and OpenID Connect support, and integration with Flask.

The following `.env` variables must be set for `authlib` to register properly:

-   `OIDC_CLIENT_ID` - Stager's unique ID in the Identity Provider.
-   `OIDC_CLIENT_SECRET` - The client_secret provided by the Identity Provider.
-   `OIDC_WELL_KNOWN` - The URL for the .well-known/openid-configuration endpoint.
-   `OIDC_PROVIDER` - Name of the Identity Provider (eg. keycloak, auth0) (may not be required).
